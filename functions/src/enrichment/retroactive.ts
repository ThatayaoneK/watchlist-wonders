import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { enrichBookmark } from "./enrichBookmark";
import type { BookmarkForEnrichment } from "../tmdb/types";

const BATCH_SIZE = 100;
const LEGACY_SCAN_LIMIT = 250;
const INTER_CALL_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RetroactiveStats {
  processed: number;
  enriched: number;
  noMatch: number;
  errors: number;
  skipped: number;
  durationMs: number;
}

export async function runRetroactiveEnrichment(apiKey: string): Promise<RetroactiveStats> {
  const db = getFirestore();
  const startedAt = Date.now();
  const stats: RetroactiveStats = {
    processed: 0,
    enriched: 0,
    noMatch: 0,
    errors: 0,
    skipped: 0,
    durationMs: 0,
  };

  const explicitPending = await db
    .collectionGroup("bookmarks")
    .where("enriched", "==", false)
    .orderBy("created_at", "asc")
    .limit(BATCH_SIZE)
    .get();

  const docs = [...explicitPending.docs];

  if (docs.length < BATCH_SIZE) {
    const seenPaths = new Set(docs.map((doc) => doc.ref.path));
    const legacyScan = await db
      .collectionGroup("bookmarks")
      .orderBy("created_at", "asc")
      .limit(LEGACY_SCAN_LIMIT)
      .get();

    for (const doc of legacyScan.docs) {
      if (docs.length >= BATCH_SIZE) break;
      if (seenPaths.has(doc.ref.path)) continue;

      const data = doc.data();
      const hasBeenResolved = data.enriched === true || data.tmdb != null;
      if (hasBeenResolved) continue;

      seenPaths.add(doc.ref.path);
      docs.push(doc);
    }
  }

  if (!docs.length) {
    stats.durationMs = Date.now() - startedAt;
    return stats;
  }

  for (const doc of docs) {
    const bookmark = toBookmarkForEnrichment(doc);
    
    try {
      const result = await enrichBookmark(bookmark, apiKey);
      stats.processed += 1;

      switch (result.status) {
        case "enriched":
          stats.enriched += 1;
          break;
        case "no_match":
          stats.noMatch += 1;
          break;
        case "skipped":
          stats.skipped += 1;
          break;
        case "error":
          stats.errors += 1;
          break;
      }
    } catch (err) {
      stats.errors += 1;
      stats.processed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[runRetroactiveEnrichment] batch error for ${bookmark.id}:`, message);
    }

    await sleep(INTER_CALL_DELAY_MS);
  }

  stats.durationMs = Date.now() - startedAt;
  return stats;
}

function toBookmarkForEnrichment(doc: QueryDocumentSnapshot): BookmarkForEnrichment {
  const data = doc.data();
  const pathSegments = doc.ref.path.split("/");
  const userId = pathSegments[1] ?? "";

  return {
    id: doc.id,
    userId,
    title: typeof data.title === "string" ? data.title : undefined,
    url: typeof data.source_url === "string" ? data.source_url : null,
    canonicalUrl: typeof data.canonical_url === "string" ? data.canonical_url : null,
    type: typeof data.type === "string" ? data.type : null,
    provider: typeof data.provider === "string" ? data.provider : null,
    metadata:
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {},
    enriched: data.enriched === true,
    tmdb: data.tmdb ?? null,
  };
}
