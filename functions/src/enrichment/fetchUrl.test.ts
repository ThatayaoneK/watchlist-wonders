import { describe, expect, it } from "vitest";
import { fetchUrl } from "./fetchUrl";
describe("safe fetch deadline", () => {
  it("bounds DNS resolution before a socket exists", async () => {
    await expect(fetchUrl("https://example.com", {
      totalTimeoutMs: 10,
      resolver: () => new Promise(() => undefined),
    })).rejects.toMatchObject({ code: "total_timeout" });
  });
});
