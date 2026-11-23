import { describe, expect, it } from "vitest";
import { BookmarkV2Schema } from "@watchmarks/shared/bookmark";

function canonicalBookmark() {
  const now = new Date("2026-08-23T12:00:00.000Z");
  return {
    schemaVersion: 2 as const,
    ownerId: "alice",
    source: { originalUrl: null, canonicalUrl: null, platform: "generic" as const, rawTitle: "Arrival", capturedAt: now, captureId: null },
    media: { type: "movie" as const, title: "Arrival", posterUrl: null, backdropUrl: null, releaseYear: 2016, runtimeMinutes: 116 },
    resolution: { status: "pending" as const, provider: null, externalId: null, confidence: null, version: 1 },
    library: {
      state: "saved" as const, scheduledAt: null, progressPercent: 0, priority: 100,
      queueState: "queued" as const, tags: [], moodTags: [], notes: null, rating: null,
      review: null, watchedAt: null, lastShownAt: null, shownCount: 0,
    },
    visibility: { isPublic: false, isVaulted: false, shareToken: null },
    availability: null,
    intelligence: {
      autoTags: [], embeddingRef: null, fingerprint: null, clusterId: null,
      importanceScore: null, pendingClusterAssignment: false, pipelineVersion: 0,
      lastViewedAt: null, viewCount: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}

describe("BookmarkV2Schema", () => {
  it("accepts the canonical shape", () => {
    expect(BookmarkV2Schema.safeParse(canonicalBookmark()).success).toBe(true);
  });

  it("rejects deprecated aliases and invalid visibility", () => {
    expect(BookmarkV2Schema.safeParse({ ...canonicalBookmark(), source_url: "https://example.com" }).success).toBe(false);
    expect(BookmarkV2Schema.safeParse({
      ...canonicalBookmark(),
      visibility: { isPublic: true, isVaulted: true, shareToken: null },
    }).success).toBe(false);
  });
});
