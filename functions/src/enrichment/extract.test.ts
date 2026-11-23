import { describe, expect, it } from "vitest";
import cases from "../fixtures/providers/v1/cases.json";
import { extractorForUrl } from "./extract";

describe("versioned provider fixtures", () => {
  it("covers the required stable failure scenarios", () => {
    expect(new Set(cases.map((item) => item.scenario))).toEqual(new Set([
      "valid", "missing_metadata", "redirect", "region_blocked", "deleted", "rate_limit", "markup_change", "malicious",
    ]));
  });

  it.each([
    ["https://youtu.be/abc", "youtube"],
    ["https://www.imdb.com/title/tt123", "imdb"],
    ["https://x.com/user/status/1", "x"],
    ["https://example.com/watch", "generic"],
  ])("routes %s to %s", (url, provider) => {
    expect(extractorForUrl(url).provider).toBe(provider);
  });
});
