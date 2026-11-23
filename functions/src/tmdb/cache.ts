import { getFirestore } from "firebase-admin/firestore";
import type { TmdbCacheEntry, TmdbEnrichment } from "./types";

const CACHE_TTL_DAYS = 7;
const CACHE_COLLECTION = "tmdbCache";

const cacheKey = (tmdbId: number, mediaType: "movie" | "tv") => `${mediaType}:${tmdbId}`;

export async function getCached(
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<TmdbEnrichment | null> {
  const db = getFirestore();
  const key = cacheKey(tmdbId, mediaType);

  try {
    const snapshot = await db.collection(CACHE_COLLECTION).doc(key).get();
    if (!snapshot.exists) return null;

    const entry = snapshot.data() as TmdbCacheEntry;
    const expiresAt = new Date(entry.expiresAt);
    if (expiresAt < new Date()) {
      await snapshot.ref.delete();
      return null;
    }

    return entry.enrichment;
  } catch (error) {
    console.warn(`[tmdbCache] getCached failed for ${key}:`, error);
    return null;
  }
}

export async function setCached(
  tmdbId: number,
  mediaType: "movie" | "tv",
  enrichment: TmdbEnrichment,
): Promise<void> {
  const db = getFirestore();
  const key = cacheKey(tmdbId, mediaType);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  const entry: TmdbCacheEntry = {
    tmdbId,
    mediaType,
    enrichment,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  try {
    await db.collection(CACHE_COLLECTION).doc(key).set(entry, { merge: true });
  } catch (error) {
    console.warn(`[tmdbCache] setCached failed for ${key}:`, error);
  }
}
