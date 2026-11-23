import { describe, expect, it } from "vitest";
import { normalizeCachedResolveResult } from "./resolve";

describe("normalizeCachedResolveResult", () => {
  it("maps legacy suggested status to needs_selection", () => {
    const result = normalizeCachedResolveResult({
      source: "tmdb",
      id: "123",
      type: "movie",
      title: "Example",
      year: 2025,
      genres: [],
      runtime: 120,
      poster: null,
      confidence: 0.62,
      suggested: true,
      status: "suggested",
    });

    expect(result.suggested).toBe(true);
    expect(result.status).toBe("needs_selection");
    expect(result.requiresUserSelection).toBe(true);
  });

  it("defaults missing status from the suggested flag", () => {
    const result = normalizeCachedResolveResult({
      source: "tmdb",
      id: "456",
      type: "tv",
      title: "Series",
      year: 2024,
      genres: [],
      runtime: 45,
      poster: null,
      confidence: 0.55,
      suggested: true,
    });

    expect(result.status).toBe("needs_selection");
    expect(result.confidenceBand).toBe("low");
    expect(result.requiresUserSelection).toBe(true);
  });
});
