import { createHash } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  isCaptureSurface,
  type CaptureMatchCandidate,
  type CaptureShareResult,
  type CaptureStatus,
  type CaptureSurface,
} from "@watchmarks/shared";
import {
  runEnrichmentRequest,
  tmdbApiKey,
  type EnrichResponse,
  youtubeApiKey,
} from "./enrich";
import { incrementMetric } from "./admin/metrics";
import { convertBookmarkToV2 } from "./bookmarkV2";

type CaptureShareRequest = {
  url?: unknown;
  text?: unknown;
  title?: unknown;
  surface?: unknown;
  clientTimestamp?: unknown;
  deviceId?: unknown;
};

const PROVIDER_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X / Twitter",
  tiktok: "TikTok",
  reddit: "Reddit",
  letterboxd: "Letterboxd",
  rottentomatoes: "Rotten Tomatoes",
  netflix: "Netflix",
  imdb: "IMDb",
  generic: "the web",
};

const GENRE_ALIASES: Record<string, string> = {
  "science fiction": "scifi",
  "sci-fi": "scifi",
  "sci-fi fantasy": "scifi",
  "action adventure": "action",
  "war politics": "war",
  "tv movie": "movie",
  kids: "family",
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asSurface(value: unknown): CaptureSurface {
  return typeof value === "string" && isCaptureSurface(value)
    ? (value as CaptureSurface)
    : "pwa_share_target";
}

export function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  if (!match?.[0]) return null;
  return match[0].replace(/[.,!?]+$/, "");
}

function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, "").toLowerCase();
}

function normalizeHashtags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 16) break;
  }
  return tags;
}

function normalizeGenreTag(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s&-]/g, "")
    .replace(/\s+/g, " ")
    .replace(/&/g, " ");
  return GENRE_ALIASES[normalized] ?? normalized.replace(/\s+/g, "");
}

function mapGenresToMoodTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const moodTags: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const value = normalizeGenreTag(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    moodTags.push(value);
    if (moodTags.length >= 8) break;
  }
  return moodTags;
}

export function bookmarkTypeFromResult(result: EnrichResponse, provider: string): string {
  if (result.contentType === "episode") return "episode";
  if (result.contentType === "series") return "series";
  if (result.contentType === "movie") return "movie";
  if (result.contentType === "video") return "video";
  if (result.mediaType === "tv") return "series";
  if (result.mediaType === "movie") return "movie";
  if (["youtube", "instagram", "facebook", "x", "tiktok"].includes(provider)) return "video";
  return "movie";
}

function tmdbCanonicalUrl(result: EnrichResponse): string | null {
  if (!result.tmdbId) return null;
  const mediaType = result.mediaType === "tv" ? "tv" : "movie";
  return `https://www.themoviedb.org/${mediaType}/${result.tmdbId}`;
}

export function fallbackTitle(sourceUrl: string | null, provider: string, sharedTitle: string | null): string {
  if (sharedTitle) return sharedTitle;
  try {
    if (sourceUrl) {
      const hostname = new URL(sourceUrl).hostname.replace(/^www\./i, "");
      return `Shared from ${provider !== "generic" ? PROVIDER_LABELS[provider] : hostname || PROVIDER_LABELS.generic}`;
    }
  } catch {
    // Ignore and fall through.
  }
  return `Shared from ${PROVIDER_LABELS[provider] ?? PROVIDER_LABELS.generic}`;
}

export function resolveCaptureStatus(result: EnrichResponse): CaptureStatus {
  if (result.resolutionStatus === "matched" && !result.requiresUserSelection && result.tmdbId) {
    return "auto_saved";
  }
  if ((result.matchCandidates?.length ?? 0) > 0) {
    return "needs_selection";
  }
  return "unresolved";
}

function buildTmdbEnrichment(result: EnrichResponse, now: string) {
  if (!result.tmdbId) return null;
  const mediaType = result.mediaType === "tv" ? "tv" : "movie";
  const title = result.title?.trim();
  if (!title) return null;
  return {
    tmdbId: result.tmdbId,
    mediaType,
    title,
    originalTitle: title,
    overview: result.description ?? null,
    posterPath: null,
    posterUrl: result.posterUrl ?? null,
    backdropPath: null,
    backdropUrl: result.backdropUrl ?? null,
    releaseDate: result.releaseYear ? `${result.releaseYear}-01-01` : null,
    releaseYear: result.releaseYear ?? null,
    rating: result.voteAverage ?? null,
    voteCount: null,
    popularity: null,
    genreIds: [],
    genres: Array.isArray(result.genres) ? result.genres.filter((genre): genre is string => typeof genre === "string") : [],
    runtimeMinutes: result.runtimeMinutes ?? null,
    trailerUrl: null,
    canonicalUrl: tmdbCanonicalUrl(result),
    streaming: {},
    enrichedAt: now,
  };
}

function buildCanonicalEntity(result: EnrichResponse, now: string) {
  if (!result.tmdbId || !result.title) return null;
  return {
    source: "tmdb",
    id: String(result.tmdbId),
    type: result.mediaType === "tv" ? "tv" : "movie",
    title: result.title,
    year: result.releaseYear ?? null,
    genres: Array.isArray(result.genres) ? result.genres.filter((genre): genre is string => typeof genre === "string") : [],
    runtime: result.runtimeMinutes ?? null,
    poster: result.posterUrl ?? null,
    confidence: result.confidenceScore ?? 1,
    matched_at: now,
    suggested: false,
  };
}

function buildCaptureMetadata(params: {
  result: EnrichResponse;
  status: CaptureStatus;
  surface: CaptureSurface;
  sourceUrl: string | null;
  sharedTitle: string | null;
  sharedText: string | null;
  now: string;
  clientTimestamp: string | null;
  deviceId: string | null;
  latencyMs: number | null;
}) {
  const {
    result,
    status,
    surface,
    sourceUrl,
    sharedTitle,
    sharedText,
    now,
    clientTimestamp,
    deviceId,
    latencyMs,
  } = params;

  const metadata: Record<string, unknown> = {
    share_target: surface === "pwa_share_target",
    share_raw_title: sharedTitle,
    share_raw_text: sharedText,
    share_received_at: now,
    capture_surface: surface,
    capture_received_at: now,
    capture_status: status,
    capture_source_platform: result.provider ?? "generic",
    capture_client_timestamp: clientTimestamp,
    capture_latency_ms: latencyMs,
    capture_device_id: deviceId,
    source_url_hash_basis: sourceUrl,
    ...(result.description ? { overview: result.description } : {}),
    ...(result.voteAverage !== undefined ? { vote_average: result.voteAverage } : {}),
    ...(result.genres?.length ? { genres: result.genres } : {}),
    ...(result.matchConfidence ? { match_confidence: result.matchConfidence } : {}),
    ...(result.resolutionStatus ? { resolution_status: result.resolutionStatus } : {}),
    ...(result.confidenceScore !== undefined ? { resolution_confidence: result.confidenceScore } : {}),
    ...(result.confidenceBand ? { resolution_confidence_band: result.confidenceBand } : {}),
    ...(typeof result.requiresUserSelection === "boolean"
      ? { resolution_requires_selection: result.requiresUserSelection }
      : {}),
    ...(result.matchCandidates?.length ? { match_candidates: result.matchCandidates } : {}),
  };

  if (result.tmdbId) {
    metadata.tmdb_id = result.tmdbId;
    metadata.media_type = result.mediaType === "tv" ? "tv" : "movie";
  }
  if (status === "auto_saved") {
    metadata.resolution_selected_by = "auto";
  }
  if (status !== "auto_saved") {
    metadata.raw_title = sharedTitle ?? result.title ?? null;
  }

  return metadata;
}

function toLatencyMs(clientTimestamp: string | null, nowMs: number): number | null {
  if (!clientTimestamp) return null;
  const parsed = Date.parse(clientTimestamp);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, nowMs - parsed);
}

async function findDuplicate(params: {
  uid: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  tmdbId: number | undefined;
}): Promise<{ id: string; title?: string; poster_url?: string | null } | null> {
  const { uid, sourceUrl, canonicalUrl, tmdbId } = params;
  const col = getFirestore().collection("users").doc(uid).collection("bookmarks");

  const summary = (found: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) => {
    const data = found.data() ?? {};
    const media = data.media && typeof data.media === "object" && !Array.isArray(data.media)
      ? data.media as Record<string, unknown>
      : {};
    return {
      id: found.id,
      title: typeof data.title === "string" ? data.title : typeof media.title === "string" ? media.title : undefined,
      poster_url: typeof data.poster_url === "string"
        ? data.poster_url
        : typeof media.posterUrl === "string" ? media.posterUrl : null,
    };
  };

  if (sourceUrl) {
    const bySource = await col.where("source_url", "==", sourceUrl).limit(1).get();
    const found = bySource.docs[0];
    if (found) return summary(found);
    const byV2Source = await col.where("source.originalUrl", "==", sourceUrl).limit(1).get();
    if (byV2Source.docs[0]) return summary(byV2Source.docs[0]);
  }

  if (tmdbId) {
    const byTmdb = await col.where("metadata.tmdb_id", "==", tmdbId).limit(1).get();
    const found = byTmdb.docs[0];
    if (found) return summary(found);
    const byV2ExternalId = await col.where("resolution.externalId", "==", String(tmdbId)).limit(1).get();
    if (byV2ExternalId.docs[0]) return summary(byV2ExternalId.docs[0]);
  }

  if (canonicalUrl && canonicalUrl !== sourceUrl) {
    const byCanonical = await col.where("canonical_url", "==", canonicalUrl).limit(1).get();
    const found = byCanonical.docs[0];
    if (found) return summary(found);
    const byV2Canonical = await col.where("source.canonicalUrl", "==", canonicalUrl).limit(1).get();
    if (byV2Canonical.docs[0]) return summary(byV2Canonical.docs[0]);
  }

  return null;
}

/**
 * Compute a deterministic dedup document ID for a new bookmark. When two
 * concurrent share-captures yield the same dedup ID, `.create()` will let
 * exactly one succeed — the loser hits `already-exists` and is reconciled
 * as a duplicate. Returns null when no strong identifier is available
 * (e.g. unresolved capture with no canonical URL); the caller falls back
 * to a random ID and there's nothing to race against.
 */
function computeDedupDocId(params: {
  tmdbId: number | undefined;
  mediaType: string | undefined;
  canonicalUrl: string | null;
  sourceUrl: string | null;
}): string | null {
  const { tmdbId, mediaType, canonicalUrl, sourceUrl } = params;
  if (tmdbId && mediaType) {
    return `tmdb_${mediaType}_${tmdbId}`;
  }
  const url = canonicalUrl ?? sourceUrl;
  if (url) {
    return `u_${createHash("sha256").update(url).digest("hex").slice(0, 24)}`;
  }
  return null;
}

function buildOpenTarget(bookmarkId: string, status: CaptureStatus) {
  return status === "auto_saved" || status === "duplicate"
    ? { route: "bookmark" as const, bookmarkId }
    : { route: "post_capture" as const, bookmarkId, status };
}

async function recordCaptureMetrics(surface: CaptureSurface, status: CaptureStatus): Promise<void> {
  await Promise.all([
    incrementMetric("capture.request"),
    incrementMetric(`capture.surface.${surface}`),
    incrementMetric(`capture.status.${status}`),
    incrementMetric(`capture.surface_status.${surface}.${status}`),
  ]);
}

export const captureShare = onCall<CaptureShareRequest, Promise<CaptureShareResult>>(
  { memory: "256MiB", timeoutSeconds: 30, secrets: [youtubeApiKey, tmdbApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const uid = request.auth.uid;
    const sharedUrl = asTrimmedString(request.data?.url);
    const sharedText = asTrimmedString(request.data?.text);
    const sharedTitle = asTrimmedString(request.data?.title);
    const surface = asSurface(request.data?.surface);
    const clientTimestamp = asTrimmedString(request.data?.clientTimestamp);
    const deviceId = asTrimmedString(request.data?.deviceId);
    const extractedUrl = sharedUrl ?? (sharedText ? extractUrlFromText(sharedText) : null);

    if (!extractedUrl && !sharedTitle && !sharedText) {
      throw new HttpsError("invalid-argument", "A shared URL, title, or text payload is required.");
    }

    const enrichmentInput = extractedUrl
      ? { url: extractedUrl }
      : { title: sharedTitle ?? sharedText ?? undefined };
    const result = await runEnrichmentRequest(enrichmentInput);
    const status = resolveCaptureStatus(result);
    const canonicalUrl = status === "auto_saved"
      ? tmdbCanonicalUrl(result)
      : result.canonicalUrl ?? extractedUrl;
    const duplicate = await findDuplicate({
      uid,
      sourceUrl: extractedUrl,
      canonicalUrl,
      tmdbId: result.tmdbId,
    });

    if (duplicate) {
      await recordCaptureMetrics(surface, "duplicate");
      return {
        status: "duplicate",
        bookmarkId: duplicate.id,
        duplicateOf: duplicate.id,
        resolvedTitle: typeof duplicate.title === "string" ? duplicate.title : result.title,
        extractedTitle: sharedTitle ?? result.title,
        provider: result.provider ?? "generic",
        posterUrl:
          typeof duplicate.poster_url === "string" ? duplicate.poster_url : (result.posterUrl ?? null),
        candidateCount: result.matchCandidates?.length ?? 0,
        candidates: (result.matchCandidates ?? []) as CaptureMatchCandidate[],
        message: "Already in your watchlist.",
        openTarget: buildOpenTarget(duplicate.id, "duplicate"),
      };
    }

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const db = getFirestore();
    const captureRef = db.collection("users").doc(uid).collection("captures").doc();
    const latencyMs = toLatencyMs(clientTimestamp, nowMs);
    const provider = result.provider ?? "generic";
    const bookmarkTitle =
      status === "auto_saved" && result.title
        ? result.title
        : sharedTitle ?? result.title ?? fallbackTitle(extractedUrl, provider, sharedTitle);
    const bookmarkType = bookmarkTypeFromResult(result, provider);
    const notes =
      sharedText && sharedText !== extractedUrl
        ? sharedText.slice(0, 500)
        : null;
    const metadata = buildCaptureMetadata({
      result,
      status,
      surface,
      sourceUrl: extractedUrl,
      sharedTitle,
      sharedText,
      now,
      clientTimestamp,
      deviceId,
      latencyMs,
    });
    const tags = normalizeHashtags(result.hashtags);
    const moodTags = mapGenresToMoodTags(result.genres);
    const tmdb = status === "auto_saved" ? buildTmdbEnrichment(result, now) : null;
    const canonicalEntity = status === "auto_saved" ? buildCanonicalEntity(result, now) : null;
    const legacyData = {
      capture_id: captureRef.id,
      title: bookmarkTitle,
      type: bookmarkType,
      provider,
      source_url: extractedUrl ?? null,
      canonical_url: canonicalUrl ?? null,
      platform_label: null,
      status: "backlog",
      runtime_minutes: status === "auto_saved" ? (result.runtimeMinutes ?? null) : null,
      release_year: status === "auto_saved" ? (result.releaseYear ?? null) : null,
      poster_url: result.posterUrl ?? null,
      backdrop_url: status === "auto_saved" ? (result.backdropUrl ?? null) : null,
      tags,
      mood_tags: moodTags,
      notes,
      metadata,
      user_id: uid,
      is_public: false,
      is_vaulted: false,
      last_shown_at: null,
      shown_count: 0,
      priority: 100,
      queue_status: "queued",
      progress_percent: 0,
      availability: null,
      enriched: status === "auto_saved",
      enriched_at: status === "auto_saved" ? now : null,
      enrich_fail_reason: status === "unresolved" ? "capture_unresolved" : null,
      tmdb,
      canonical_entity: canonicalEntity,
      created_at: now,
      updated_at: now,
    };
    const docData = convertBookmarkToV2(legacyData, uid, Timestamp.fromDate(new Date(now)));

    const bookmarksCol = getFirestore().collection("users").doc(uid).collection("bookmarks");
    const dedupId = computeDedupDocId({
      tmdbId: result.tmdbId,
      mediaType: result.mediaType,
      canonicalUrl,
      sourceUrl: extractedUrl,
    });

    // Race-free insert: when a deterministic id is available, .create() is
    // atomic — concurrent captures of the same item collapse to a single doc
    // with a clean `already-exists` signal on the loser.
    let bookmarkId: string;
    let collapsedDuplicate: { id: string; title?: string; poster_url?: string | null } | null = null;
    if (dedupId) {
      const ref = bookmarksCol.doc(dedupId);
      try {
        await ref.create(docData);
        bookmarkId = ref.id;
      } catch (err) {
        const code = (err as { code?: string | number })?.code;
        const isAlreadyExists =
          code === 6 /* gRPC ALREADY_EXISTS */ ||
          code === "already-exists" ||
          (err instanceof Error && /already exists/i.test(err.message));
        if (!isAlreadyExists) throw err;
        const existing = await ref.get();
        const data = existing.data() ?? {};
        const media = data.media && typeof data.media === "object" && !Array.isArray(data.media)
          ? data.media as Record<string, unknown>
          : {};
        bookmarkId = ref.id;
        collapsedDuplicate = {
          id: ref.id,
          title: typeof data.title === "string" ? data.title : typeof media.title === "string" ? media.title : undefined,
          poster_url: typeof data.poster_url === "string" ? data.poster_url : typeof media.posterUrl === "string" ? media.posterUrl : null,
        };
      }
    } else {
      const ref = await bookmarksCol.add(docData);
      bookmarkId = ref.id;
    }

    await captureRef.set({
      schemaVersion: 1,
      ownerId: uid,
      bookmarkId,
      surface,
      status: collapsedDuplicate ? "duplicate" : status,
      raw: {
        originalUrl: extractedUrl,
        sharedTitle,
        sharedText,
        clientTimestamp,
        deviceId,
      },
      extraction: {
        provider,
        title: result.title ?? null,
        canonicalUrl: result.canonicalUrl ?? null,
        contentType: result.contentType ?? null,
        mediaType: result.mediaType ?? null,
        confidence: result.confidenceScore ?? null,
        candidates: (result.matchCandidates ?? []).slice(0, 20),
      },
      createdAt: Timestamp.fromDate(new Date(now)),
      updatedAt: Timestamp.fromDate(new Date(now)),
    });

    if (collapsedDuplicate) {
      await recordCaptureMetrics(surface, "duplicate");
      return {
        status: "duplicate",
        bookmarkId: collapsedDuplicate.id,
        duplicateOf: collapsedDuplicate.id,
        resolvedTitle: collapsedDuplicate.title ?? result.title,
        extractedTitle: sharedTitle ?? result.title,
        provider,
        posterUrl: collapsedDuplicate.poster_url ?? result.posterUrl ?? null,
        candidateCount: result.matchCandidates?.length ?? 0,
        candidates: (result.matchCandidates ?? []) as CaptureMatchCandidate[],
        message: "Already in your watchlist.",
        openTarget: buildOpenTarget(collapsedDuplicate.id, "duplicate"),
      };
    }

    await recordCaptureMetrics(surface, status);
    return {
      status,
      bookmarkId,
      resolvedTitle: status === "auto_saved" ? result.title ?? bookmarkTitle : bookmarkTitle,
      extractedTitle: sharedTitle ?? result.title ?? undefined,
      provider,
      posterUrl: result.posterUrl ?? null,
      candidateCount: result.matchCandidates?.length ?? 0,
      candidates: (result.matchCandidates ?? []) as CaptureMatchCandidate[],
      message:
        status === "auto_saved"
          ? "Saved to your watchlist."
          : status === "needs_selection"
            ? "Choose the right title to finish matching."
            : "Saved for later review.",
      openTarget: buildOpenTarget(bookmarkId, status),
    };
  },
);
