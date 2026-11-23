import { getApps, initializeApp } from "firebase-admin/app";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { runIngestionPipeline } from "./pipeline/ingest";
import { recomputeAllImportance } from "./intelligence/importance";
import { runReclusteringForAllUsers } from "./intelligence/cluster";
import { resurfaceAllUsers } from "./intelligence/resurface";
import type { PipelineBookmark } from "./pipeline/types";

if (!getApps().length) {
  initializeApp();
}

const tmdbApiKey = defineSecret("TMDB_API_KEY");

export { enrich } from "./enrich.js";
export { captureShare } from "./captureShare.js";
export { captureBookmark, onCaptureJobCreated } from "./capture/captureBookmark.js";
export { confirmCandidate } from "./capture/confirmCandidate.js";
export { selectResolutionCandidate } from "./resolution/events.js";
export { tmdbProxy } from "./tmdb.js";
export { refreshWatchAvailability } from "./availabilityRefresh.js";
export { setBookmarkSharing, listPublicBookmarks } from "./sharing.js";
export { onBookmarkDeleted } from "./bookmarkDeletion.js";
export { reportClientError } from "./clientErrors.js";
export { migrateBookmarksV2 } from "./migration/bookmarkV2.js";
export { sendReminders } from "./reminders.js";
export { searchBookmarks } from "./retrieval/searchBookmarks";
export {
  adminSystemHealth,
  adminUserBehavior,
  adminIntelligenceQuality,
  adminContentGraph,
  adminRetention,
  recordView,
  respondToResurface,
} from "./admin/queries";

function toPipelineBookmark(eventBookmarkId: string, eventUserId: string, data: Record<string, unknown>): PipelineBookmark {
  const source = data.source && typeof data.source === "object" && !Array.isArray(data.source)
    ? data.source as Record<string, unknown>
    : {};
  const media = data.media && typeof data.media === "object" && !Array.isArray(data.media)
    ? data.media as Record<string, unknown>
    : {};
  const resolution = data.resolution && typeof data.resolution === "object" && !Array.isArray(data.resolution)
    ? data.resolution as Record<string, unknown>
    : {};
  const library = data.library && typeof data.library === "object" && !Array.isArray(data.library)
    ? data.library as Record<string, unknown>
    : {};
  const intelligence = data.intelligence && typeof data.intelligence === "object" && !Array.isArray(data.intelligence)
    ? data.intelligence as Record<string, unknown>
    : {};
  const isV2 = data.schemaVersion === 2;
  return {
    id: eventBookmarkId,
    userId: eventUserId,
    title: typeof (isV2 ? media.title : data.title) === "string" ? String(isV2 ? media.title : data.title) : undefined,
    source_url: typeof (isV2 ? source.originalUrl : data.source_url) === "string" ? String(isV2 ? source.originalUrl : data.source_url) : null,
    canonical_url: typeof (isV2 ? source.canonicalUrl : data.canonical_url) === "string" ? String(isV2 ? source.canonicalUrl : data.canonical_url) : null,
    type: typeof (isV2 ? media.type : data.type) === "string" ? String(isV2 ? media.type : data.type) : null,
    provider: typeof (isV2 ? source.platform : data.provider) === "string" ? String(isV2 ? source.platform : data.provider) : null,
    metadata:
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {},
    poster_url: typeof (isV2 ? media.posterUrl : data.poster_url) === "string" ? String(isV2 ? media.posterUrl : data.poster_url) : null,
    tags: Array.isArray(isV2 ? library.tags : data.tags) ? (isV2 ? library.tags : data.tags) as string[] : [],
    notes: typeof (isV2 ? library.notes : data.notes) === "string" ? String(isV2 ? library.notes : data.notes) : null,
    user_rating: typeof (isV2 ? library.rating : data.user_rating) === "number" ? Number(isV2 ? library.rating : data.user_rating) : null,
    enriched: isV2 ? resolution.status !== "pending" : data.enriched === true,
    tmdb: isV2 ? null : data.tmdb ?? null,
    view_count: typeof (isV2 ? intelligence.viewCount : data.view_count) === "number" ? Number(isV2 ? intelligence.viewCount : data.view_count) : undefined,
    importance_score: typeof (isV2 ? intelligence.importanceScore : data.importance_score) === "number" ? Number(isV2 ? intelligence.importanceScore : data.importance_score) : undefined,
  };
}

export const onBookmarkCreated = onDocumentCreated(
  {
    document: "users/{userId}/bookmarks/{bookmarkId}",
    secrets: [tmdbApiKey],
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const intelligence = data.intelligence && typeof data.intelligence === "object" && !Array.isArray(data.intelligence)
      ? data.intelligence as Record<string, unknown>
      : {};
    const pipelineVersion = data.schemaVersion === 2 ? intelligence.pipelineVersion : data.pipeline_version;
    if (typeof pipelineVersion === "number" && pipelineVersion >= 2) {
      return;
    }

    const bookmark = toPipelineBookmark(event.params.bookmarkId, event.params.userId, data);
    const apiKey = (() => {
      try {
        return tmdbApiKey.value() || null;
      } catch {
        return null;
      }
    })();

    const summary = await runIngestionPipeline(bookmark, apiKey);
    console.log("[onBookmarkCreated]", bookmark.id, summary.status, summary.resolveSource, summary.resolveConfidence.toFixed(2));
  },
);

export const retroactivePipeline = onSchedule(
  {
    schedule: "every 4 hours",
    secrets: [tmdbApiKey],
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const apiKey = (() => {
      try {
        return tmdbApiKey.value() || null;
      } catch {
        return null;
      }
    })();
    const { getFirestore } = await import("firebase-admin/firestore");
    const db = getFirestore();
    const { FieldPath } = await import("firebase-admin/firestore");
    const cursorRef = db.doc("jobCursors/retroactivePipeline");
    const cursor = (await cursorRef.get()).get("path");
    let scan = db.collectionGroup("bookmarks").orderBy(FieldPath.documentId()).limit(100);
    if (typeof cursor === "string") scan = scan.startAfter(db.doc(cursor));
    const snap = await scan.get();
    let completed = 0;
    let errors = 0;
    for (const doc of snap.docs) {
      const uid = doc.ref.parent.parent?.id;
      if (!uid) continue;
      const data = doc.data();
      // Repair ownership for existing share links; orphaned tokens remain denied.
      const token = data.schemaVersion === 2 ? data.visibility?.shareToken : data.share_token;
      if (typeof token === "string") {
        await db.runTransaction(async tx => {
          const current = await tx.get(doc.ref);
          const value = current.data();
          const active = value?.schemaVersion === 2 ? value.visibility?.shareToken : value?.share_token;
          if (active === token) tx.set(db.doc(`publicBookmarkOwners/${token}`), { uid, bookmarkId: doc.id });
        });
      }
      const version = data.schemaVersion === 2 ? data.intelligence?.pipelineVersion : data.pipeline_version;
      const fingerprint = data.schemaVersion === 2 ? data.intelligence?.fingerprint : data.fingerprint;
      if (version >= 2 && fingerprint?.platform) continue;
      const bookmark = toPipelineBookmark(doc.id, uid, data);
      const r = await runIngestionPipeline(bookmark, apiKey).catch((err) => {
        console.warn("[retroactivePipeline] error", doc.id, err instanceof Error ? err.message : err);
        return null;
      });
      if (!r) errors++;
      else if (r.status === "completed" || r.status === "partial") completed++;
      else errors++;
    }
    await cursorRef.set({ path: snap.size === 100 ? snap.docs[snap.docs.length - 1].ref.path : null });
    console.log("[retroactivePipeline]", { processed: snap.size, completed, errors });
  },
);

export const recomputeImportanceJob = onSchedule(
  { schedule: "every day 03:00", timeoutSeconds: 540, memory: "1GiB" },
  async () => {
    const result = await recomputeAllImportance();
    console.log("[recomputeImportanceJob]", result);
  },
);

export const reclusterJob = onSchedule(
  { schedule: "every 6 hours", timeoutSeconds: 540, memory: "1GiB" },
  async () => {
    const result = await runReclusteringForAllUsers();
    console.log("[reclusterJob]", result);
  },
);

export const resurfaceJob = onSchedule(
  { schedule: "every day 09:00", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const result = await resurfaceAllUsers();
    console.log("[resurfaceJob]", result);
  },
);

export const manualRetroactiveEnrich = onRequest(
  {
    secrets: [tmdbApiKey],
    timeoutSeconds: 540,
    memory: "1GiB",
    invoker: "private",
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const apiKey = tmdbApiKey.value() || null;
      const { getFirestore } = await import("firebase-admin/firestore");
      const db = getFirestore();
      const snap = await db
        .collectionGroup("bookmarks")
        .where("enriched", "==", false)
        .orderBy("created_at", "asc")
        .limit(500)
        .get();
      let completed = 0;
      for (const doc of snap.docs) {
        const uid = doc.ref.parent.parent?.id;
        if (!uid) continue;
        const bookmark = toPipelineBookmark(doc.id, uid, doc.data());
        const r = await runIngestionPipeline(bookmark, apiKey).catch(() => null);
        if (r && (r.status === "completed" || r.status === "partial")) completed++;
      }
      response.status(200).json({ success: true, processed: snap.size, completed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[manualRetroactiveEnrich]", message);
      response.status(500).json({ success: false, error: "Unable to complete retroactive enrichment." });
    }
  },
);

