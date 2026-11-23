type NotificationCountService = {
  getUnreadCount: () => Promise<number>;
};

export async function fetchUnreadNotificationCount(
  service: NotificationCountService,
): Promise<number> {
  return service.getUnreadCount();
}
