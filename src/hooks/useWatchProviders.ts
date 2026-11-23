import { useQuery } from '@tanstack/react-query';
import { fetchWatchProvidersViaProxy } from '@/services/tmdbProxy';

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  logoUrl: string | null;
}

export interface WatchProviderResult {
  flatrate: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  link?: string;
  resolvedRegion?: string;
}

async function fetchWatchProviders(
  tmdbId: number | string,
  mediaType: 'movie' | 'tv',
  preferredRegion?: string,
): Promise<WatchProviderResult> {
  const data = await fetchWatchProvidersViaProxy(tmdbId, mediaType, preferredRegion);
  return data;
}

export function useWatchProviders(
  tmdbId: number | string | undefined | null,
  type: string,
  preferredRegion?: string,
) {
  const mediaType: 'movie' | 'tv' = type === 'series' || type === 'episode' ? 'tv' : 'movie';
  const normalizedPreferredRegion = preferredRegion?.trim().toUpperCase() || undefined;

  return useQuery({
    queryKey: ['watch-providers', tmdbId, mediaType, normalizedPreferredRegion],
    queryFn: () => fetchWatchProviders(tmdbId!, mediaType as 'movie' | 'tv', normalizedPreferredRegion),
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000, // 24h
  });
}
