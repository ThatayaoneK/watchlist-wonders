import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import {
  BookmarkV2Schema,
  SourcePlatformSchema,
  type BookmarkV2,
  type MediaType,
} from "@watchmarks/shared";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function url(value: unknown): string | null {
  const candidate = text(value, 2048);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: unknown): number | null {
  const parsed = number(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function timestamp(value: unknown, fallback: Timestamp): Timestamp {
  if (value instanceof Timestamp) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return Timestamp.fromDate(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return Timestamp.fromDate(parsed);
  }
  const data = record(value);
  const seconds = integer(data.seconds ?? data._seconds);
  const nanoseconds = integer(data.nanoseconds ?? data._nanoseconds) ?? 0;
  return seconds === null ? fallback : new Timestamp(seconds, nanoseconds);
}

function nullableTimestamp(value: unknown): Timestamp | null {
  if (value == null) return null;
  const fallback = Timestamp.fromMillis(0);
  const parsed = timestamp(value, fallback);
  return parsed.toMillis() === 0 && value !== fallback ? null : parsed;
}

function strings(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean))].slice(0, maxItems);
}

function sourcePlatform(value: unknown): BookmarkV2["source"]["platform"] {
  const parsed = SourcePlatformSchema.safeParse(value);
  return parsed.success ? parsed.data : "generic";
}

function mediaType(value: unknown): MediaType {
  if (value === "doc") return "documentary";
  if (value === "tv") return "series";
  if (value === "movie" || value === "series" || value === "episode"
    || value === "video" || value === "documentary" || value === "other") return value;
  return "other";
}

function libraryState(value: unknown): BookmarkV2["library"]["state"] {
  if (value === "watching") return "watching";
  if (value === "done" || value === "watched") return "watched";
  if (value === "dropped") return "dropped";
  return "saved";
}

function queueState(value: unknown): BookmarkV2["library"]["queueState"] {
  return value === "up_next" || value === "in_progress" || value === "completed" ? value : "queued";
}

function resolutionStatus(value: unknown, enriched: unknown): BookmarkV2["resolution"]["status"] {
  if (value === "matched" || value === "needs_selection" || value === "unresolved" || value === "failed") return value;
  return enriched === true ? "unresolved" : "pending";
}

function availability(raw: unknown): BookmarkV2["availability"] {
  const data = record(raw);
  if (!Object.keys(data).length) return null;
  const providers = Array.isArray(data.providers) ? data.providers.flatMap((item) => {
    const provider = record(item);
    const providerUrl = url(provider.url);
    const providerId = integer(provider.providerId);
    const name = text(provider.name, 200);
    const region = text(provider.region, 8);
    const type = provider.type;
    if (!providerUrl || !providerId || !name || !region
      || (type !== "subscription" && type !== "rent" && type !== "buy")) return [];
    const providerType: "subscription" | "rent" | "buy" = type;
    return [{
      name,
      type: providerType,
      url: providerUrl,
      region,
      providerId,
      logoUrl: url(provider.logoUrl),
      score: number(provider.score) ?? 0,
      leavingDate: text(provider.leaving_date ?? provider.leavingDate, 40),
    }];
  }) : [];
  const status = data.status === "ok" || data.status === "no_providers" || data.status === "error"
    ? data.status
    : data.status === "no_tmdb_match" ? "no_match" : "error";
  const lastUpdated = text(data.lastUpdated, 40);
  const region = text(data.region, 8);
  if (!lastUpdated || !region || !Number.isFinite(Date.parse(lastUpdated))) return null;
  const externalId = integer(data.externalId ?? data.tmdbId);
  return { providers, lastUpdated: new Date(lastUpdated).toISOString(), region, externalId: externalId ? String(externalId) : null, status };
}

export function legacyBookmarkHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function convertBookmarkToV2(raw: unknown, ownerId: string, now = Timestamp.now()): BookmarkV2 {
  const current = BookmarkV2Schema.safeParse(raw);
  if (current.success) return current.data;

  const data = record(raw);
  const metadata = record(data.metadata);
  const canonical = record(data.canonical_entity);
  const tmdb = record(data.tmdb);
  const title = text(data.title, 300);
  if (!title) throw new Error("missing_title");

  const externalIdValue = canonical.id ?? metadata.tmdb_id ?? metadata.tmdbId ?? tmdb.tmdbId;
  const externalId = text(String(externalIdValue ?? ""), 200);
  const resolutionProvider = externalId
    ? (canonical.source === "youtube" ? "youtube" : "tmdb")
    : null;
  const confidence = number(canonical.confidence ?? metadata.resolution_confidence);
  const createdAt = timestamp(data.created_at ?? data.createdAt, now);
  const updatedAt = timestamp(data.updated_at ?? data.updatedAt, createdAt);
  const nestedSource = record(data.source);
  const sourceUrl = url(data.source_url ?? nestedSource.originalUrl);
  const canonicalUrl = url(data.canonical_url ?? nestedSource.canonicalUrl ?? tmdb.canonicalUrl);
  const legacyAvailability = data.availability ?? metadata.availability;
  const rating = integer(data.user_rating);
  const progress = Math.min(100, Math.max(0, number(data.progress_percent) ?? 0));
  const releaseYear = integer(data.release_year ?? tmdb.releaseYear ?? canonical.year);
  const runtimeMinutes = integer(data.runtime_minutes ?? tmdb.runtimeMinutes ?? canonical.runtime);

  const v2: BookmarkV2 = {
    schemaVersion: 2,
    ownerId,
    source: {
      originalUrl: sourceUrl,
      canonicalUrl,
      platform: sourcePlatform(data.provider),
      rawTitle: text(metadata.raw_title ?? metadata.share_raw_title ?? title, 500),
      capturedAt: timestamp(metadata.capture_received_at ?? metadata.share_received_at, createdAt),
      captureId: text(data.capture_id ?? metadata.capture_id, 128),
    },
    media: {
      type: mediaType(data.type ?? canonical.type ?? tmdb.mediaType),
      title,
      posterUrl: url(data.poster_url ?? tmdb.posterUrl ?? canonical.poster),
      backdropUrl: url(data.backdrop_url ?? tmdb.backdropUrl),
      releaseYear: releaseYear && releaseYear >= 1880 && releaseYear <= 2200 ? releaseYear : null,
      runtimeMinutes: runtimeMinutes && runtimeMinutes > 0 && runtimeMinutes <= 10000 ? runtimeMinutes : null,
    },
    resolution: {
      status: resolutionStatus(metadata.resolution_status, data.enriched),
      provider: resolutionProvider,
      externalId,
      confidence: confidence === null ? null : Math.min(1, Math.max(0, confidence)),
      version: Math.max(1, integer(data.resolution_version) ?? 1),
      ...(Array.isArray(metadata.match_candidates)
        ? { candidates: metadata.match_candidates.filter((item) => Object.keys(record(item)).length).slice(0, 20).map(record) }
        : {}),
      ...(metadata.resolution_selected_by === "auto" || metadata.resolution_selected_by === "user" || metadata.resolution_selected_by === "manual"
        ? { selectedBy: metadata.resolution_selected_by }
        : {}),
    },
    library: {
      state: libraryState(data.status),
      scheduledAt: nullableTimestamp(data.scheduled_at),
      progressPercent: progress,
      priority: number(data.priority) ?? 100,
      queueState: queueState(data.queue_status),
      tags: strings(data.tags, 30, 40),
      moodTags: strings(data.mood_tags, 25, 40),
      notes: text(data.notes, 5000),
      rating: rating && rating >= 1 && rating <= 5 ? rating : null,
      review: text(data.user_review, 5000),
      watchedAt: nullableTimestamp(data.watched_at),
      lastShownAt: nullableTimestamp(data.last_shown_at),
      shownCount: Math.max(0, integer(data.shown_count) ?? 0),
      episodesWatched: Math.max(0, integer(metadata.episodes_watched) ?? 0),
      totalEpisodes: integer(metadata.total_episodes),
      trailerUrl: url(metadata.trailer_url ?? metadata.youtube_trailer_url),
      watchedWith: text(metadata.watched_with, 200),
    },
    visibility: {
      isPublic: data.is_public === true,
      isVaulted: data.is_vaulted === true,
      shareToken: text(data.share_token, 200),
    },
    availability: availability(legacyAvailability),
    intelligence: {
      autoTags: strings(data.auto_tags, 50, 80),
      embeddingRef: text(data.embedding_ref, 500),
      fingerprint: Object.keys(record(data.fingerprint)).length ? record(data.fingerprint) : null,
      clusterId: text(data.cluster_id, 200),
      importanceScore: number(data.importance_score),
      pendingClusterAssignment: data.pending_cluster_assignment === true,
      pipelineVersion: Math.max(0, integer(data.pipeline_version) ?? 0),
      lastViewedAt: nullableTimestamp(data.last_viewed_at),
      viewCount: Math.max(0, integer(data.view_count) ?? 0),
    },
    createdAt,
    updatedAt,
  };

  const result = BookmarkV2Schema.safeParse(v2);
  if (!result.success) throw new Error(`invalid_v2:${result.error.issues.map((issue) => issue.path.join(".")).join(",")}`);
  return result.data;
}
