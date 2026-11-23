import { describe, expect, it } from "vitest";
import { rank } from "./rank";

describe("rank", () => {
  it("places stronger semantic + importance items first", () => {
    const now = Date.parse("2026-05-15T12:00:00Z");
    const items = [
      { id: "low", semanticSimilarity: 0.2, createdAt: "2026-05-14T00:00:00Z", viewCount: 0, importanceScore: 0.1 },
      { id: "strong", semanticSimilarity: 0.9, createdAt: "2026-05-14T00:00:00Z", viewCount: 5, importanceScore: 0.8 },
      { id: "popular_old", semanticSimilarity: 0.5, createdAt: "2025-01-01T00:00:00Z", viewCount: 50, importanceScore: 0.6 },
    ];
    const ranked = rank(items, now);
    expect(ranked[0].id).toBe("strong");
    expect(ranked[ranked.length - 1].id).toBe("low");
  });

  it("recency boosts identical-importance items", () => {
    const now = Date.parse("2026-05-15T12:00:00Z");
    const items = [
      { id: "yesterday", semanticSimilarity: 0.5, createdAt: "2026-05-14T12:00:00Z", viewCount: 0, importanceScore: 0.5 },
      { id: "year_ago", semanticSimilarity: 0.5, createdAt: "2025-05-15T12:00:00Z", viewCount: 0, importanceScore: 0.5 },
    ];
    const ranked = rank(items, now);
    expect(ranked[0].id).toBe("yesterday");
  });

  it("weights match the documented formula 0.45/0.15/0.15/0.25", () => {
    const now = Date.parse("2026-05-15T12:00:00Z");
    const item = {
      id: "x",
      semanticSimilarity: 1,
      createdAt: new Date(now).toISOString(),
      viewCount: 0,
      importanceScore: 1,
    };
    const [ranked] = rank([item], now);
    // recency_weight at 0 days = 1, engagement at 0 views = 0
    // 1*0.45 + 1*0.15 + 0*0.15 + 1*0.25 = 0.85
    expect(ranked.score).toBeCloseTo(0.85, 5);
  });

  it("breakdown sums match score", () => {
    const items = [
      { id: "a", semanticSimilarity: 0.7, createdAt: "2026-05-10T00:00:00Z", viewCount: 10, importanceScore: 0.5 },
    ];
    const [ranked] = rank(items, Date.parse("2026-05-15T00:00:00Z"));
    const { semantic, recency, engagement, importance } = ranked.breakdown;
    expect(ranked.score).toBeCloseTo(
      semantic * 0.45 + recency * 0.15 + engagement * 0.15 + importance * 0.25,
      5,
    );
  });

  it("handles empty input", () => {
    expect(rank([])).toEqual([]);
  });

  it("clamps invalid values gracefully", () => {
    const items = [
      { id: "a", semanticSimilarity: 2, createdAt: null, viewCount: -5, importanceScore: NaN },
    ];
    const [ranked] = rank(items, Date.now());
    expect(ranked.breakdown.semantic).toBe(1);
    expect(ranked.breakdown.importance).toBe(0);
    expect(ranked.breakdown.recency).toBe(0);
  });
});
