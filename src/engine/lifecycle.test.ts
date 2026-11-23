import { describe, expect, it } from "vitest";
import { buildLifecycleUpdate, deriveLifecycleState, getNextStatus } from "@/engine/lifecycle";
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

describe("lifecycle", () => {
  it("derives lifecycle state from status/queue", () => {
    const upNext = makeBookmark({ queue_status: "up_next" });
    const watching = makeBookmark({ status: "watching", progress_percent: 10 });
    const done = makeBookmark({ status: "done" });

    expect(deriveLifecycleState(upNext)).toBe("up_next");
    expect(deriveLifecycleState(watching)).toBe("in_progress");
    expect(deriveLifecycleState(done)).toBe("completed");
  });

  it("builds updates for watching transition", () => {
    const base = makeBookmark({ status: "backlog", queue_status: "queued" });
    const updates = buildLifecycleUpdate(base, "watching", new Date("2026-03-27T10:00:00.000Z"));

    expect(updates.status).toBe("watching");
    expect(updates.queue_status).toBe("in_progress");
    expect(updates.progress_percent).toBeGreaterThanOrEqual(1);
    expect((updates.metadata as Record<string, unknown>)?.lifecycle_state).toBe("in_progress");
  });

  it("builds updates for done transition", () => {
    const base = makeBookmark({ status: "watching", progress_percent: 45 });
    const updates = buildLifecycleUpdate(base, "done", new Date("2026-03-27T12:00:00.000Z"));

    expect(updates.status).toBe("done");
    expect(updates.queue_status).toBe("completed");
    expect(updates.progress_percent).toBe(100);
    expect(updates.watched_at).toBe("2026-03-27T12:00:00.000Z");
  });

  it("cycles statuses predictably", () => {
    expect(getNextStatus("backlog")).toBe("watching");
    expect(getNextStatus("watching")).toBe("done");
    expect(getNextStatus("done")).toBe("backlog");
  });
});
