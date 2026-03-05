import { useQuery } from '@tanstack/react-query';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

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
  const url = `${TMDB_BASE}/${mediaType}/${tmdbId}/recommendations?api_key=${TMDB_KEY}&page=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch similar titles');
  const data = await res.json();
  return (data.results || []).slice(0, 12).map((item: any) => {
    const rawDate = item.release_date || item.first_air_date || '';
    const year = rawDate ? parseInt(rawDate.slice(0, 4), 10) : null;
    return {
      id: item.id,
      title: item.title || item.name,
      poster_path: item.poster_path,
      posterUrl: item.poster_path ? `${POSTER_BASE}${item.poster_path}` : null,
      release_year: year && !isNaN(year) ? year : null,
      vote_average: item.vote_average || 0,
      media_type: mediaType,
    };
  });
}

export function useSimilarTitles(
  tmdbId: number | string | undefined | null,
  type: string,
) {
  const mediaType: 'movie' | 'tv' = type === 'series' || type === 'episode' || type === 'tv' ? 'tv' : 'movie';
  return useQuery({
    queryKey: ['similar-titles', tmdbId, mediaType],
    queryFn: () => fetchSimilarTitles(tmdbId!, mediaType),
    enabled: !!tmdbId && !!TMDB_KEY,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
