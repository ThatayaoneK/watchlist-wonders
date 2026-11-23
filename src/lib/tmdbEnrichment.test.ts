import { describe, expect, it } from "vitest";
import { buildTmdbEnrichmentFromDraft, inferBookmarkEnrichmentState } from "@/lib/tmdbEnrichment";

describe("tmdbEnrichment", () => {
  it("returns pending state when no tmdb id exists", () => {
    const state = inferBookmarkEnrichmentState({
      title: "Manual Title",
      type: "movie",
      metadata: {},
    });

    expect(state.enriched).toBe(false);
    expect(state.enriched_at).toBeNull();
    expect(state.tmdb).toBeNull();
  });

  it("builds a normalized tmdb payload from create data", () => {
    const enrichment = buildTmdbEnrichmentFromDraft(
      {
        title: "Inception",
        type: "movie",
        canonical_url: "https://www.themoviedb.org/movie/27205",
        release_year: 2010,
        runtime_minutes: 148,
        poster_url: "https://image.tmdb.org/t/p/w500/test.jpg",
        backdrop_url: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
        metadata: {
          tmdb_id: 27205,
          overview: "A mind-bending thriller.",
          genres: ["Thriller", "Sci-Fi"],
          vote_average: 8.8,
          vote_count: 32000,
          trailer_url: "https://www.youtube.com/watch?v=YoHD9XEInc0",
          media_type: "movie",
        },
      },
      "2026-04-12T12:00:00.000Z",
    );

    expect(enrichment).not.toBeNull();
    expect(enrichment && "tmdbId" in enrichment).toBe(true);
    if (!enrichment || !("tmdbId" in enrichment)) throw new Error("Expected TMDB enrichment");
    expect(enrichment.tmdbId).toBe(27205);
    expect(enrichment.mediaType).toBe("movie");
    expect(enrichment.genres).toEqual(["Thriller", "Sci-Fi"]);
    expect(enrichment.runtimeMinutes).toBe(148);
    expect(enrichment.enrichedAt).toBe("2026-04-12T12:00:00.000Z");
  });
});
