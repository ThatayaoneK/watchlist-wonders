import { useQuery } from '@tanstack/react-query';
import { fetchSimilarTitlesViaProxy } from '@/services/tmdbProxy';

export interface SimilarTitle {
  id: number;
  title: string;
  poster_path: string | null;
  posterUrl: string | null;
  release_year: number | null;
  vote_average: number;
  media_type: 'movie' | 'tv';
}

async function fetchSimilarTitles(
  tmdbId: number | string,
  mediaType: 'movie' | 'tv',
): Promise<SimilarTitle[]> {
  return fetchSimilarTitlesViaProxy(tmdbId, mediaType);
}

export function useSimilarTitles(
  tmdbId: number | string | undefined | null,
  type: string,
) {
  const mediaType: 'movie' | 'tv' = type === 'series' || type === 'episode' || type === 'tv' ? 'tv' : 'movie';
  return useQuery({
    queryKey: ['similar-titles', tmdbId, mediaType],
    queryFn: () => fetchSimilarTitles(tmdbId!, mediaType),
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
