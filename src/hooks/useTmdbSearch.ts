import { useQuery } from '@tanstack/react-query';
import { searchTmdbIdViaProxy } from '@/services/tmdbProxy';

async function searchTmdb(
  title: string,
  mediaType: 'movie' | 'tv',
  overview?: string,
): Promise<number | null> {
  return searchTmdbIdViaProxy(title, mediaType, overview);
}

/**
 * Resolves a TMDB ID from a title + media type when the ID is not already
 * stored in the bookmark's metadata.  Uses the bookmark's stored overview
 * (if any) to pick the right result when multiple titles match.
 */
export function useTmdbSearch(
  title: string | undefined | null,
  type: string,
  overview?: string,
) {
  const mediaType: 'movie' | 'tv' =
    type === 'series' || type === 'episode' ? 'tv' : 'movie';

  return useQuery({
    queryKey: ['tmdb-search', title, mediaType, overview ?? null],
    queryFn: () => searchTmdb(title!, mediaType, overview),
    enabled: !!title,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days - titles don't change
  });
}
