import { httpsCallable } from "firebase/functions";
import { fbFunctions } from "@/lib/firebase";

type TmdbMediaType = "movie" | "tv";

interface TmdbProxyPayload {
  action: "searchId" | "watchProviders" | "similarTitles" | "details" | "trailer";
  title?: string;
  mediaType?: TmdbMediaType;
  overview?: string;
  tmdbId?: number | string;
  preferredRegion?: string;
}

interface SearchIdResponse {
  tmdbId: number | null;
}

export interface ProxyWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  logoUrl: string | null;
}

export interface WatchProvidersResponse {
  flatrate: ProxyWatchProvider[];
  rent: ProxyWatchProvider[];
  buy: ProxyWatchProvider[];
  link?: string;
  resolvedRegion?: string;
}

export interface SimilarTitleResponseItem {
  id: number;
  title: string;
  poster_path: string | null;
  posterUrl: string | null;
  release_year: number | null;
  vote_average: number;
  media_type: TmdbMediaType;
}

interface SimilarTitlesResponse {
  items: SimilarTitleResponseItem[];
}

export interface TmdbDetailsResponse {
  genres: { id: number; name: string }[];
  cast: { name: string; character: string; profileUrl: string | null }[];
  director: string | null;
}

interface TrailerResponse {
  embedUrl: string | null;
}

const tmdbProxyCallable = httpsCallable<TmdbProxyPayload, unknown>(fbFunctions, "tmdbProxy");

async function callTmdbProxy<T>(payload: TmdbProxyPayload): Promise<T> {
  const result = await tmdbProxyCallable(payload);
  return result.data as T;
}

export async function searchTmdbIdViaProxy(
  title: string,
  mediaType: TmdbMediaType,
  overview?: string,
): Promise<number | null> {
  const data = await callTmdbProxy<SearchIdResponse>({
    action: "searchId",
    title,
    mediaType,
    overview,
  });
  return data.tmdbId ?? null;
}

export async function fetchWatchProvidersViaProxy(
  tmdbId: number | string,
  mediaType: TmdbMediaType,
  preferredRegion?: string,
): Promise<WatchProvidersResponse> {
  return callTmdbProxy<WatchProvidersResponse>({
    action: "watchProviders",
    tmdbId,
    mediaType,
    preferredRegion,
  });
}

export async function fetchSimilarTitlesViaProxy(
  tmdbId: number | string,
  mediaType: TmdbMediaType,
): Promise<SimilarTitleResponseItem[]> {
  const data = await callTmdbProxy<SimilarTitlesResponse>({
    action: "similarTitles",
    tmdbId,
    mediaType,
  });
  return data.items ?? [];
}

export async function fetchTmdbDetailsViaProxy(
  tmdbId: number | string,
  mediaType: TmdbMediaType,
): Promise<TmdbDetailsResponse> {
  return callTmdbProxy<TmdbDetailsResponse>({
    action: "details",
    tmdbId,
    mediaType,
  });
}

export async function fetchTrailerEmbedUrlViaProxy(
  tmdbId: number | string,
  mediaType: TmdbMediaType,
): Promise<string | null> {
  const data = await callTmdbProxy<TrailerResponse>({
    action: "trailer",
    tmdbId,
    mediaType,
  });
  return data.embedUrl ?? null;
}
