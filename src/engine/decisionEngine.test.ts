import { describe, expect, it } from "vitest";
import {
  buildDecisionSnapshot,
  getBestNextItem,
} from "@/engine/decisionEngine";
import type { Bookmark } from "@/types/database";

function makeBookmark(overrides: Partial<Bookmark>): Bookmark {
  return {
    id: "bookmark-default",
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
    created_at: "2026-03-26T10:00:00.000Z",
    updated_at: "2026-03-26T10:00:00.000Z",
    priority: 100,
    queue_status: "queued",
    progress_percent: 0,
    ...overrides,
  };
}

describe("decisionEngine", () => {
  it("prefers short picks in the morning and long picks in the evening", () => {
    const quick = makeBookmark({ id: "quick", runtime_minutes: 28 });
    const long = makeBookmark({ id: "long", runtime_minutes: 120 });

    const morning = buildDecisionSnapshot([quick, long], {
      now: new Date("2026-03-27T08:00:00.000Z"),
    });
    const evening = buildDecisionSnapshot([quick, long], {
      now: new Date("2026-03-27T19:00:00.000Z"),
    });

    expect(morning.insights.scores.quick).toBeGreaterThan(morning.insights.scores.long);
    expect(evening.insights.scores.long).toBeGreaterThan(evening.insights.scores.quick);
  });

  it("returns one authoritative best-next item", () => {
    const upNext = makeBookmark({ id: "up-next", queue_status: "up_next", priority: 210 });
    const normal = makeBookmark({ id: "normal", queue_status: "queued", priority: 100 });

    const best = getBestNextItem([normal, upNext], {
      now: new Date("2026-03-27T17:00:00.000Z"),
    });

    expect(best?.id).toBe("up-next");
  });

  it("keeps supporting rails curated and includes planned + top genres", () => {
    const bookmarks = [
      makeBookmark({ id: "watching-1", status: "watching", progress_percent: 30 }),
      makeBookmark({ id: "watching-2", status: "watching", progress_percent: 50 }),
      makeBookmark({ id: "planned-1", status: "scheduled" }),
      makeBookmark({ id: "action-1", metadata: { genres: ["Action"] } }),
      makeBookmark({ id: "action-2", metadata: { genres: ["Action"] } }),
      makeBookmark({ id: "anime-1", metadata: { genres: ["Anime"] } }),
      makeBookmark({ id: "anime-2", metadata: { genres: ["Anime"] } }),
      makeBookmark({ id: "quick-1", runtime_minutes: 22 }),
      makeBookmark({ id: "fresh-1", created_at: "2026-03-27T07:00:00.000Z" }),
    ];

    const snapshot = buildDecisionSnapshot(bookmarks, {
      now: new Date("2026-03-27T19:00:00.000Z"),
    });

    expect(snapshot.rails.length).toBeLessThanOrEqual(5);
    expect(snapshot.rails.some((rail) => rail.id === "continue-watching")).toBe(true);
    expect(snapshot.rails.some((rail) => rail.id === "planned")).toBe(true);
    expect(snapshot.rails.filter((rail) => rail.id.startsWith("genre-")).length).toBeGreaterThanOrEqual(1);
    expect(snapshot.rails.filter((rail) => rail.id.startsWith("genre-")).length).toBeLessThanOrEqual(2);
  });

  it("boosts items that are scheduled soon", () => {
    const scheduled = makeBookmark({ id: "scheduled", runtime_minutes: 45 });
    const unscheduled = makeBookmark({ id: "unscheduled", runtime_minutes: 45 });

    const now = new Date("2026-03-27T16:00:00.000Z");
    const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    const snapshot = buildDecisionSnapshot([scheduled, unscheduled], {
      now,
      upcomingSchedules: [{ bookmarkId: "scheduled", scheduledFor: inTwoHours }],
    });

    expect(snapshot.insights.scores.scheduled).toBeGreaterThan(snapshot.insights.scores.unscheduled);
    expect(snapshot.insights.reasons.scheduled).toContain("Scheduled");
  });
});
