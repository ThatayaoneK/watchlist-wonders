import type {
  StreamingAvailability,
  StreamingProvider,
  TmdbDetailResponse,
  TmdbEnrichment,
  TmdbSearchResponse,
  TmdbSearchResult,
  TmdbWatchProvidersResponse,
} from "./types";
import { titleSimilarity } from "./titleNormalizer";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";
const FETCH_TIMEOUT_MS = 8000;
const TARGET_COUNTRIES = ["US", "GB", "ZA", "BW", "NG", "KE", "CA", "AU"];

export const posterUrl = (path: string | null, size = "w500") =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;

export const backdropUrl = (path: string | null, size = "w1280") =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;

export const logoUrl = (path: string | null, size = "w92") =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;

async function tmdbFetch<T>(
  apiKey: string,
  endpoint: string,
  params: Record<string, string> = {},
  retries = 3,
): Promise<T | null> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), { signal: controller.signal });

      if (response.status === 429) {
        const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "10", 10);
        await sleep((Number.isFinite(retryAfter) ? retryAfter : 10) * 1000);
        continue;
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        if (attempt === retries) {
          throw new Error(`TMDB ${endpoint} failed: ${response.status} ${response.statusText}`);
        }
        await sleep(attempt * 500);
        continue;
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) {
        throw new Error(`TMDB ${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(attempt * 500);
    }
  }

  throw new Error(`TMDB ${endpoint} exhausted retries`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function searchMulti(
  apiKey: string,
  query: string,
  language = "en-US",
): Promise<TmdbSearchResponse | null> {
  if (!query.trim()) return null;
  return tmdbFetch<TmdbSearchResponse>(apiKey, "/search/multi", {
    query,
    language,
    include_adult: "false",
    page: "1",
  });
}

export function pickBestMatch(
  results: TmdbSearchResult[],
  cleanTitle: string,
): TmdbSearchResult | null {
  const candidates = results.filter(
    (result) => result.media_type === "movie" || result.media_type === "tv",
  );

  if (!candidates.length) return null;

  const scored = candidates
    .map((result) => {
      const resultTitle = (result.title ?? result.name ?? "").toLowerCase();
      const similarity = titleSimilarity(cleanTitle, resultTitle);
      const safePopularity = Number(result.popularity) || 0;
      const safeVoteCount = Number(result.vote_count) || 0;
      const popularityScore = Math.min(safePopularity / 1000, 1);
      const voteScore = Math.min(safeVoteCount / 10000, 1);
      return {
        result,
        similarity,
        score: similarity * 0.6 + popularityScore * 0.3 + voteScore * 0.1,
      };
    })
    .sort((left, right) => right.score - left.score);

  if (!scored.length || scored[0].similarity < 0.35) {
    return null;
  }

  return scored[0].result;
}

export async function getDetails(
  apiKey: string,
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<TmdbDetailResponse | null> {
  return tmdbFetch<TmdbDetailResponse>(apiKey, `/${mediaType}/${tmdbId}`, {
    language: "en-US",
    append_to_response: "videos,watch/providers",
  });
}

export function buildEnrichment(
  match: TmdbSearchResult,
  detail: TmdbDetailResponse | null,
): TmdbEnrichment {
  const mediaType = (match.media_type === "tv" ? "tv" : "movie") as "movie" | "tv";
  const releaseDate = detail?.release_date ?? detail?.first_air_date ?? match.release_date ?? match.first_air_date ?? null;
  const releaseYear =
    releaseDate && /^\d{4}/.test(releaseDate) ? Number.parseInt(releaseDate.slice(0, 4), 10) : null;
  const runtimeMinutes =
    mediaType === "movie"
      ? normalizeNumber(detail?.runtime)
      : normalizeNumber(detail?.episode_run_time?.[0]);
  const genres = Array.isArray(detail?.genres)
    ? detail!.genres!.map((genre) => genre.name).filter(Boolean)
    : [];
  const genreIds = Array.isArray(detail?.genres)
    ? detail!.genres!.map((genre) => genre.id).filter((value) => Number.isFinite(value))
    : match.genre_ids ?? [];
  const title = detail?.title ?? detail?.name ?? match.title ?? match.name ?? "";
  const originalTitle =
    detail?.original_title ?? detail?.original_name ?? match.original_title ?? match.original_name ?? title;
  const watchProviders = detail?.["watch/providers"] ?? null;
  const streaming = buildStreamingMap(watchProviders);
  const trailerUrl = extractTrailerUrl(detail);
  const canonicalUrl = `https://www.themoviedb.org/${mediaType}/${match.id}`;
  const enrichedAt = new Date().toISOString();

  return {
    tmdbId: match.id,
    mediaType,
    title,
    originalTitle,
    overview: detail?.overview ?? match.overview ?? null,
    posterPath: detail?.poster_path ?? match.poster_path ?? null,
    posterUrl: posterUrl(detail?.poster_path ?? match.poster_path ?? null),
    backdropPath: detail?.backdrop_path ?? match.backdrop_path ?? null,
    backdropUrl: backdropUrl(detail?.backdrop_path ?? match.backdrop_path ?? null),
    releaseDate,
    releaseYear,
    rating: normalizeNumber(detail?.vote_average ?? match.vote_average),
    voteCount: normalizeInt(detail?.vote_count ?? match.vote_count),
    popularity: normalizeNumber(detail?.popularity ?? match.popularity),
    genreIds,
    genres,
    runtimeMinutes,
    trailerUrl,
    canonicalUrl,
    streaming,
    enrichedAt,
  };
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeInt(value: unknown): number | null {
  const numberValue = normalizeNumber(value);
  return numberValue === null ? null : Math.trunc(numberValue);
}

function mapProviders(items?: Array<{
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}>): StreamingProvider[] {
  if (!items?.length) return [];

  return items
    .slice()
    .sort((left, right) => left.display_priority - right.display_priority)
    .map((provider) => ({
      id: provider.provider_id,
      name: provider.provider_name,
      logoPath: provider.logo_path ?? null,
      logoUrl: logoUrl(provider.logo_path),
    }));
}

function buildStreamingMap(
  providers: TmdbWatchProvidersResponse | null,
): Record<string, StreamingAvailability> {
  const output: Record<string, StreamingAvailability> = {};

  if (!providers?.results) {
    return output;
  }

  for (const country of TARGET_COUNTRIES) {
    const data = providers.results[country];
    if (!data) continue;

    output[country] = {
      flatrate: mapProviders(data.flatrate),
      rent: mapProviders(data.rent),
      buy: mapProviders(data.buy),
      free: mapProviders(data.free),
      link: data.link ?? "",
    };
  }

  return output;
}

function extractTrailerUrl(detail: TmdbDetailResponse | null): string | null {
  const videos = detail?.videos?.results;
  if (!Array.isArray(videos)) return null;

  const selected =
    videos.find((video) => video.site === "YouTube" && video.type === "Trailer" && video.official) ??
    videos.find((video) => video.site === "YouTube" && video.type === "Trailer") ??
    videos.find((video) => video.site === "YouTube" && video.type === "Teaser");

  return selected?.key ? `https://www.youtube.com/watch?v=${selected.key}` : null;
}
