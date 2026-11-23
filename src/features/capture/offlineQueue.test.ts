import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "alice" } as { uid: string } | null },
  data: new Map<string, unknown>(), capture: vi.fn(), writable: true,
}));
vi.mock("@/lib/firebase", () => ({ auth: mocks.auth }));
vi.mock("@/services/captureShare", () => ({ captureAndWait: mocks.capture }));
vi.mock("@/lib/storage", () => ({ storage: {
  get: (key: string, options: { fallback: unknown }) => mocks.data.get(key) ?? options.fallback,
  set: (key: string, value: unknown) => { if (!mocks.writable) return false; mocks.data.set(key, value); return true; },
} }));
import { flushOfflineCaptures, getOfflineCaptures, queueOfflineCapture } from "./offlineQueue";
const request = (n: number) => ({ requestId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, sharedTitle: `Title ${n}`, surface: "manual" as const, clientCapturedAt: "2026-09-07T12:00:00.000Z" });
beforeEach(() => { mocks.auth.currentUser = { uid: "alice" }; mocks.data.clear(); mocks.capture.mockReset(); mocks.writable = true; });
describe("offline account isolation", () => {
  it("never replays Alice's captures as Bob or adopts an unowned legacy queue", async () => {
    queueOfflineCapture(request(1));
    mocks.data.set("watchmarks.capture.offline.v1", [request(2)]);
    mocks.auth.currentUser = { uid: "bob" };
    expect(await flushOfflineCaptures()).toBe(0);
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(getOfflineCaptures("alice")).toHaveLength(1);
  });
  it("serializes flushes and preserves captures appended during replay", async () => {
    queueOfflineCapture(request(1));
    let release!: () => void;
    mocks.capture.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    const first = flushOfflineCaptures();
    expect(flushOfflineCaptures()).toBe(first);
    queueOfflineCapture(request(2));
    release();
    expect(await first).toBe(1);
    expect(getOfflineCaptures()).toEqual([request(2)]);
  });
  it("stops replay when identity changes", async () => {
    queueOfflineCapture(request(1)); queueOfflineCapture(request(2));
    mocks.capture.mockImplementation(async () => { mocks.auth.currentUser = { uid: "bob" }; });
    expect(await flushOfflineCaptures()).toBe(1);
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.capture).toHaveBeenCalledWith(request(1), "alice");
    expect(getOfflineCaptures("alice")).toEqual([request(2)]);
  });
  it("retains failed requests and reports local storage failures", async () => {
    queueOfflineCapture(request(1));
    mocks.capture.mockRejectedValue(new Error("offline"));
    expect(await flushOfflineCaptures()).toBe(0);
    expect(getOfflineCaptures()).toHaveLength(1);
    mocks.writable = false;
    expect(() => queueOfflineCapture(request(2))).toThrow("Could not store");
  });
});

