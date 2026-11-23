import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { notificationService } from "@/services/notifications";

export function useNotificationListener() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mountTimeRef = useRef(new Date().toISOString());

  useEffect(() => {
    if (!user) return;

    const mountTime = mountTimeRef.current;

    const unsubscribe = notificationService.subscribeToNotifications(
      (notif) => {
        // Only show toast for notifications created after the listener was mounted
        // and that are unread
        const createdTs = Date.parse(notif.created_at);

        // mountTime is always a string (initialized as new Date().toISOString()), so parse it directly
        const mountTs = Date.parse(mountTime) || NaN;

        // Only show toast if both timestamps are valid numbers, notification was created after mount, and is unread
        if (Number.isFinite(createdTs) && Number.isFinite(mountTs) && createdTs > mountTs && notif.read_at == null) {
          toast(notif.title, {
            description: notif.body,
            duration: 6000,
          });
        }
        // Always invalidate so badge + list stay in sync
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      }
    );

    return () => unsubscribe();
  }, [user, queryClient]);
}

export function NotificationListenerMount() {
  useNotificationListener();
  return null;
}
