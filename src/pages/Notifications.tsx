import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, Trash2, Clock, CalendarPlus } from "lucide-react";
import { isToday, isYesterday, isThisWeek } from "date-fns";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeDate } from "@/lib/utils";
import { notificationService } from "@/services/notifications";
import { bookmarkService } from "@/services/bookmarks";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/errorMessage";

type GroupKey = "Today" | "Yesterday" | "This Week" | "Older";

function getGroupKey(dateString: string): GroupKey {
  const d = new Date(dateString);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return "This Week";
  return "Older";
}

const GROUP_ORDER: GroupKey[] = ["Today", "Yesterday", "This Week", "Older"];

const Notifications = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationService.getNotifications(),
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: getSafeErrorMessage(error, "Could not mark as read."), variant: "destructive" });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      toast({ title: "All caught up!", description: "All notifications marked as read." });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: getSafeErrorMessage(error, "Could not mark all as read."), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationService.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: getSafeErrorMessage(error, "Could not delete notification."), variant: "destructive" });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // Group notifications by day
  const grouped = useMemo(() => {
    const groups: Record<GroupKey, typeof notifications> = {
      "Today": [],
      "Yesterday": [],
      "This Week": [],
      "Older": [],
    };
    for (const n of notifications) {
      groups[getGroupKey(n.created_at)].push(n);
    }
    return groups;
  }, [notifications]);

  // Build a bookmark map for thumbnails
  const bookmarkMap = useMemo(() => {
    return new Map(bookmarks.map((b) => [b.id, b]));
  }, [bookmarks]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-[68px]">
        <div className="flex items-center justify-center pt-32">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-[68px]">
        <div className="flex items-center justify-center pt-32">
          <p className="text-destructive">Error loading notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0 pt-[68px]">
      <div className="container mx-auto px-4 lg:px-8 pt-6 pb-16 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {unreadCount > 0 ? (
                <span>{unreadCount} unread</span>
              ) : (
                <span className="flex items-center gap-1.5 text-chart-3">
                  <Check className="w-4 h-4" />
                  All caught up!
                </span>
              )}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </Button>
          )}
        </div>

        {/* Empty state */}
        {notifications.length === 0 && (
          <div className="flex flex-col items-center text-center py-20">
            <div className="w-16 h-16 bg-wm-surface rounded-2xl flex items-center justify-center mb-5">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2">You're all caught up!</h2>
            <p className="text-muted-foreground max-w-xs leading-relaxed mb-6">
              Notifications will appear here when you have scheduled content or reminders.
            </p>
            <Link to="/dashboard">
              <Button variant="outline" className="gap-2">
                <CalendarPlus className="w-4 h-4" />
                Schedule something to watch
              </Button>
            </Link>
          </div>
        )}

        {/* Grouped notifications */}
        {notifications.length > 0 && (
          <div className="space-y-8">
            {GROUP_ORDER.filter((g) => grouped[g].length > 0).map((groupKey) => (
              <div key={groupKey}>
                {/* Group header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{groupKey}</h2>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Notification cards */}
                <div className="space-y-2">
                  {grouped[groupKey].map((notification) => {
                    const bookmark = notification.bookmark_id
                      ? bookmarkMap.get(notification.bookmark_id)
                      : undefined;

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border transition-colors group",
                          notification.read_at
                            ? "bg-card border-border"
                            : "bg-wm-surface border-primary/20"
                        )}
                      >
                        {/* Thumbnail or bell icon */}
                        <div className="shrink-0 relative mt-0.5">
                          {bookmark?.poster_url || bookmark?.backdrop_url ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-wm-surface border border-border">
                              <img
                                src={bookmark.poster_url || bookmark.backdrop_url || ""}
                                alt={bookmark.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-wm-surface border border-border flex items-center justify-center">
                              <Bell className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          {/* Unread dot */}
                          {!notification.read_at && (
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-tight">{notification.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatRelativeDate(notification.created_at)}
                            </div>
                            {bookmark && (
                              <Link
                                to={`/b/${bookmark.id}`}
                                className="text-[10px] text-primary hover:underline"
                              >
                                View →
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!notification.read_at && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-chart-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                              onClick={() => markAsReadMutation.mutate(notification.id)}
                              disabled={markAsReadMutation.isPending}
                              aria-label="Mark as read"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                            onClick={() => deleteMutation.mutate(notification.id)}
                            disabled={deleteMutation.isPending}
                            aria-label="Delete notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Notifications;
