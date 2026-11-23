import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { buildPublicBookmarkProjection } from "./sharing";

describe("buildPublicBookmarkProjection", () => {
  it("copies only the allowlisted public fields", () => {
    const projection = buildPublicBookmarkProjection(
      {
        title: "Arrival",
        type: "movie",
        poster_url: "https://image.example/poster.jpg",
        release_year: 2016,
        runtime_minutes: 116,
        canonical_url: "https://example.com/arrival",
        created_at: "2026-08-23T12:00:00.000Z",
        notes: "must remain private",
        metadata: { raw_capture_text: "private" },
        user_id: "alice",
      },
      "Alice",
    );

    expect(Object.keys(projection).sort()).toEqual([
      "canonicalUrl",
      "createdAt",
      "mediaType",
      "ownerDisplayName",
      "posterUrl",
      "releaseYear",
      "runtimeMinutes",
      "schemaVersion",
      "title",
    ]);
    expect(projection.createdAt).toBeInstanceOf(Timestamp);
    expect(projection).not.toHaveProperty("notes");
    expect(projection).not.toHaveProperty("metadata");
    expect(projection).not.toHaveProperty("user_id");
  });

  it("drops active or malformed public URLs", () => {
    const projection = buildPublicBookmarkProjection(
      {
        title: "Unsafe URLs",
        type: "other",
        poster_url: "javascript:alert(1)",
        canonical_url: "not a URL",
        created_at: Timestamp.now(),
      },
      null,
    );
    expect(projection.posterUrl).toBeNull();
    expect(projection.canonicalUrl).toBeNull();
  });

  it("projects canonical v2 fields without exposing nested private data", () => {
    const createdAt = Timestamp.now();
    const projection = buildPublicBookmarkProjection({
      schemaVersion: 2,
      media: {
        title: "Arrival",
        type: "movie",
        posterUrl: "https://image.example/arrival.jpg",
        releaseYear: 2016,
        runtimeMinutes: 116,
      },
      source: { canonicalUrl: "https://example.com/arrival" },
      library: { notes: "private" },
      createdAt,
    }, "Alice");

    expect(projection.title).toBe("Arrival");
    expect(projection.createdAt).toBe(createdAt);
    expect(projection).not.toHaveProperty("library");
  });
});
