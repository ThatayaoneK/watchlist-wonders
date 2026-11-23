import { createHash, randomUUID } from "node:crypto";
import { CAPTURE_LEASE_MS, claimDecision } from "./jobLease";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import {
  BookmarkV2Schema,
  CaptureBookmarkRequestSchema,
  CaptureBookmarkResponseSchema,
  CaptureMatchCandidateSchema,
  type CaptureBookmarkRequest,
  type CaptureBookmarkResponse,
} from "@watchmarks/shared";
import { incrementMetric } from "../admin/metrics";
import { extractCapture } from "../enrichment/extract";
import { tmdbApiKey, youtubeApiKey, type EnrichResponse } from "../enrich";
import { resolveMedia } from "../resolution/resolveMedia";
import { captureBookmarkId, findExistingBookmark } from "./deduplicate";
import { normalizeCaptureRequest } from "./normalizeCapture";

type CaptureJob = {
  schemaVersion: 2;
  uid: string;
  captureId: string;
  request: CaptureBookmarkRequest;
  state: "queued" | "processing" | "complete";
};

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function platform(value: unknown) {
  const supported = new Set(["youtube", "imdb", "netflix", "instagram", "facebook", "x", "letterboxd", "tiktok", "reddit", "rottentomatoes"]);
  return typeof value === "string" && supported.has(value) ? value : "generic";
}

function mediaType(result: EnrichResponse) {
  if (result.contentType === "episode") return "episode";
  if (result.contentType === "series" || result.mediaType === "tv") return "series";
  if (result.contentType === "video") return "video";
  return "movie";
}

function boundedCandidates(result: EnrichResponse) {
  return (result.matchCandidates ?? [])
    .map((candidate) => CaptureMatchCandidateSchema.safeParse(candidate))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data)
    .slice(0, 20);
}

function buildBookmark(input: {
  uid: string;
  captureId: string;
  request: ReturnType<typeof normalizeCaptureRequest>;
  result: EnrichResponse;
}) {
  const { uid, captureId, request, result } = input;
  const now = Timestamp.now();
  const matched = result.resolutionStatus === "matched" && Boolean(result.tmdbId);
  const candidates = boundedCandidates(result);
  const title = (result.title?.trim() || request.sharedTitle || request.url || "Saved item").slice(0, 300);
  const canonicalUrl = matched && result.tmdbId
    ? `https://www.themoviedb.org/${result.mediaType === "tv" ? "tv" : "movie"}/${result.tmdbId}`
    : safeUrl(result.canonicalUrl) ?? request.url;
  return BookmarkV2Schema.parse({
    schemaVersion: 2,
    ownerId: uid,
    source: {
      originalUrl: request.url,
      canonicalUrl,
      platform: platform(result.provider),
      rawTitle: request.sharedTitle ?? result.title?.slice(0, 500) ?? null,
      capturedAt: now,
      captureId,
    },
    media: {
      type: mediaType(result),
      title,
      posterUrl: safeUrl(result.posterUrl),
      backdropUrl: safeUrl(result.backdropUrl),
      releaseYear: result.releaseYear && result.releaseYear >= 1880 && result.releaseYear <= 2200 ? Math.trunc(result.releaseYear) : null,
      runtimeMinutes: result.runtimeMinutes && result.runtimeMinutes <= 10000 ? Math.trunc(result.runtimeMinutes) : null,
    },
    resolution: {
      status: matched ? "matched" : candidates.length ? "needs_selection" : "unresolved",
      provider: matched ? "tmdb" : null,
      externalId: matched && result.tmdbId ? String(result.tmdbId) : null,
      confidence: typeof result.confidenceScore === "number" ? Math.max(0, Math.min(1, result.confidenceScore)) : null,
      version: 2,
      ...(candidates.length ? { candidates } : {}),
      ...(matched ? { selectedBy: "auto" } : {}),
    },
    library: {
      state: "saved", scheduledAt: null, progressPercent: 0, priority: 100, queueState: "queued",
      tags: [], moodTags: [], notes: request.sharedText?.slice(0, 5000) ?? null,
      rating: null, review: null, watchedAt: null, lastShownAt: null, shownCount: 0,
    },
    visibility: { isPublic: false, isVaulted: false, shareToken: null },
    availability: null,
    intelligence: {
      autoTags: [], embeddingRef: null, fingerprint: { source: request.fingerprint }, clusterId: null,
      importanceScore: null, pendingClusterAssignment: true, pipelineVersion: 0, lastViewedAt: null, viewCount: 0,
    },
    createdAt: now,
    updatedAt: now,
  });
}

async function finishCapture(job: CaptureJob): Promise<CaptureBookmarkResponse> {
  const db = getFirestore();
  const normalized = normalizeCaptureRequest(job.request);
  let extraction: EnrichResponse;
  try {
    extraction = resolveMedia(await extractCapture(normalized.url
      ? { url: normalized.url }
      : { title: normalized.sharedTitle ?? normalized.sharedText ?? undefined }));
  } catch {
    extraction = { provider: "generic", resolutionStatus: "unresolved", requiresUserSelection: true };
  }

  const existing = await findExistingBookmark(job.uid, normalized.url, extraction.tmdbId, extraction.mediaType);
  const existingResponse = async (bookmarkId: string): Promise<CaptureBookmarkResponse> => {
    const value = (await db.doc(`users/${job.uid}/bookmarks/${bookmarkId}`).get()).data();
    if (value?.source?.captureId !== job.captureId) return { status: "duplicate", bookmarkId, captureId: job.captureId };
    if (value.resolution?.status === "matched") return { status: "saved", bookmarkId, captureId: job.captureId };
    const candidates = (value.resolution?.candidates ?? []).flatMap((candidate: unknown) => {
      const result = CaptureMatchCandidateSchema.safeParse(candidate);
      return result.success ? [result.data] : [];
    }).slice(0, 20);
    if (candidates.length) return { status: "needs_selection", bookmarkId, captureId: job.captureId, candidates };
    return { status: "unresolved", bookmarkId, captureId: job.captureId,
      draft: { url: normalized.url, title: normalized.sharedTitle, text: normalized.sharedText } };
  };
  if (existing) return existingResponse(existing);

  const bookmarkId = captureBookmarkId({
    url: normalized.url,
    title: normalized.sharedTitle ?? normalized.sharedText,
    tmdbId: extraction.tmdbId,
    mediaType: extraction.mediaType,
  });
  const bookmarkRef = db.collection("users").doc(job.uid).collection("bookmarks").doc(bookmarkId);
  try {
    await bookmarkRef.create(buildBookmark({ uid: job.uid, captureId: job.captureId, request: normalized, result: extraction }));
  } catch (error) {
    const code = (error as { code?: string | number }).code;
    if (code === 6 || code === "already-exists" || (error instanceof Error && /already exists/i.test(error.message))) {
      return existingResponse(bookmarkId);
    }
    throw error;
  }

  const candidates = boundedCandidates(extraction);
  if (extraction.resolutionStatus === "matched" && extraction.tmdbId) {
    return { status: "saved", bookmarkId, captureId: job.captureId };
  }
  if (candidates.length) return { status: "needs_selection", bookmarkId, captureId: job.captureId, candidates };
  return {
    status: "unresolved",
    bookmarkId,
    captureId: job.captureId,
    draft: { url: normalized.url, title: normalized.sharedTitle, text: normalized.sharedText },
  };
}

export const captureBookmark = onCall<unknown, Promise<CaptureBookmarkResponse>>(
  { memory: "256MiB", timeoutSeconds: 10, cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
    const parsed = CaptureBookmarkRequestSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid capture request.");
    const uid = request.auth.uid;
    if (parsed.data.expectedOwnerId && parsed.data.expectedOwnerId !== uid) {
      throw new HttpsError("permission-denied", "Account changed during capture. Please retry.");
    }
    const captureId = parsed.data.requestId;
    const db = getFirestore();
    const captureRef = db.collection("users").doc(uid).collection("captures").doc(captureId);
    const jobId = createHash("sha256").update(`${uid}:${captureId}`).digest("hex");
    const jobRef = db.collection("captureJobs").doc(jobId);
    const response = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(captureRef);
      if (existing.exists) {
        if (existing.get("status") === "failed") throw new HttpsError("unavailable", "Capture failed after retries. Please submit it again.");
        const stored = CaptureBookmarkResponseSchema.safeParse(existing.get("response"));
        if (stored.success) return stored.data;
      }
      const processing: CaptureBookmarkResponse = { status: "processing", captureId };
      const now = Timestamp.now();
      const quotaRef = db.doc(`captureQuotas/${uid}`);
      const quota = await transaction.get(quotaRef);
      const windowStart = Math.floor(now.toMillis() / 3_600_000);
      const count = quota.get("windowStart") === windowStart ? Number(quota.get("count") ?? 0) : 0;
      if (count >= 120) throw new HttpsError("resource-exhausted", "Capture limit reached. Please try again next hour.");
      transaction.set(quotaRef, { windowStart, count: count + 1 });
      transaction.set(captureRef, {
        schemaVersion: 2, ownerId: uid, requestId: captureId, surface: parsed.data.surface,
        status: "processing", response: processing, raw: parsed.data, createdAt: now, updatedAt: now,
      });
      transaction.set(jobRef, {
        schemaVersion: 2, uid, captureId, request: parsed.data, state: "queued", createdAt: now, updatedAt: now,
      });
      return processing;
    });
    void Promise.all([
      incrementMetric("capture.v2.ack").catch(() => undefined),
      incrementMetric(`capture.v2.surface.${parsed.data.surface}`).catch(() => undefined),
    ]);
    return response;
  },
);

export const onCaptureJobCreated = onDocumentCreated(
  { document: "captureJobs/{jobId}", memory: "512MiB", timeoutSeconds: 120, retry: true, secrets: [youtubeApiKey, tmdbApiKey] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const job = snapshot.data() as CaptureJob;
    const db = getFirestore();
    const captureRef = db.collection("users").doc(job.uid).collection("captures").doc(job.captureId);
    const attemptId = randomUUID();
    const claimed = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(snapshot.ref);
      if (!current.exists) return false;
      const decision = claimDecision(current.data() ?? {}, Date.now());
      if (decision === "finished") return false;
      // Reject active duplicate deliveries so at least one event retries after
      // the lease expires if the original process terminates without cleanup.
      if (decision === "busy") throw new Error("Capture lease is still active");
      if (decision === "failed") {
        transaction.update(snapshot.ref, { state: "failed", updatedAt: Timestamp.now() });
        transaction.update(captureRef, { status: "failed", updatedAt: Timestamp.now() });
        return false;
      }
      transaction.update(snapshot.ref, {
        state: "processing", attemptId, attempts: (current.get("attempts") ?? 0) + 1,
        leaseExpiresAt: Timestamp.fromMillis(Date.now() + CAPTURE_LEASE_MS), updatedAt: Timestamp.now(),
      });
      return true;
    });
    if (!claimed) return;
    try {
      const response = await finishCapture(job);
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(snapshot.ref);
        if (current.get("attemptId") !== attemptId) throw new Error("Capture lease was replaced");
        transaction.update(captureRef, { status: response.status, response, updatedAt: Timestamp.now() });
        transaction.update(snapshot.ref, { state: "complete", response, updatedAt: Timestamp.now() });
      });
      await incrementMetric(`capture.v2.status.${response.status}`).catch(() => undefined);
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(snapshot.ref);
        if (current.get("attemptId") !== attemptId) return;
        transaction.update(snapshot.ref, {
          state: "queued", lastError: error instanceof Error ? error.name : "CaptureWorkerError",
          updatedAt: Timestamp.now(),
        });
      });
      throw error;
    }
  },
);

