import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { CaptureMatchCandidateSchema, ConfirmCaptureCandidateRequestSchema } from "@watchmarks/shared";
import { incrementMetric } from "../admin/metrics";

export const confirmCandidate = onCall(
  { timeoutSeconds: 20, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
    const parsed = ConfirmCaptureCandidateRequestSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid candidate confirmation.");

    const uid = request.auth.uid;
    const db = getFirestore();
    const captureRef = db.collection("users").doc(uid).collection("captures").doc(parsed.data.captureId);
    const capture = await captureRef.get();
    if (!capture.exists) throw new HttpsError("not-found", "Capture not found.");
    const response = capture.get("response") as Record<string, unknown> | undefined;
    const bookmarkId = typeof response?.bookmarkId === "string" ? response.bookmarkId : null;
    const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
    if (!bookmarkId) throw new HttpsError("failed-precondition", "Capture has no bookmark to confirm.");
    const requested = parsed.data.candidate;
    const offered = candidates.find((candidate) => {
      const item = candidate as Record<string, unknown>;
      return item.tmdbId === requested.tmdbId && item.mediaType === requested.mediaType;
    });
    const selectedResult = CaptureMatchCandidateSchema.safeParse(offered);
    if (!selectedResult.success) throw new HttpsError("failed-precondition", "Candidate was not offered for this capture.");
    const selected = selectedResult.data;

    const bookmarkRef = db.collection("users").doc(uid).collection("bookmarks").doc(bookmarkId);
    const bookmark = await bookmarkRef.get();
    if (!bookmark.exists || bookmark.get("source.captureId") !== parsed.data.captureId) {
      throw new HttpsError("failed-precondition", "Bookmark does not belong to this capture.");
    }
    const canonicalUrl = `https://www.themoviedb.org/${selected.mediaType}/${selected.tmdbId}`;
    const now = Timestamp.now();
    await db.runTransaction(async (transaction) => {
      transaction.update(bookmarkRef, {
        "media.title": selected.title,
        "media.type": selected.contentType === "episode" ? "episode" : selected.mediaType === "tv" ? "series" : "movie",
        "media.posterUrl": selected.posterUrl ?? null,
        "media.backdropUrl": selected.backdropUrl ?? null,
        "media.releaseYear": selected.releaseYear ?? null,
        "media.runtimeMinutes": selected.runtimeMinutes ? Math.trunc(selected.runtimeMinutes) : null,
        "source.canonicalUrl": canonicalUrl,
        "resolution.status": "matched",
        "resolution.provider": "tmdb",
        "resolution.externalId": String(selected.tmdbId),
        "resolution.confidence": Math.max(0, Math.min(1, selected.score ?? 1)),
        "resolution.selectedBy": "user",
        updatedAt: now,
      });
      transaction.update(captureRef, {
        status: "saved",
        response: { status: "saved", captureId: parsed.data.captureId, bookmarkId },
        updatedAt: now,
      });
    });
    await incrementMetric("capture.v2.candidate_confirmed");
    return { status: "saved" as const, captureId: parsed.data.captureId, bookmarkId };
  },
);
