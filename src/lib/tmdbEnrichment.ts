import type {
  Bookmark,
  TmdbEnrichment,
  TmdbStreamingAvailability,
  TmdbStreamingProvider,
} from "@/types/database";

type BookmarkCreateDraft = Partial<Bookmark> & {
  title: string;
  metadata?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
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
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function readTmdbId(metadata?: Record<string, unknown> | null): number | null {
  if (!metadata) return null;
  const id = asNumber(metadata.tmdb_id ?? metadata.tmdbId);
  if (id === null || id <= 0) return null;
  return Math.trunc(id);
}

function toMediaType(
  type: Bookmark["type"] | undefined,
  metadata?: Record<string, unknown> | null,
): "movie" | "tv" | null {
  const explicit = asString(metadata?.media_type)?.toLowerCase();
  if (explicit === "movie" || explicit === "tv") return explicit;

  if (type === "series" || type === "episode") return "tv";
  if (type === "movie") return "movie";
  return null;
}

function toNullableInt(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function toStreamingProvider(value: unknown): TmdbStreamingProvider | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = asNumber(record.id ?? record.provider_id);
  const name = asString(record.name ?? record.provider_name);
  if (id === null || !name) return null;

  return {
    id: Math.trunc(id),
    name,
    logoPath: asString(record.logoPath ?? record.logo_path),
    logoUrl: asString(record.logoUrl),
  };
}

function toStreamingAvailability(value: unknown): TmdbStreamingAvailability | null {
  const record = asRecord(value);
  if (!record) return null;

  const mapProviders = (input: unknown): TmdbStreamingProvider[] => {
    if (!Array.isArray(input)) return [];
    return input
      .map((item) => toStreamingProvider(item))
      .filter((item): item is TmdbStreamingProvider => item !== null);
  };

  return {
    flatrate: mapProviders(record.flatrate),
    rent: mapProviders(record.rent),
    buy: mapProviders(record.buy),
    free: mapProviders(record.free),
    link: asString(record.link) ?? "",
  };
}

function normalizeStreamingMap(value: unknown): Record<string, TmdbStreamingAvailability> {
  const record = asRecord(value);
  if (!record) return {};

  const entries = Object.entries(record)
    .map(([region, availability]) => {
      const normalized = toStreamingAvailability(availability);
      if (!normalized) return null;
      return [region.toUpperCase(), normalized] as const;
    })
    .filter((entry): entry is readonly [string, TmdbStreamingAvailability] => entry !== null);

  return Object.fromEntries(entries);
}

function deriveReleaseDate(
  releaseYear: number | null,
  metadata?: Record<string, unknown> | null,
): string | null {
  const direct = asString(metadata?.release_date ?? metadata?.first_air_date);
  if (direct) return direct;
  if (releaseYear !== null) return `${releaseYear}-01-01`;
  return null;
}

export function buildTmdbEnrichmentFromDraft(
  draft: BookmarkCreateDraft,
  enrichedAt = new Date().toISOString(),
): TmdbEnrichment | { success: false; failReason: string } {
  const metadata = draft.metadata ?? {};
  const tmdbId = readTmdbId(metadata);
  const mediaType = toMediaType(draft.type, metadata);
  const title = draft.title.trim();

  if (!tmdbId) {
    return { success: false, failReason: "missing_tmdb_id" };
  }

  if (!mediaType) {
    return { success: false, failReason: "unknown_media_type" };
  }

  if (!title) {
    return { success: false, failReason: "empty_title" };
  }

  const releaseYear = toNullableInt(draft.release_year);
  const posterUrl = asString(draft.poster_url ?? metadata.poster_url ?? metadata.posterUrl);
  const backdropUrl = asString(draft.backdrop_url ?? metadata.backdrop_url ?? metadata.backdropUrl);
  const runtimeMinutes = toNullableInt(
    draft.runtime_minutes ?? metadata.runtime_minutes ?? metadata.runtimeMinutes,
  );
  const genres = asStringArray(metadata.genres);
  const releaseDate = deriveReleaseDate(releaseYear, metadata);
  const canonicalUrl = asString(draft.canonical_url ?? metadata.canonical_url ?? metadata.canonicalUrl);

  return {
    tmdbId,
    mediaType,
    title,
    originalTitle: asString(metadata.original_title ?? metadata.originalTitle) ?? title,
    overview: asString(metadata.overview),
    posterPath: asString(metadata.poster_path ?? metadata.posterPath),
    posterUrl,
    backdropPath: asString(metadata.backdrop_path ?? metadata.backdropPath),
    backdropUrl,
    releaseDate,
    releaseYear,
    rating: asNumber(metadata.vote_average ?? metadata.rating),
    voteCount: toNullableInt(metadata.vote_count ?? metadata.voteCount),
    popularity: asNumber(metadata.popularity),
    genreIds: Array.isArray(metadata.genre_ids)
      ? metadata.genre_ids
          .map((item) => asNumber(item))
          .filter((item): item is number => item !== null)
          .map((item) => Math.trunc(item))
      : [],
    genres,
    runtimeMinutes,
    trailerUrl: asString(metadata.trailer_url ?? metadata.trailerUrl),
    canonicalUrl,
    streaming: normalizeStreamingMap(
      (asRecord(draft.tmdb)?.streaming as Record<string, unknown> | undefined) ?? metadata.streaming,
    ),
    enrichedAt,
  };
}

export function inferBookmarkEnrichmentState(
  draft: BookmarkCreateDraft,
  enrichedAt = new Date().toISOString(),
): Pick<Bookmark, "enriched" | "enriched_at" | "enrich_fail_reason" | "tmdb"> {
  const result = buildTmdbEnrichmentFromDraft(draft, enrichedAt);
  
  if ("failReason" in result) {
    return {
      enriched: false,
      enriched_at: null,
      enrich_fail_reason: result.failReason,
      tmdb: null,
    };
  }

  return {
    enriched: true,
    enriched_at: enrichedAt,
    enrich_fail_reason: null,
    tmdb: result,
  };
}
