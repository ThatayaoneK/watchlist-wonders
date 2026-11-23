import { describe, expect, it } from "vitest";

import { normalizeBookmark } from "@/services/bookmarkNormalizer";

describe("normalizeBookmark", () => {
  it("maps a valid v2 document into the legacy UI view without stored aliases", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const bookmark = normalizeBookmark("bookmark-v2", {
      schemaVersion: 2,
      ownerId: "alice",
      source: {
        originalUrl: "https://www.imdb.com/title/tt2543164/",
        canonicalUrl: "https://www.themoviedb.org/movie/329865",
        platform: "imdb",
        rawTitle: "Arrival",
        capturedAt: now,
        captureId: "capture-1",
      },
      media: {
        type: "movie", title: "Arrival", posterUrl: null, backdropUrl: null,
        releaseYear: 2016, runtimeMinutes: 116,
      },
      resolution: {
        status: "matched", provider: "tmdb", externalId: "329865", confidence: 0.98,
        version: 1, selectedBy: "auto",
      },
      library: {
        state: "watching", scheduledAt: null, progressPercent: 25, priority: 100,
        queueState: "in_progress", tags: ["sci-fi"], moodTags: ["thoughtful"],
        notes: "Watch again", rating: 5, review: null, watchedAt: null,
        lastShownAt: null, shownCount: 1,
      },
      visibility: { isPublic: false, isVaulted: false, shareToken: null },
      availability: null,
      intelligence: {
        autoTags: [], embeddingRef: null, fingerprint: null, clusterId: null,
        importanceScore: 0.8, pendingClusterAssignment: false, pipelineVersion: 2,
        lastViewedAt: null, viewCount: 3,
      },
      createdAt: now,
      updatedAt: now,
    });

    expect(bookmark.title).toBe("Arrival");
    expect(bookmark.status).toBe("watching");
    expect(bookmark.metadata.tmdb_id).toBe(329865);
    expect(bookmark.source_url).toContain("imdb.com");
    expect(bookmark.pipeline_version).toBe(2);
  });

  it("coerces legacy bookmark data into safe runtime values", () => {
    const bookmark = normalizeBookmark("bookmark-1", {
      title: "  Test Title  ",
      type: null,
      provider: "  netflix  ",
      status: "watching",
      runtime_minutes: "95",
      release_year: "2024",
      tags: [" thriller ", 42, "", "night"],
      mood_tags: [" Cozy ", null, "Focus"],
      metadata: null,
      created_at: {
        toDate: () => new Date("2026-03-24T10:00:00.000Z"),
      },
      updated_at: {
        seconds: 1_774_386_000,
        nanoseconds: 0,
      },
      user_rating: "4.5",
      progress_percent: "130",
      shown_count: "3",
      share_token: "  token-123  ",
      is_vaulted: true,
    });

    expect(bookmark.title).toBe("Test Title");
    expect(bookmark.type).toBe("other");
    expect(bookmark.provider).toBe("netflix");
    expect(bookmark.runtime_minutes).toBe(95);
    expect(bookmark.release_year).toBe(2024);
    expect(bookmark.tags).toEqual(["thriller", "night"]);
    expect(bookmark.mood_tags).toEqual(["Cozy", "Focus"]);
    expect(bookmark.metadata).toEqual({});
    expect(bookmark.created_at).toBe("2026-03-24T10:00:00.000Z");
    expect(bookmark.updated_at).toBe("2026-03-24T21:00:00.000Z");
    expect(bookmark.user_rating).toBe(4.5);
    expect(bookmark.progress_percent).toBe(100);
    expect(bookmark.shown_count).toBe(3);
    expect(bookmark.queue_status).toBe("in_progress");
    expect(bookmark.share_token).toBe("token-123");
    expect(bookmark.is_vaulted).toBe(true);
  });

  it("falls back safely when required fields are missing or invalid", () => {
    const bookmark = normalizeBookmark("bookmark-2", {
      title: "   ",
      provider: 123,
      status: "broken",
      created_at: null,
      updated_at: undefined,
      mood_tags: "not-an-array",
      user_rating: "NaN",
      progress_percent: -50,
      is_vaulted: "yes",
    });

    expect(bookmark.title).toBe("Untitled");
    expect(bookmark.provider).toBe("generic");
    expect(bookmark.status).toBe("backlog");
    expect(bookmark.queue_status).toBe("queued");
    expect(bookmark.mood_tags).toEqual([]);
    expect(bookmark.user_rating).toBeNull();
    expect(bookmark.progress_percent).toBe(0);
    expect(bookmark.is_vaulted).toBeUndefined();
    expect(typeof bookmark.created_at).toBe("string");
    expect(typeof bookmark.updated_at).toBe("string");
  });
});
