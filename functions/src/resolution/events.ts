import { createHash } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { incrementMetric } from "../admin/metrics";
import type { ResolutionCandidate } from "../pipeline/types";

type ResolutionAction =
  | "auto_matched"
  | "needs_selection"
  | "unresolved"
  | "user_selected"
  | "user_skipped"
  | "manual";

type ResolutionEventInput = {
  userId: string;
  bookmarkId: string;
  action: ResolutionAction;
  status: "matched" | "needs_selection" | "unresolved";
  platform?: string | null;
  rawTitle?: string | null;
  sourceUrl?: string | null;
  confidence?: number | null;
  confidenceBand?: "high" | "medium" | "low" | null;
  candidates?: unknown[];
  selectedCandidate?: unknown | null;
  selectedRank?: number | null;
};

function urlHash(url: string | null | undefined): string | null {
  if (!url) return null;
  return createHash("sha1").update(url.trim().toLowerCase()).digest("hex");
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function candidateRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function normalizeCandidate(input: unknown): ResolutionCandidate | null {
  const candidate = candidateRecord(input);
  const tmdbId = asNumber(candidate.tmdbId ?? candidate.id);
  const title = asString(candidate.title);
  const mediaType =
    candidate.mediaType === "tv" || candidate.type === "tv"
      ? "tv"
      : candidate.mediaType === "movie" || candidate.type === "movie"
        ? "movie"
        : null;

  if (!tmdbId || !title || !mediaType) return null;

  const confidence = asNumber(candidate.score ?? candidate.confidence) ?? 1;
  return {
    source: "tmdb",
    id: String(Math.trunc(tmdbId)),
    tmdbId: Math.trunc(tmdbId),
    type: mediaType,
    title,
    year: asNumber(candidate.releaseYear ?? candidate.year),
    poster: asString(candidate.posterUrl ?? candidate.poster),
    confidence,
    scoreBreakdown: {
      title: asNumber(candidate.scoreBreakdown && candidateRecord(candidate.scoreBreakdown).title) ?? 0,
      year: asNumber(candidate.scoreBreakdown && candidateRecord(candidate.scoreBreakdown).year) ?? 0,
      popularity: asNumber(candidate.scoreBreakdown && candidateRecord(candidate.scoreBreakdown).popularity) ?? 0,
      embedding: asNumber(candidate.scoreBreakdown && candidateRecord(candidate.scoreBreakdown).embedding) ?? 0,
      total: confidence,
    },
  };
}

function summarizeCandidate(input: unknown): Record<string, unknown> | null {
  const normalized = normalizeCandidate(input);
  if (!normalized) return null;
  return {
    source: normalized.source,
    id: normalized.id,
    tmdbId: normalized.tmdbId,
    type: normalized.type,
    title: normalized.title,
    year: normalized.year,
    confidence: normalized.confidence,
  };
}

function toBookmarkType(candidate: Record<string, unknown>, mediaType: "movie" | "tv") {
  if (candidate.contentType === "episode") return "episode";
  if (candidate.contentType === "series") return "series";
  return mediaType === "tv" ? "series" : "movie";
}

function buildTmdbEnrichment(candidate: Record<string, unknown>, selectedAt: string) {
  const tmdbId = asNumber(candidate.tmdbId ?? candidate.id);
  const title = asString(candidate.title);
  const mediaType = candidate.mediaType === "tv" ? "tv" : "movie";
  if (!tmdbId || !title) return null;
  const releaseYear = asNumber(candidate.releaseYear ?? candidate.year);
  const posterUrl = asString(candidate.posterUrl ?? candidate.poster);
  const backdropUrl = asString(candidate.backdropUrl);
  return {
    tmdbId: Math.trunc(tmdbId),
    mediaType,
    title,
    originalTitle: title,
    overview: asString(candidate.description),
    posterPath: null,
    posterUrl,
    backdropPath: null,
    backdropUrl,
    releaseDate: releaseYear ? `${Math.trunc(releaseYear)}-01-01` : null,
    releaseYear: releaseYear ? Math.trunc(releaseYear) : null,
    rating: asNumber(candidate.voteAverage),
    voteCount: null,
    popularity: null,
    genreIds: [],
    genres: asStringArray(candidate.genres),
    runtimeMinutes: asNumber(candidate.runtimeMinutes),
    trailerUrl: null,
    canonicalUrl: `https://www.themoviedb.org/${mediaType}/${Math.trunc(tmdbId)}`,
    streaming: {},
    enrichedAt: selectedAt,
  };
}

export async function logResolutionEvent(input: ResolutionEventInput): Promise<void> {
  try {
    const candidates = (input.candidates ?? [])
      .map((candidate) => summarizeCandidate(candidate))
      .filter((candidate): candidate is Record<string, unknown> => candidate !== null)
      .slice(0, 8);
    await getFirestore().collection("resolutionEvents").add({
      user_id: input.userId,
      bookmark_id: input.bookmarkId,
      action: input.action,
      status: input.status,
      platform: input.platform ?? null,
      raw_title: input.rawTitle ?? null,
      url_hash: urlHash(input.sourceUrl),
      confidence: input.confidence ?? null,
      confidence_band: input.confidenceBand ?? null,
      candidate_count: candidates.length,
      candidates,
      selected_candidate: summarizeCandidate(input.selectedCandidate),
      selected_rank: input.selectedRank ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[resolutionEvents.log] failed", err instanceof Error ? err.message : err);
  }
}

export const selectResolutionCandidate = onCall<{
  bookmarkId?: string;
  action?: "selected" | "skipped" | "manual";
  candidate?: unknown;
}>(
  { timeoutSeconds: 20, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
    const uid = request.auth.uid;
    const bookmarkId = asString(request.data?.bookmarkId);
    if (!bookmarkId) throw new HttpsError("invalid-argument", "bookmarkId is required.");

    const action = request.data?.action ?? "selected";
    if (action !== "selected" && action !== "skipped" && action !== "manual") {
      throw new HttpsError("invalid-argument", "Unsupported resolution action.");
    }

    const ref = getFirestore().collection("users").doc(uid).collection("bookmarks").doc(bookmarkId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Bookmark not found.");
    const data = snap.data() ?? {};
    const metadata =
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {};
    const source = data.source && typeof data.source === "object" && !Array.isArray(data.source)
      ? data.source as Record<string, unknown> : {};
    const media = data.media && typeof data.media === "object" && !Array.isArray(data.media)
      ? data.media as Record<string, unknown> : {};
    const resolution = data.resolution && typeof data.resolution === "object" && !Array.isArray(data.resolution)
      ? data.resolution as Record<string, unknown> : {};
    const isV2 = data.schemaVersion === 2;
    const candidatesValue = isV2 ? resolution.candidates : metadata.match_candidates;
    const candidates = Array.isArray(candidatesValue) ? candidatesValue : [];
    const provider = asString(isV2 ? source.platform : data.provider) ?? null;
    const rawTitle = asString(isV2 ? source.rawTitle : metadata.raw_title) ?? asString(isV2 ? media.title : data.title);
    const sourceUrl = asString(isV2 ? source.originalUrl : data.source_url) ?? asString(isV2 ? source.canonicalUrl : data.canonical_url);

    if (action !== "selected") {
      await ref.update(isV2
        ? {
            updatedAt: Timestamp.now(),
            "resolution.status": action === "manual" ? "unresolved" : "needs_selection",
            "resolution.selectedBy": action === "manual" ? "manual" : null,
          }
        : {
            updated_at: new Date().toISOString(),
            "metadata.resolution_status": action === "manual" ? "unresolved" : "needs_selection",
            "metadata.resolution_selected_by": action === "manual" ? "manual" : null,
          });
      await incrementMetric(`resolution.user_${action}`);
      await logResolutionEvent({
        userId: uid,
        bookmarkId,
        action: action === "manual" ? "manual" : "user_skipped",
        status: action === "manual" ? "unresolved" : "needs_selection",
        platform: provider,
        rawTitle,
        sourceUrl,
        confidence: asNumber(isV2 ? resolution.confidence : metadata.resolution_confidence),
        confidenceBand: metadata.resolution_confidence_band === "high" || metadata.resolution_confidence_band === "medium" || metadata.resolution_confidence_band === "low"
          ? metadata.resolution_confidence_band
          : null,
        candidates,
      });
      return { ok: true };
    }

    const selectedRecord = candidateRecord(request.data?.candidate);
    const normalized = normalizeCandidate(selectedRecord);
    if (!normalized) throw new HttpsError("invalid-argument", "A valid TMDB candidate is required.");
    const selectedAt = new Date().toISOString();
    const mediaType = normalized.type;
    const tmdb = buildTmdbEnrichment(selectedRecord, selectedAt);
    const rank = Math.max(
      1,
      candidates.findIndex((candidate) => {
        const item = normalizeCandidate(candidate);
        return item?.tmdbId === normalized.tmdbId && item.type === normalized.type;
      }) + 1,
    );
    const candidateHistory = candidates.map((candidate, index) => ({
      ...candidateRecord(candidate),
      selected: index + 1 === rank,
    }));

    const legacySelection = {
        title: normalized.title,
        type: toBookmarkType(selectedRecord, mediaType),
        canonical_url: `https://www.themoviedb.org/${mediaType}/${normalized.tmdbId}`,
        poster_url: normalized.poster,
        backdrop_url: asString(selectedRecord.backdropUrl) ?? null,
        release_year: normalized.year,
        runtime_minutes: asNumber(selectedRecord.runtimeMinutes),
        updated_at: selectedAt,
        canonical_entity: {
          source: "tmdb",
          id: normalized.id,
          type: mediaType,
          title: normalized.title,
          year: normalized.year,
          genres: asStringArray(selectedRecord.genres),
          runtime: asNumber(selectedRecord.runtimeMinutes),
          poster: normalized.poster,
          confidence: normalized.confidence,
          matched_at: selectedAt,
          suggested: false,
        },
        enriched: true,
        enriched_at: selectedAt,
        enrich_fail_reason: null,
        tmdb,
        "metadata.tmdb_id": normalized.tmdbId,
        "metadata.media_type": mediaType,
        "metadata.match_confidence": "high",
        "metadata.resolution_status": "matched",
        "metadata.resolution_confidence": normalized.confidence,
        "metadata.resolution_confidence_band": "high",
        "metadata.resolution_requires_selection": false,
        "metadata.resolution_selected_by": "user",
        "metadata.resolution_selected_rank": rank,
        "metadata.resolution_selected_candidate": selectedRecord,
        "metadata.resolution_candidate_history": candidateHistory,
        ...(asString(selectedRecord.description) ? { "metadata.overview": asString(selectedRecord.description) } : {}),
        ...(asStringArray(selectedRecord.genres).length ? { "metadata.genres": asStringArray(selectedRecord.genres) } : {}),
        ...(asNumber(selectedRecord.voteAverage) !== null ? { "metadata.vote_average": asNumber(selectedRecord.voteAverage) } : {}),
      };
    const v2Selection = {
      "media.title": normalized.title,
      "media.type": toBookmarkType(selectedRecord, mediaType),
      "media.posterUrl": normalized.poster,
      "media.backdropUrl": asString(selectedRecord.backdropUrl) ?? null,
      "media.releaseYear": normalized.year,
      "media.runtimeMinutes": asNumber(selectedRecord.runtimeMinutes),
      "source.canonicalUrl": `https://www.themoviedb.org/${mediaType}/${normalized.tmdbId}`,
      "resolution.status": "matched",
      "resolution.provider": "tmdb",
      "resolution.externalId": String(normalized.tmdbId),
      "resolution.confidence": normalized.confidence,
      "resolution.selectedBy": "user",
      "resolution.candidates": candidateHistory,
      updatedAt: Timestamp.now(),
    };
    await ref.update(isV2 ? v2Selection : legacySelection);

    await incrementMetric("resolution.user_selected");
    await incrementMetric(`resolution.selected_rank.${rank}`);
    await logResolutionEvent({
      userId: uid,
      bookmarkId,
      action: "user_selected",
      status: "matched",
      platform: provider,
      rawTitle,
      sourceUrl,
      confidence: normalized.confidence,
      confidenceBand: "high",
      candidates,
      selectedCandidate: selectedRecord,
      selectedRank: rank,
    });
    return { ok: true };
  },
);
