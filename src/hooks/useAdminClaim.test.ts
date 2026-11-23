import { describe, expect, it, vi } from "vitest";
import { evaluateAdminClaim, readAdminClaim } from "@/hooks/adminClaim";

describe("readAdminClaim", () => {
  it("forces token refresh and recovers from a stale admin claim", async () => {
    const getIdTokenResult = vi
      .fn()
      .mockResolvedValueOnce({ claims: { admin: false } })
      .mockResolvedValueOnce({ claims: { admin: true } });

    await expect(readAdminClaim({ getIdTokenResult })).resolves.toBe(true);
    expect(getIdTokenResult).toHaveBeenCalledTimes(2);
    expect(getIdTokenResult).toHaveBeenNthCalledWith(1, true);
    expect(getIdTokenResult).toHaveBeenNthCalledWith(2, true);
  });

  it("marks access denied when refreshed tokens still lack the admin claim", async () => {
    const getIdTokenResult = vi.fn().mockResolvedValue({ claims: {} });

    await expect(readAdminClaim({ getIdTokenResult })).resolves.toBe(false);
    expect(getIdTokenResult).toHaveBeenCalledTimes(2);
  });
});

describe("evaluateAdminClaim", () => {
  it("returns a recoverable error state when token refresh fails", async () => {
    const result = await evaluateAdminClaim({
      getIdTokenResult: vi.fn().mockRejectedValue({ code: "auth/network-request-failed" }),
    });

    expect(result).toEqual({
      isAdmin: false,
      accessDenied: false,
      error: "Network error. Check your connection and try again.",
    });
  });
});
