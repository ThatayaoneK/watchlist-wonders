import { describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ token: undefined as string | undefined, set: vi.fn(), list: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ listUsers: mock.list }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ doc: () => ({ get: async () => ({ get: () => mock.token }), set: mock.set }) }) }));
import { scheduledUsers } from "./scheduledUsers";
describe("scheduled Auth enumeration", () => {
  it("visits accounts beyond 200 without requiring parent user documents", async () => {
    mock.list.mockResolvedValueOnce({ users: [{ uid: "user201" }], pageToken: "next" });
    mock.token = "after200";
    const page = await scheduledUsers("importance", 200);
    expect(mock.list).toHaveBeenCalledWith(200, "after200");
    expect(page.docs).toEqual([{ id: "user201" }]);
    expect(mock.set).not.toHaveBeenCalled();
    await page.complete();
    expect(mock.set).toHaveBeenCalledWith({ pageToken: "next" });
    mock.list.mockResolvedValueOnce({ users: [] });
    await (await scheduledUsers("importance", 200)).complete();
    expect(mock.set).toHaveBeenLastCalledWith({ pageToken: null });
  });
});
