import { describe, expect, it } from "vitest";
import type { Bookmark } from "@/types/database";
import { buildLibraryGroups } from "./model";

function bookmark(id: number, overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: String(id), user_id: "user", title: `Title ${id}`, type: "movie", provider: "generic",
    source_url: null, canonical_url: null, platform_label: null, status: "backlog",
    runtime_minutes: null, release_year: null, poster_url: null, backdrop_url: null,
    tags: [], mood_tags: [], notes: null, metadata: {}, last_shown_at: null, shown_count: 0,
    created_at: new Date(1_700_000_000_000 + id).toISOString(), updated_at: new Date().toISOString(),
    enriched: true, ...overrides,
  };
}

describe("buildLibraryGroups", () => {
  it("keeps all 60 resolved untagged saves reachable and excludes the vault", () => {
    const saves = Array.from({ length: 60 }, (_, index) => bookmark(index));
    const result = buildLibraryGroups([...saves, bookmark(61, { is_vaulted: true })]);
    expect(result.allSaved.map(b => b.id)).toEqual([...saves].reverse().map(b => b.id));
    expect(result.recentlySaved).toHaveLength(20);
  });
  it("shows unresolved v2 captures in Needs Attention even after extraction", () => {
    const result = buildLibraryGroups([bookmark(1, { enriched: true, metadata: { resolution_status: "needs_selection" } })]);
    expect(result.unresolved.map(b => b.id)).toEqual(["1"]);
  });
  it("derives saved-only rails from a 1,000 item fixture without adding recommendations", () => {
    const fixtures = Array.from({ length: 1_000 }, (_, index) => bookmark(index, {
      status: index === 3 ? "watching" : "backlog",
      mood_tags: index < 50 ? ["cozy"] : [],
      metadata: index < 25 ? { genres: ["Drama"] } : {},
      enriched: index !== 7,
    }));
    const result = buildLibraryGroups(fixtures);
    expect(result.recentlySaved).toHaveLength(20);
    expect(result.continueWatching.map((item) => item.id)).toContain("3");
    expect(result.unresolved.map((item) => item.id)).toContain("7");
    expect(result.savedByGenreOrMood.map((group) => group.title)).toEqual(expect.arrayContaining(["cozy", "Drama"]));
    expect(Object.keys(result)).not.toContain("recommendations");
  });
});
