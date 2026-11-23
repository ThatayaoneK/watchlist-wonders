import { describe, expect, it } from "vitest";
import { buildRecommendationInsights } from "@/lib/recommendations";
import type { Bookmark } from "@/types/database";

function makeBookmark(overrides: Partial<Bookmark>): Bookmark {
  return {
    id: "id-default",
    user_id: "user-1",
    title: "Sample",
    type: "movie",
    provider: "generic",
    source_url: null,
    canonical_url: null,
    platform_label: null,
    status: "backlog",
    runtime_minutes: 60,
    release_year: 2024,
    poster_url: null,
    backdrop_url: null,
    tags: [],
    mood_tags: [],
    notes: null,
    metadata: {},
    last_shown_at: null,
    shown_count: 0,
    created_at: "2026-03-25T10:00:00.000Z",
    updated_at: "2026-03-25T10:00:00.000Z",
    priority: 100,
    queue_status: "queued",
    progress_percent: 0,
    ...overrides,
  };
}

describe("buildRecommendationInsights", () => {
  it("prefers short runtimes in the morning and longer runtimes in the evening", () => {
    const quick = makeBookmark({ id: "quick", runtime_minutes: 28 });
    const long = makeBookmark({ id: "long", runtime_minutes: 120 });

    const morning = buildRecommendationInsights(
      [quick, long],
      new Date("2026-03-27T08:00:00.000Z"),
    );
    const evening = buildRecommendationInsights(
      [quick, long],
      new Date("2026-03-27T19:00:00.000Z"),
    );

    expect(morning.scores.quick).toBeGreaterThan(morning.scores.long);
    expect(evening.scores.long).toBeGreaterThan(evening.scores.quick);
  });

  it("explains in-progress items with a continue reason", () => {
    const watching = makeBookmark({
      id: "watching",
      status: "watching",
      progress_percent: 35,
      runtime_minutes: 45,
    });

    const insights = buildRecommendationInsights(
      [watching],
      new Date("2026-03-27T13:00:00.000Z"),
    );

    expect(insights.reasons.watching).toBe("You started this earlier");
  });

  it("downranks a recently skipped item", () => {
    const skipped = makeBookmark({
      id: "skipped",
      runtime_minutes: 45,
      last_shown_at: "2026-03-27T11:30:00.000Z",
      shown_count: 2,
    });
    const fresh = makeBookmark({
      id: "fresh",
      runtime_minutes: 45,
      last_shown_at: null,
      shown_count: 0,
    });

    const insights = buildRecommendationInsights(
      [skipped, fresh],
      new Date("2026-03-27T12:00:00.000Z"),
    );

    expect(insights.scores.fresh).toBeGreaterThan(insights.scores.skipped);
  });
});
