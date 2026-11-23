import { describe, expect, it } from "vitest";
import { resolveDashboardSurfaceForDemo } from "@/engine/demoFlow";
import type { Bookmark } from "@/types/database";
import type { UpcomingScheduleSignal } from "@/engine/decisionEngine";

function makeBookmark(id: string, overrides: Partial<Bookmark> = {}): Bookmark {
  const now = new Date().toISOString();
  return {
    id,
    user_id: "test-user",
    title: `Title ${id}`,
    type: "movie",
    provider: "generic",
    source_url: null,
    canonical_url: null,
    platform_label: null,
    status: "backlog",
    runtime_minutes: 90,
    release_year: 2020,
    poster_url: null,
    backdrop_url: null,
    tags: [],
    mood_tags: [],
    notes: null,
    metadata: {},
    last_shown_at: null,
    shown_count: 0,
    created_at: now,
    updated_at: now,
    priority: 100,
    queue_status: "queued",
    progress_percent: 0,
    ...overrides,
  };
}

describe("resolveDashboardSurfaceForDemo", () => {
  const liveBookmarks = [makeBookmark("live-1"), makeBookmark("live-2")];
  const liveUpcomingSchedules: UpcomingScheduleSignal[] = [
    { bookmarkId: "live-1", scheduledFor: "2026-03-30T09:00:00.000Z" },
  ];

  const demoBaseBookmark = makeBookmark("demo-up-next", { title: "Base Demo" });
  const demoSecondaryBookmark = makeBookmark("demo-quick", { title: "Demo Quick" });
  const demoDataset = {
    bookmarks: [demoBaseBookmark, demoSecondaryBookmark],
    schedules: [{ bookmarkId: "demo-quick", scheduledFor: "2026-03-30T11:00:00.000Z" }],
  };

  it("returns live data when demo is inactive", () => {
    const surface = resolveDashboardSurfaceForDemo({
      demoActive: false,
      demoStep: 0,
      demoItem: null,
      demoDataset,
      liveBookmarks,
      liveUpcomingSchedules,
    });

    expect(surface.bookmarks).toEqual(liveBookmarks);
    expect(surface.upcomingSchedules).toEqual(liveUpcomingSchedules);
  });

  it("returns empty surface for demo steps 1-2", () => {
    const stepOne = resolveDashboardSurfaceForDemo({
      demoActive: true,
      demoStep: 1,
      demoItem: null,
      demoDataset,
      liveBookmarks,
      liveUpcomingSchedules,
    });
    const stepTwo = resolveDashboardSurfaceForDemo({
      demoActive: true,
      demoStep: 2,
      demoItem: null,
      demoDataset,
      liveBookmarks,
      liveUpcomingSchedules,
    });

    expect(stepOne.bookmarks).toEqual([]);
    expect(stepOne.upcomingSchedules).toEqual([]);
    expect(stepTwo.bookmarks).toEqual([]);
    expect(stepTwo.upcomingSchedules).toEqual([]);
  });

  it("returns only the saved demo item for step 3", () => {
    const demoItem = makeBookmark("demo-up-next", { title: "Saved Demo Item" });
    const surface = resolveDashboardSurfaceForDemo({
      demoActive: true,
      demoStep: 3,
      demoItem,
      demoDataset,
      liveBookmarks,
      liveUpcomingSchedules,
    });

    expect(surface.bookmarks).toEqual([demoItem]);
    expect(surface.upcomingSchedules).toEqual([]);
  });

  it("returns decision-ready demo data for step 4 and merges saved item", () => {
    const demoItem = makeBookmark("demo-up-next", { title: "Saved Demo Item" });
    const surface = resolveDashboardSurfaceForDemo({
      demoActive: true,
      demoStep: 4,
      demoItem,
      demoDataset,
      liveBookmarks,
      liveUpcomingSchedules,
    });

    expect(surface.bookmarks).toHaveLength(2);
    expect(surface.bookmarks[0]).toEqual(demoItem);
    expect(surface.bookmarks.filter((bookmark) => bookmark.id === "demo-up-next")).toHaveLength(1);
    expect(surface.upcomingSchedules).toEqual(demoDataset.schedules);
  });

  it("returns demo dataset as-is in step 4 when no saved item exists", () => {
    const surface = resolveDashboardSurfaceForDemo({
      demoActive: true,
      demoStep: 4,
      demoItem: null,
      demoDataset,
      liveBookmarks,
      liveUpcomingSchedules,
    });

    expect(surface.bookmarks).toEqual(demoDataset.bookmarks);
    expect(surface.upcomingSchedules).toEqual(demoDataset.schedules);
  });
});
