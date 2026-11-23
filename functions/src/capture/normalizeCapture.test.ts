import { describe, expect, it } from "vitest";
import { CaptureBookmarkRequestSchema, CaptureBookmarkResponseSchema } from "@watchmarks/shared";
import { captureBookmarkId } from "./deduplicate";
import { normalizeCaptureRequest } from "./normalizeCapture";

describe("Capture v2 contract", () => {
  const request = CaptureBookmarkRequestSchema.parse({
    requestId: "1f16a0c2-42f3-4ac8-8d7e-51b9f3019df2",
    sharedText: "Watch https://example.com/movie#comments now",
    surface: "web_paste",
    clientCapturedAt: "2026-08-24T10:00:00.000Z",
  });

  it("normalizes shared text without changing the idempotency key", () => {
    const first = normalizeCaptureRequest(request);
    const second = normalizeCaptureRequest(request);
    expect(first.url).toBe("https://example.com/movie");
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("deduplicates independent request IDs by canonical source", () => {
    const id = captureBookmarkId({ url: "https://example.com/movie", title: null });
    expect(captureBookmarkId({ url: "https://example.com/movie", title: "Other" })).toBe(id);
  });

  it("rejects response shapes that leak undeclared fields", () => {
    expect(CaptureBookmarkResponseSchema.safeParse({ status: "saved", captureId: "c", bookmarkId: "b", raw: "secret" }).success).toBe(false);
  });

  it("rejects active non-web URL schemes at the shared boundary", () => {
    expect(CaptureBookmarkRequestSchema.safeParse({
      ...request,
      url: "javascript:alert(1)",
      sharedText: undefined,
    }).success).toBe(false);
  });
});
