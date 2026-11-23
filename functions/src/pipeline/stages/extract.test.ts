import { describe, expect, it } from "vitest";
import { extract } from "./extract";

describe("extract", () => {
  it("pulls signals from a TikTok bookmark", () => {
    const signals = extract({
      id: "b1",
      userId: "u1",
      title: "Interstellar - Docking Scene #shorts",
      provider: "tiktok",
      source_url: "https://www.tiktok.com/@x/video/1",
      metadata: {
        og_description: "best edit ever — christopher nolan magic",
        thumbnail_url: "https://cdn.tiktok.com/thumb.jpg",
      },
    });
    expect(signals.rawTitle).toContain("Interstellar");
    expect(signals.platform).toBe("tiktok");
    expect(signals.domainType).toBe("social");
    expect(signals.hashtags).toContain("shorts");
    expect(signals.thumbnailUrl).toBe("https://cdn.tiktok.com/thumb.jpg");
  });

  it("falls back to og metadata when title is empty", () => {
    const signals = extract({
      id: "b2",
      userId: "u1",
      title: "",
      provider: "generic",
      metadata: { ogTitle: "From OG", description: "" },
    });
    expect(signals.rawTitle).toBe("From OG");
    expect(signals.platform).toBe("web");
    expect(signals.domainType).toBe("article");
  });

  it("handles unknown provider safely", () => {
    const signals = extract({ id: "b3", userId: "u1", title: "Whatever", provider: null });
    expect(signals.platform).toBe("web");
    expect(signals.hashtags).toEqual([]);
  });
});
