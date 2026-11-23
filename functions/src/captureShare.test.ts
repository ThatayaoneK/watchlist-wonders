import { describe, expect, it } from "vitest";
import {
  bookmarkTypeFromResult,
  extractUrlFromText,
  fallbackTitle,
  resolveCaptureStatus,
} from "./captureShare";

describe("captureShare helpers", () => {
  it("extracts a shared URL from surrounding text", () => {
    expect(extractUrlFromText("watch this https://example.com/item?x=1 now")).toBe(
      "https://example.com/item?x=1",
    );
  });

  it("marks matched TMDB captures as auto-saved", () => {
    expect(
      resolveCaptureStatus({
        title: "Interstellar",
        tmdbId: 157336,
        resolutionStatus: "matched",
        requiresUserSelection: false,
      }),
    ).toBe("auto_saved");
  });

  it("marks ambiguous matches as needs_selection", () => {
    expect(
      resolveCaptureStatus({
        title: "Pain",
        resolutionStatus: "needs_selection",
        requiresUserSelection: true,
        matchCandidates: [
          { tmdbId: 1, title: "Pain", mediaType: "movie" },
          { tmdbId: 2, title: "Pain", mediaType: "tv" },
        ],
      }),
    ).toBe("needs_selection");
  });

  it("falls back to video type for social providers without TMDB media type", () => {
    expect(bookmarkTypeFromResult({ contentType: "video" }, "youtube")).toBe("video");
    expect(bookmarkTypeFromResult({}, "tiktok")).toBe("video");
  });

  it("builds a readable fallback title from a shared URL", () => {
    expect(fallbackTitle("https://www.netflix.com/title/123", "netflix", null)).toBe(
      "Shared from Netflix",
    );
  });
});
