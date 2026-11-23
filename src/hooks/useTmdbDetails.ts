import { useQuery } from '@tanstack/react-query';
import { fetchTmdbDetailsViaProxy } from '@/services/tmdbProxy';

export interface TmdbCastMember {
  name: string;
  character: string;
  profileUrl: string | null;
}

export interface TmdbDetails {
  genres: { id: number; name: string }[];
  cast: TmdbCastMember[];
  director: string | null;
}

async function fetchTmdbDetails(
  tmdbId: number | string,
  mediaType: 'movie' | 'tv',
): Promise<TmdbDetails> {
  return fetchTmdbDetailsViaProxy(tmdbId, mediaType);
}

export function useTmdbDetails(
  tmdbId: number | string | undefined | null,
  type: string,
) {
  const mediaType: 'movie' | 'tv' =
    type === 'series' || type === 'episode' ? 'tv' : 'movie';
  return useQuery({
    queryKey: ['tmdb-details', tmdbId, mediaType],
    queryFn: () => fetchTmdbDetails(tmdbId!, mediaType),
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
