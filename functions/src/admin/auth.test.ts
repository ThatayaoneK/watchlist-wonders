import { describe, expect, it } from "vitest";
import { requireAdmin } from "./auth";

function makeRequest(token: Record<string, unknown> | null): { auth: { uid: string; token: Record<string, unknown> } | undefined; data: unknown } {
  return {
    auth: token ? { uid: "u1", token } : undefined,
    data: undefined,
  };
}

describe("requireAdmin", () => {
  it("throws unauthenticated when no auth", () => {
    expect(() => requireAdmin(makeRequest(null) as never)).toThrow(/unauthenticated|Sign in required/);
  });

  it("throws permission-denied when admin claim is missing", () => {
    expect(() => requireAdmin(makeRequest({}) as never)).toThrow(/Admin claim required|permission-denied/);
  });

  it("throws permission-denied when admin claim is false", () => {
    expect(() => requireAdmin(makeRequest({ admin: false }) as never)).toThrow(/Admin claim required|permission-denied/);
  });

  it("returns uid when admin claim is true", () => {
    expect(requireAdmin(makeRequest({ admin: true }) as never)).toBe("u1");
  });
});
