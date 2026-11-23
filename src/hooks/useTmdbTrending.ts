/**
 * useTmdbTrending — fetches a "Trending" discovery pool for new users.
 *
 * Uses a curated set of popular TMDB seed IDs to power the similarTitles
 * endpoint. Picks a random seed each session so the results feel fresh.
 * Only enabled when the user has fewer than 10 bookmarks.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchSimilarTitlesViaProxy } from "@/services/tmdbProxy";
import type { SimilarTitle } from "@/hooks/useSimilarTitles";

/** Popular / critically-acclaimed seeds that produce great similar-title pools */
const TRENDING_SEEDS: Array<{ tmdbId: number; mediaType: "movie" | "tv" }> = [
  { tmdbId: 27205,  mediaType: "movie" }, // Inception
  { tmdbId: 155,    mediaType: "movie" }, // The Dark Knight
  { tmdbId: 157336, mediaType: "movie" }, // Interstellar
  { tmdbId: 299534, mediaType: "movie" }, // Avengers: Endgame
  { tmdbId: 496243, mediaType: "movie" }, // Parasite
  { tmdbId: 603,    mediaType: "movie" }, // The Matrix
  { tmdbId: 1396,   mediaType: "tv"    }, // Breaking Bad
  { tmdbId: 1418,   mediaType: "tv"    }, // The Big Bang Theory
  { tmdbId: 60735,  mediaType: "tv"    }, // The Flash
  { tmdbId: 66732,  mediaType: "tv"    }, // Stranger Things
];

/** Pick a stable-per-session seed (changes daily) */
function pickSeed() {
  const idx = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % TRENDING_SEEDS.length;
  return TRENDING_SEEDS[idx];
}

export function useTmdbTrending(bookmarkCount: number) {
  const seed = pickSeed();

  return useQuery<SimilarTitle[]>({
    queryKey: ["tmdb-trending", seed.tmdbId],
    queryFn: () => fetchSimilarTitlesViaProxy(seed.tmdbId, seed.mediaType),
    enabled: bookmarkCount < 10,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours — results won't change often
    gcTime: 48 * 60 * 60 * 1000,
  });
}
