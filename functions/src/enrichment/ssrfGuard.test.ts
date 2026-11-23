import { describe, expect, it } from "vitest";
import { isPublicIpAddress, UnsafeUrlError, validateExternalUrl } from "./ssrfGuard";

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "::1", "fc00::1", "fe80::1", "::ffff:7f00:1", "2001:db8::1"])(
    "rejects non-public address %s",
    (address) => expect(isPublicIpAddress(address)).toBe(false),
  );

  it("accepts a hostname only when every DNS answer is public", async () => {
    const result = await validateExternalUrl("https://example.com/watch", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
    expect(result.url.hostname).toBe("example.com");
  });

  it("rejects DNS rebinding candidates when any answer is private", async () => {
    await expect(validateExternalUrl("https://example.com", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ])).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it.each(["http://user:pass@example.com", "http://example.com:8080", "file:///etc/passwd"])(
    "rejects unsafe URL form %s",
    async (url) => expect(validateExternalUrl(url, async () => [{ address: "93.184.216.34", family: 4 }])).rejects.toBeInstanceOf(UnsafeUrlError),
  );
});
