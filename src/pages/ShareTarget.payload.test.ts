import { describe, expect, it } from "vitest";
import { buildSmartFillData } from "@/lib/enrichmentSmartFill";
import { buildCreatePayloadFromShare } from "@/pages/shareTargetPayload";

describe("ShareTarget payload builder", () => {
  it("applies smart-fill metadata and defaults", () => {
    const smartFill = buildSmartFillData({
      title: "Inception",
      mediaType: "movie",
      releaseYear: 2010,
      canonicalUrl: "https://www.themoviedb.org/movie/27205",
      hashtags: ["#thriller"],
      genres: ["Thriller"],
      tmdbId: 27205,
    });

    const payload = buildCreatePayloadFromShare(
      {
        title: "Inception",
        type: "movie",
        provider: "generic",
        url: "https://example.com/inception",
        posterUrl: "https://image.tmdb.org/t/p/w500/test.jpg",
        runtimeMinutes: 148,
      },
      smartFill,
    );

    expect(payload.title).toBe("Inception");
    expect(payload.release_year).toBe(2010);
    expect(payload.canonical_url).toBe("https://www.themoviedb.org/movie/27205");
    expect(payload.tags).toContain("thriller");
    expect(payload.mood_tags).toContain("thriller");
    expect(payload.metadata.tmdb_id).toBe(27205);
  });
});
