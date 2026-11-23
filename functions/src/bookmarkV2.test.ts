import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { BookmarkV2Schema } from "@watchmarks/shared";
import { convertBookmarkToV2 } from "./bookmarkV2";

describe("convertBookmarkToV2", () => {
  it("maps legacy aliases into one canonical v2 document", () => {
    const converted = convertBookmarkToV2({
      user_id: "user-a",
      title: "Arrival",
      type: "movie",
      provider: "imdb",
      source_url: "https://www.imdb.com/title/tt2543164/",
      canonical_url: "https://www.themoviedb.org/movie/329865",
      status: "watching",
      runtime_minutes: 116,
      release_year: 2016,
      tags: ["sci-fi"],
      mood_tags: ["thoughtful"],
      notes: "Watch again",
      metadata: { tmdbId: 329865, resolution_confidence: 0.98 },
      queue_status: "in_progress",
      progress_percent: 25,
      enriched: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    }, "user-a", Timestamp.fromMillis(1));

    expect(BookmarkV2Schema.parse(converted)).toEqual(converted);
    expect(converted.resolution.externalId).toBe("329865");
    expect(converted.media.type).toBe("movie");
    expect(converted.library.state).toBe("watching");
    expect(converted).not.toHaveProperty("metadata");
    expect(converted).not.toHaveProperty("source_url");
  });

  it("rejects a legacy document with no usable title", () => {
    expect(() => convertBookmarkToV2({ user_id: "user-a" }, "user-a")).toThrow("missing_title");
  });
});
