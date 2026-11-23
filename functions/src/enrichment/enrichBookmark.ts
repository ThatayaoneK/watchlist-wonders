import { getFirestore } from "firebase-admin/firestore";
import { getCached, setCached } from "../tmdb/cache";
import { buildEnrichment, getDetails, pickBestMatch, searchMulti } from "../tmdb/client";
import { normalizeTitle } from "../tmdb/titleNormalizer";
import type { BookmarkForEnrichment, TmdbEnrichment } from "../tmdb/types";

export type EnrichmentResult =
  | { status: "enriched"; tmdb: TmdbEnrichment }
  | { status: "no_match"; reason: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

export async function enrichBookmark(
  bookmark: BookmarkForEnrichment,
  apiKey: string,
): Promise<EnrichmentResult> {
  if (bookmark.enriched && bookmark.tmdb) {
    return { status: "skipped", reason: "already_enriched" };
  }

  const rawTitle = resolveRawTitle(bookmark);
  const normalized = normalizeTitle(rawTitle);

  if (!normalized.cleanTitle) {
    await markResolved(bookmark, null, "no_title");
    return { status: "no_match", reason: "no_title" };
  }

  if (!normalized.isLikelyMedia) {
    await markResolved(bookmark, null, "not_media");
    return { status: "no_match", reason: "not_media" };
  }

  try {
    const searchResponse = await searchMulti(apiKey, normalized.cleanTitle);
    if (!searchResponse?.results?.length) {
      await markResolved(bookmark, null, "no_tmdb_results");
      return { status: "no_match", reason: `no_tmdb_results:${normalized.cleanTitle}` };
    }

    const match = pickBestMatch(searchResponse.results, normalized.cleanTitle);
    if (!match || (match.media_type !== "movie" && match.media_type !== "tv")) {
      await markResolved(bookmark, null, "low_confidence_match");
      return { status: "no_match", reason: `low_confidence:${normalized.cleanTitle}` };
    }

    const mediaType = match.media_type;
    let enrichment = await getCached(match.id, mediaType);
    if (!enrichment) {
      const details = await getDetails(apiKey, match.id, mediaType);
      enrichment = buildEnrichment(match, details);
      await setCached(match.id, mediaType, enrichment);
    }

    await markResolved(bookmark, enrichment, null);
    return { status: "enriched", tmdb: enrichment };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[enrichBookmark] ${bookmark.id} failed:`, message);
    await markResolved(bookmark, null, `error: ${message}`);
    return { status: "error", error: message };
  }
}

function resolveRawTitle(bookmark: BookmarkForEnrichment): string {
  const metadata = bookmark.metadata ?? {};

  return firstNonEmpty(
    bookmark.title,
    asString(metadata.ogTitle),
    asString(metadata.og_title),
    asString(metadata.oembedTitle),
    asString(metadata.oembed_title),
    asString(metadata.title),
  );
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function markResolved(
  bookmark: BookmarkForEnrichment,
  tmdb: TmdbEnrichment | null,
  failReason: string | null,
): Promise<void> {
  const db = getFirestore();
  const ref = db
    .collection("users")
    .doc(bookmark.userId)
    .collection("bookmarks")
    .doc(bookmark.id);

  const now = new Date().toISOString();

  if (!tmdb) {
    await ref.update({
      enriched: true,
      enriched_at: now,
      enrich_fail_reason: failReason,
      tmdb: null,
      updated_at: now,
    });
    return;
  }

  const bookmarkType = tmdb.mediaType === "tv" ? "series" : "movie";

  await ref.update({
    title: tmdb.title,
    type: bookmarkType,
    canonical_url: bookmark.canonicalUrl ?? tmdb.canonicalUrl,
    runtime_minutes: tmdb.runtimeMinutes,
    release_year: tmdb.releaseYear,
    poster_url: tmdb.posterUrl,
    backdrop_url: tmdb.backdropUrl,
    enriched: true,
    enriched_at: now,
    enrich_fail_reason: null,
    tmdb,
    updated_at: now,
    "metadata.tmdb_id": tmdb.tmdbId,
    "metadata.media_type": tmdb.mediaType,
    "metadata.poster_url": tmdb.posterUrl,
    "metadata.backdrop_url": tmdb.backdropUrl,
    "metadata.overview": tmdb.overview,
    "metadata.vote_average": tmdb.rating,
    "metadata.vote_count": tmdb.voteCount,
    "metadata.popularity": tmdb.popularity,
    "metadata.genre_ids": tmdb.genreIds,
    "metadata.genres": tmdb.genres,
    "metadata.runtime_minutes": tmdb.runtimeMinutes,
    "metadata.release_date": tmdb.releaseDate,
    "metadata.trailer_url": tmdb.trailerUrl,
    "metadata.canonical_url": tmdb.canonicalUrl,
    "metadata.streaming": tmdb.streaming,
  });
}
