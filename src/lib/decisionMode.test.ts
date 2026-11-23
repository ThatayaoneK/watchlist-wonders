import { describe, expect, it } from "vitest";
import type { Bookmark } from "@/types/database";
import {
  DECISION_MOOD_TAG_MAP,
  buildDecisionCandidates,
  deriveDecisionSeedFromIntent,
  getNextDecisionIndex,
} from "@/lib/decisionMode";

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: overrides.id ?? "bookmark-1",
    user_id: "user-1",
    title: overrides.title ?? "Title",
    type: overrides.type ?? "movie",
    provider: overrides.provider ?? "netflix",
    source_url: null,
    canonical_url: null,
    platform_label: null,
    status: overrides.status ?? "backlog",
    runtime_minutes: overrides.runtime_minutes ?? 90,
    release_year: null,
    poster_url: null,
    backdrop_url: null,
    tags: [],
    mood_tags: overrides.mood_tags ?? [],
    notes: null,
    metadata: {},
    last_shown_at: null,
    shown_count: 0,
    created_at: overrides.created_at ?? "2026-03-27T10:00:00.000Z",
    updated_at: "2026-03-27T10:00:00.000Z",
    priority: overrides.priority ?? 100,
    queue_status: overrides.queue_status ?? "queued",
    progress_percent: overrides.progress_percent ?? 0,
    ...overrides,
  };
}

describe("decisionMode mapping", () => {
  it("maps broad mood semantics", () => {
    expect(DECISION_MOOD_TAG_MAP.action).toEqual(expect.arrayContaining(["action", "thriller", "epic"]));
    expect(DECISION_MOOD_TAG_MAP.chill).toEqual(expect.arrayContaining(["relaxing", "inspiring", "family"]));
    expect(DECISION_MOOD_TAG_MAP.intense).toEqual(expect.arrayContaining(["intense", "drama", "dark"]));
  });

  it("maps quick/deep/random/continue intent seeds", () => {
    expect(deriveDecisionSeedFromIntent("quick")).toMatchObject({ time: "quick", randomize: false, preferContinue: false });
    expect(deriveDecisionSeedFromIntent("deep")).toMatchObject({ time: "deep", randomize: false, preferContinue: false });
    expect(deriveDecisionSeedFromIntent("random")).toMatchObject({ time: null, randomize: true, preferContinue: false });
    expect(deriveDecisionSeedFromIntent("continue")).toMatchObject({ time: null, randomize: false, preferContinue: true });
  });
});

describe("buildDecisionCandidates", () => {
  const base = [
    makeBookmark({ id: "quick", runtime_minutes: 25, type: "video", created_at: "2026-03-27T09:00:00.000Z" }),
    makeBookmark({ id: "deep", runtime_minutes: 120, type: "movie", created_at: "2026-03-27T08:00:00.000Z" }),
    makeBookmark({ id: "done", status: "done", runtime_minutes: 20, created_at: "2026-03-27T07:00:00.000Z" }),
  ];

  it("applies quick/deep time filters", () => {
    const quick = buildDecisionCandidates(base, { time: "quick" });
    expect(quick.map((item) => item.id)).toEqual(["quick"]);

    const deep = buildDecisionCandidates(base, { time: "deep" });
    expect(deep.map((item) => item.id)).toEqual(["deep"]);
  });

  it("prefers continue-watching and excludes done", () => {
    const items = [
      makeBookmark({ id: "watching-1", status: "watching", progress_percent: 20 }),
      makeBookmark({ id: "backlog-1", status: "backlog" }),
      makeBookmark({ id: "done-1", status: "done" }),
    ];
    const ranked = buildDecisionCandidates(items, { intent: "continue" });
    expect(ranked[0].id).toBe("watching-1");
    expect(ranked.some((item) => item.id === "done-1")).toBe(false);
  });

  it("random intent order is deterministic across calls", () => {
    const items = [
      makeBookmark({ id: "a-100" }),
      makeBookmark({ id: "b-200" }),
      makeBookmark({ id: "c-300" }),
    ];
    const first = buildDecisionCandidates(items, { intent: "random" }).map((item) => item.id);
    const second = buildDecisionCandidates(items, { intent: "random" }).map((item) => item.id);
    expect(first).toEqual(second);
  });
});

describe("getNextDecisionIndex", () => {
  it("cycles deterministically with wraparound", () => {
    expect(getNextDecisionIndex(0, 3)).toBe(1);
    expect(getNextDecisionIndex(1, 3)).toBe(2);
    expect(getNextDecisionIndex(2, 3)).toBe(0);
  });

  it("guards empty candidate sets", () => {
    expect(getNextDecisionIndex(10, 0)).toBe(0);
  });
});

