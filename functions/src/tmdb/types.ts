export type MediaType = "movie" | "tv" | "person";

export interface TmdbSearchResult {
  id: number;
  media_type: MediaType;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
}

export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResult[];
  total_results: number;
  total_pages: number;
}

export interface TmdbProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export interface TmdbProvidersByType {
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
  free?: TmdbProvider[];
}

export interface TmdbWatchProvidersResponse {
  id: number;
  results: Record<string, TmdbProvidersByType & { link: string }>;
}

export interface TmdbVideoResult {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

export interface TmdbDetailResponse {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  runtime?: number;
  episode_run_time?: number[];
  videos?: { results?: TmdbVideoResult[] };
  "watch/providers"?: TmdbWatchProvidersResponse;
}

export interface StreamingProvider {
  id: number;
  name: string;
  logoPath: string | null;
  logoUrl: string | null;
}

export interface StreamingAvailability {
  flatrate: StreamingProvider[];
  rent: StreamingProvider[];
  buy: StreamingProvider[];
  free: StreamingProvider[];
  link: string;
}

export interface TmdbEnrichment {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  originalTitle: string;
  overview: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  backdropPath: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  rating: number | null;
  voteCount: number | null;
  popularity: number | null;
  genreIds: number[];
  genres: string[];
  runtimeMinutes: number | null;
  trailerUrl: string | null;
  canonicalUrl: string | null;
  streaming: Record<string, StreamingAvailability>;
  enrichedAt: string;
}

export interface BookmarkForEnrichment {
  id: string;
  userId: string;
  title?: string;
  url?: string | null;
  canonicalUrl?: string | null;
  type?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
  enriched: boolean;
  tmdb?: TmdbEnrichment | null;
}

export interface TmdbCacheEntry {
  tmdbId: number;
  mediaType: "movie" | "tv";
  enrichment: TmdbEnrichment;
  cachedAt: string;
  expiresAt: string;
}
