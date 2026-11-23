import type { Bookmark } from "@/types/database";
import type { UpcomingScheduleSignal } from "@/engine/decisionEngine";

interface DemoDataset {
  bookmarks: Bookmark[];
  schedules: UpcomingScheduleSignal[];
}

function makeDemoBookmark(
  id: string,
  overrides: Partial<Bookmark> = {},
): Bookmark {
  const now = new Date().toISOString();
  return {
    id,
    user_id: "demo",
    title: "Untitled",
    type: "movie",
    provider: "generic",
    source_url: null,
    canonical_url: null,
    platform_label: null,
    status: "backlog",
    runtime_minutes: 90,
    release_year: 2023,
    poster_url: null,
    backdrop_url: null,
    tags: ["demo"],
    mood_tags: [],
    notes: null,
    metadata: { isDemo: true },
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

export function buildDemoDataset(now: Date = new Date()): DemoDataset {
  const demoBookmarks: Bookmark[] = [
    makeDemoBookmark("demo-up-next", {
      title: "Inception",
      provider: "tiktok",
      platform_label: "TikTok",
      runtime_minutes: 148,
      release_year: 2010,
      mood_tags: ["mind-bending", "thriller"],
      notes: "Saved from a short clip.",
      queue_status: "up_next",
      priority: 220,
    }),
    makeDemoBookmark("demo-watching", {
      title: "The Bear",
      type: "series",
      provider: "netflix",
      platform_label: "Netflix",
      runtime_minutes: 45,
      release_year: 2022,
      status: "watching",
      progress_percent: 35,
      mood_tags: ["intense", "drama"],
    }),
    makeDemoBookmark("demo-quick", {
      title: "Chef's Table: Pizza",
      type: "doc",
      provider: "youtube",
      platform_label: "YouTube",
      runtime_minutes: 32,
      release_year: 2020,
      mood_tags: ["relaxing"],
    }),
    makeDemoBookmark("demo-long", {
      title: "Oppenheimer",
      provider: "imdb",
      platform_label: "IMDb",
      runtime_minutes: 181,
      release_year: 2023,
      mood_tags: ["epic", "thoughtful"],
    }),
    makeDemoBookmark("demo-fresh", {
      title: "Dune: Part Two",
      provider: "generic",
      platform_label: "Web",
      runtime_minutes: 166,
      release_year: 2024,
      mood_tags: ["epic"],
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    }),
    makeDemoBookmark("demo-mood", {
      title: "Blade Runner 2049",
      provider: "netflix",
      platform_label: "Netflix",
      runtime_minutes: 164,
      release_year: 2017,
      mood_tags: ["thoughtful", "scifi"],
    }),
  ];

  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const schedules: UpcomingScheduleSignal[] = [
    { bookmarkId: "demo-quick", scheduledFor: inTwoHours },
  ];

  return { bookmarks: demoBookmarks, schedules };
}
