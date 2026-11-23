import { describe, expect, it, vi } from "vitest";
import { fetchUnreadNotificationCount } from "@/components/layout/appLayoutQueries";

describe("fetchUnreadNotificationCount", () => {
  it("uses unread-count endpoint contract", async () => {
    const service = {
      getUnreadCount: vi.fn().mockResolvedValue(7),
      getNotifications: vi.fn(),
    };

    const count = await fetchUnreadNotificationCount(service);

    expect(count).toBe(7);
    expect(service.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(service.getNotifications).not.toHaveBeenCalled();
  });
});
