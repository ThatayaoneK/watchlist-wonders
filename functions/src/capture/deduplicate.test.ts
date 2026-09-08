import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rows: [] as Array<{ id: string; [key: string]: unknown }> }));
vi.mock("firebase-admin/firestore", () => {
  const col = (filters: Array<[string, unknown]> = []): object => ({
    doc: () => ({ collection: () => col() }),
    where: (key: string, _op: string, value: unknown) => col([...filters, [key, value]]),
    limit: () => ({ get: async () => ({ docs: state.rows.filter(row => filters.every(([key, value]) => row[key] === value)).slice(0, 1) }) }),
  });
  return { getFirestore: () => ({ collection: () => col() }) };
});
import { findExistingBookmark } from "./deduplicate";
beforeEach(() => { state.rows = []; });
describe("compound media identity", () => {
  it("does not conflate a TV show, a movie, or another provider sharing an ID", async () => {
    state.rows = [
      { id: "youtube", "resolution.externalId": "12", "resolution.provider": "youtube", "media.type": "movie" },
      { id: "series", "resolution.externalId": "12", "resolution.provider": "tmdb", "media.type": "series" },
    ];
    expect(await findExistingBookmark("alice", null, 12, "movie")).toBeNull();
    expect(await findExistingBookmark("alice", null, 12, "tv")).toBe("series");
  });
  it("matches legacy media only within its type", async () => {
    state.rows = [{ id: "legacy", "metadata.tmdb_id": 12, type: "movie" }];
    expect(await findExistingBookmark("alice", null, 12, "tv")).toBeNull();
    expect(await findExistingBookmark("alice", null, 12, "movie")).toBe("legacy");
  });
});
