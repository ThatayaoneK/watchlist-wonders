import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Clock, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { socialService } from "@/services/social";
import { formatRelativeDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const ACTION_LABEL: Record<string, string> = {
  added: "added a new title",
  done: "finished watching",
  shared: "shared a bookmark",
};

const Activity = () => {
  const { user } = useAuth();

  const { data: feedItems = [], isLoading, error } = useQuery({
    queryKey: ["activity-feed", user?.uid],
    queryFn: () => socialService.getFeed(user!.uid),
    enabled: !!user?.uid,
  });

  const sortedFeed = useMemo(
    () => [...feedItems].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [feedItems],
  );

  // Get unique actor UIDs
  const uniqueActorUids = useMemo(() => {
    return Array.from(new Set(sortedFeed.map((item) => item.actor_uid)));
  }, [sortedFeed]);

  // Fetch profiles for all unique actors
  const profileQueries = useQueries({
    queries: uniqueActorUids.map((uid) => ({
      queryKey: ["user-profile", uid],
      queryFn: () => socialService.getUserPublicProfile(uid),
      staleTime: 10 * 60 * 1000, // 10 minutes
    })),
  });

  // Create a map of uid to display_name
  const actorDisplayNames = useMemo(() => {
    const map = new Map<string, string>();
    profileQueries.forEach((query, index) => {
      const uid = uniqueActorUids[index];
      if (query.data?.display_name) {
        map.set(uid, query.data.display_name);
      }
    });
    return map;
  }, [profileQueries, uniqueActorUids]);

  // Get display name for an actor
  const getActorDisplay = (uid: string) => {
    return actorDisplayNames.get(uid) || `@${uid.slice(0, 8)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-[68px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-[68px] px-4">
        <div className="mx-auto max-w-xl py-12 space-y-4 text-center">
          <p className="text-foreground font-semibold">Couldn&apos;t load activity feed</p>
          <p className="text-sm text-muted-foreground">Please refresh and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-[68px] pb-24 md:pb-12">
      <div className="container mx-auto px-4 lg:px-8 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Friends Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recent activity from people you follow.
          </p>
        </div>

        {sortedFeed.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
            <Users className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="font-semibold text-foreground">No activity yet</p>
            <p className="text-sm text-muted-foreground">
              Follow people to see what they add, finish, and share.
            </p>
            <Button asChild variant="outline">
              <Link to="/settings">Manage Profile</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFeed.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{getActorDisplay(item.actor_uid)}</span>{" "}
                  {ACTION_LABEL[item.action] ?? "updated activity"}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeDate(item.created_at)}
                  </span>
                  {item.bookmark_id ? (
                    <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                      <Link to={`/b/${item.bookmark_id}`}>View</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Activity;
