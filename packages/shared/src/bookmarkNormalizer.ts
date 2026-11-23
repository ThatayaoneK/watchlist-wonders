import type { Bookmark } from "./database";
import { BookmarkV2Schema, type BookmarkV2 } from "./bookmark";
import { z } from "zod";

const bookmarkFingerprintSchema = z.object({
  text_embedding_id: z.string().min(1),
  image_embedding_id: z.string().nullable().optional(),
  extracted_keywords: z.array(z.string()),
  platform: z.string().min(1),
});

const canonicalEntitySchema = z.object({
  source: z.enum(["tmdb", "imdb", "youtube", "spotify", "unresolved"]),
  id: z.string().min(1),
  type: z.enum(["movie", "tv", "anime", "music", "clip", "meme", "article", "unknown"]),
  title: z.string().min(1),
  year: z.number().nullable().optional(),
  genres: z.array(z.string()).optional(),
  runtime: z.number().nullable().optional(),
  poster: z.string().nullable().optional(),
  confidence: z.number(),
  matched_at: z.string().min(1),
  suggested: z.boolean().optional(),
});

function validateFingerprint(value: unknown): Bookmark["fingerprint"] | null {
  const record = asOptionalRecord(value);
  if (!record) return null;
  const result = bookmarkFingerprintSchema.safeParse(record);
  return result.success ? (result.data as Bookmark["fingerprint"]) : null;
}

function validateCanonicalEntity(value: unknown): Bookmark["canonical_entity"] | null {
  const record = asOptionalRecord(value);
  if (!record) return null;
  const result = canonicalEntitySchema.safeParse(record);
  return result.success ? (result.data as Bookmark["canonical_entity"]) : null;
}

const KNOWN_STATUSES = new Set<Bookmark["status"]>([
  "backlog",
  "scheduled",
  "watching",
  "done",
  "dropped",
]);

const KNOWN_QUEUE_STATUSES = new Set<NonNullable<Bookmark["queue_status"]>>([
  "queued",
  "up_next",
  "in_progress",
  "completed",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = asFiniteNumber(value);
  if (parsed === null) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asIsoString(value: unknown, fallback: string | null = null): string | null {
  const direct = asTrimmedString(value);
  if (direct) return direct;

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  const record = asRecord(value);
  const toDate = record.toDate;
  if (typeof toDate === "function") {
    try {
      const dateValue = toDate.call(value);
      if (dateValue instanceof Date && Number.isFinite(dateValue.getTime())) {
        return dateValue.toISOString();
      }
    } catch {
      // Ignore invalid Timestamp-like objects.
    }
  }

  const seconds = asFiniteNumber(record.seconds);
  if (seconds !== null) {
    const nanoseconds = asFiniteNumber(record.nanoseconds) ?? 0;
    const dateValue = new Date(seconds * 1000 + nanoseconds / 1_000_000);
    if (Number.isFinite(dateValue.getTime())) {
      return dateValue.toISOString();
    }
  }

  return fallback;
}

function normalizeStatus(value: unknown): Bookmark["status"] {
  return typeof value === "string" && KNOWN_STATUSES.has(value as Bookmark["status"])
    ? (value as Bookmark["status"])
    : "backlog";
}

function normalizeQueueStatus(value: unknown, status: Bookmark["status"]): Bookmark["queue_status"] {
  if (typeof value === "string" && KNOWN_QUEUE_STATUSES.has(value as NonNullable<Bookmark["queue_status"]>)) {
    return value as Bookmark["queue_status"];
  }
  if (status === "done") return "completed";
  if (status === "watching") return "in_progress";
  return "queued";
}

function clampPercent(value: unknown): number {
  const parsed = asFiniteNumber(value);
  if (parsed === null) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function legacyStatus(bookmark: BookmarkV2): Bookmark["status"] {
  if (bookmark.library.state === "watching") return "watching";
  if (bookmark.library.state === "watched") return "done";
  if (bookmark.library.state === "dropped") return "dropped";
  return bookmark.library.scheduledAt ? "scheduled" : "backlog";
}

function legacyMediaType(type: BookmarkV2["media"]["type"]): Bookmark["type"] {
  return type === "documentary" ? "doc" : type;
}

function normalizeBookmarkV2(id: string, raw: unknown): Bookmark {
  const parsed = BookmarkV2Schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Bookmark ${id} has an invalid v2 schema: ${parsed.error.issues[0]?.message ?? "unknown validation error"}`);
  }

  const data = parsed.data;
  const createdAt = asIsoString(data.createdAt, new Date().toISOString()) ?? new Date().toISOString();
  const updatedAt = asIsoString(data.updatedAt, createdAt) ?? createdAt;
  const externalId = data.resolution.externalId;
  const numericExternalId = data.resolution.provider === "tmdb" && externalId && /^\d+$/.test(externalId) ? Number(externalId) : null;
  const metadata: Bookmark["metadata"] = {
    ...(numericExternalId ? { tmdb_id: numericExternalId } : {}),
    resolution_status: data.resolution.status === "pending" || data.resolution.status === "failed"
      ? "unresolved"
      : data.resolution.status,
    resolution_confidence: data.resolution.confidence ?? undefined,
    resolution_requires_selection: data.resolution.status === "needs_selection",
    resolution_selected_by: data.resolution.selectedBy ?? undefined,
    match_candidates: data.resolution.candidates ?? [],
    episodes_watched: data.library.episodesWatched ?? undefined,
    total_episodes: data.library.totalEpisodes ?? undefined,
    trailer_url: data.library.trailerUrl ?? undefined,
    watched_with: data.library.watchedWith ?? undefined,
  };
  const availability: Bookmark["availability"] = data.availability
    ? {
        providers: data.availability.providers.map((provider) => ({
          ...provider,
          leaving_date: provider.leavingDate ?? null,
        })),
        lastUpdated: data.availability.lastUpdated,
        region: data.availability.region,
        tmdbId: data.availability.externalId && /^\d+$/.test(data.availability.externalId)
          ? Number(data.availability.externalId)
          : null,
        status: data.availability.status === "no_match" ? "no_tmdb_match" as const : data.availability.status,
      }
    : null;

  return {
    id,
    user_id: data.ownerId,
    title: data.media.title,
    type: legacyMediaType(data.media.type),
    provider: data.source.platform,
    source_url: data.source.originalUrl,
    canonical_url: data.source.canonicalUrl,
    platform_label: null,
    status: legacyStatus(data),
    runtime_minutes: data.media.runtimeMinutes,
    release_year: data.media.releaseYear,
    poster_url: data.media.posterUrl,
    backdrop_url: data.media.backdropUrl,
    tags: data.library.tags,
    mood_tags: data.library.moodTags,
    notes: data.library.notes,
    metadata,
    last_shown_at: asIsoString(data.library.lastShownAt),
    shown_count: data.library.shownCount,
    created_at: createdAt,
    updated_at: updatedAt,
    user_rating: data.library.rating,
    user_review: data.library.review,
    watched_at: asIsoString(data.library.watchedAt),
    is_public: data.visibility.isPublic,
    share_token: data.visibility.shareToken ?? undefined,
    is_vaulted: data.visibility.isVaulted,
    priority: data.library.priority,
    queue_status: data.library.queueState,
    progress_percent: data.library.progressPercent,
    availability,
    enriched: data.resolution.status !== "pending",
    enriched_at: data.resolution.status !== "pending" ? updatedAt : null,
    enrich_fail_reason: data.resolution.status === "failed" ? "resolution_failed" : null,
    tmdb: null,
    auto_tags: data.intelligence.autoTags,
    embedding_ref: data.intelligence.embeddingRef,
    fingerprint: data.intelligence.fingerprint as Bookmark["fingerprint"],
    canonical_entity: data.resolution.status === "matched" && externalId
      ? {
          source: data.resolution.provider ?? "unresolved",
          id: externalId,
          type: data.media.type === "series" ? "tv" : data.media.type === "movie" ? "movie" : "unknown",
          title: data.media.title,
          year: data.media.releaseYear,
          runtime: data.media.runtimeMinutes,
          poster: data.media.posterUrl,
          confidence: data.resolution.confidence ?? 0,
          matched_at: updatedAt,
          suggested: false,
        }
      : null,
    cluster_id: data.intelligence.clusterId,
    last_viewed_at: asIsoString(data.intelligence.lastViewedAt),
    view_count: data.intelligence.viewCount,
    importance_score: data.intelligence.importanceScore ?? undefined,
    pending_cluster_assignment: data.intelligence.pendingClusterAssignment,
    pipeline_version: data.intelligence.pipelineVersion,
  };
}

export function normalizeBookmark(id: string, raw: unknown): Bookmark {
  const data = asRecord(raw);
  if (data.schemaVersion === 2) return normalizeBookmarkV2(id, raw);
  const now = new Date().toISOString();
  const status = normalizeStatus(data.status);
  const createdAt = asIsoString(data.created_at ?? data.createdAt, now) ?? now;
  const updatedAt = asIsoString(data.updated_at ?? data.updatedAt, createdAt) ?? createdAt;

  const metadata = asRecord(data.metadata);
  const availability =
    (asOptionalRecord(data.availability) ?? asOptionalRecord(metadata.availability)) as
      | Bookmark["availability"]
      | undefined;
  const tmdb = (asOptionalRecord(data.tmdb) ?? null) as Bookmark["tmdb"] | null;
  const enrichedAt = asIsoString(data.enriched_at ?? data.enrichedAt);
  const enrichFailReason = asTrimmedString(data.enrich_fail_reason ?? data.enrichFailReason);
  const enriched =
    typeof data.enriched === "boolean"
      ? data.enriched
      : tmdb !== null || enrichedAt !== null;

  return {
    id,
    user_id: asTrimmedString(data.user_id) ?? "",
    title: asTrimmedString(data.title) ?? "Untitled",
    type: (asTrimmedString(data.type) ?? "other") as Bookmark["type"],
    provider: (asTrimmedString(data.provider) ?? "generic") as Bookmark["provider"],
    source_url: asTrimmedString(data.source_url),
    canonical_url: asTrimmedString(data.canonical_url),
    platform_label: asTrimmedString(data.platform_label),
    status,
    runtime_minutes: asFiniteNumber(data.runtime_minutes),
    release_year: asFiniteNumber(data.release_year),
    poster_url: asTrimmedString(data.poster_url),
    backdrop_url: asTrimmedString(data.backdrop_url),
    tags: asStringArray(data.tags),
    mood_tags: asStringArray(data.mood_tags),
    notes: asTrimmedString(data.notes),
    metadata,
    last_shown_at: asIsoString(data.last_shown_at),
    shown_count: asNonNegativeInteger(data.shown_count, 0),
    created_at: createdAt,
    updated_at: updatedAt,
    user_rating: asFiniteNumber(data.user_rating),
    user_review: asTrimmedString(data.user_review),
    watched_at: asIsoString(data.watched_at),
    is_public: asBoolean(data.is_public),
    share_token: asTrimmedString(data.share_token) ?? undefined,
    is_vaulted: asBoolean(data.is_vaulted),
    priority: asFiniteNumber(data.priority) ?? 100,
    queue_status: normalizeQueueStatus(data.queue_status, status),
    progress_percent: clampPercent(data.progress_percent),
    availability: availability ?? null,
    enriched,
    enriched_at: enrichedAt,
    enrich_fail_reason: enrichFailReason,
    tmdb,
    auto_tags: asStringArray(data.auto_tags),
    embedding_ref: asTrimmedString(data.embedding_ref),
    fingerprint: validateFingerprint(data.fingerprint),
    canonical_entity: validateCanonicalEntity(data.canonical_entity),
    cluster_id: asTrimmedString(data.cluster_id),
    last_viewed_at: asIsoString(data.last_viewed_at),
    view_count: asNonNegativeInteger(data.view_count, 0),
    importance_score: asFiniteNumber(data.importance_score) ?? undefined,
    pending_cluster_assignment: asBoolean(data.pending_cluster_assignment),
    pipeline_version: asFiniteNumber(data.pipeline_version) ?? undefined,
  };
}

