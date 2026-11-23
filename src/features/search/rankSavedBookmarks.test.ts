import { describe, expect, it } from "vitest";
import type { Bookmark } from "@/types/database";
import { rankSavedBookmarks } from "./rankSavedBookmarks";

const base = {
  user_id: "user", type: "movie", provider: "generic", source_url: null, canonical_url: null,
  platform_label: null, status: "backlog", runtime_minutes: null, release_year: null,
  poster_url: null, backdrop_url: null, tags: [], mood_tags: [], notes: null, metadata: {},
  last_shown_at: null, shown_count: 0, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
} satisfies Omit<Bookmark, "id" | "title">;

describe("rankSavedBookmarks", () => {
  it("orders exact, title-prefix, field-prefix, contains, then fuzzy matches", () => {
    const items = [
      { ...base, id: "fuzzy", title: "Interstellar" },
      { ...base, id: "contains", title: "The Star Story" },
      { ...base, id: "prefix", title: "Star Wars" },
      { ...base, id: "exact", title: "Star" },
    ];
    expect(rankSavedBookmarks(items, "star", {}).map((item) => item.id)).toEqual(["exact", "prefix", "contains", "fuzzy"]);
  });

  it("applies provider, status, genre, and mood filters", () => {
    const item = { ...base, id: "one", title: "Arrival", provider: "netflix", status: "watching", mood_tags: ["thoughtful"], metadata: { genres: ["Sci-Fi"] } } as Bookmark;
    expect(rankSavedBookmarks([item], "", { provider: "netflix", status: "watching", genre: "sci-fi", mood: "Thoughtful" })).toEqual([item]);
    expect(rankSavedBookmarks([item], "", { provider: "youtube" })).toEqual([]);
  });
});
