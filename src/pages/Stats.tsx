import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Film, Tv, Star, BarChart2, Flame, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { bookmarkService } from "@/services/bookmarks";
import { formatRuntime } from "@/lib/utils";
import { format, subDays, subMonths, startOfDay, parseISO, isValid } from "date-fns";

const Stats = () => {
  const navigate = useNavigate();

  const { data: bookmarks = [], isLoading, isError, error } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground font-medium">Failed to load stats</p>
          <p className="text-muted-foreground text-sm mt-2">Please try again later</p>
        </div>
      </div>
    );
  }

  const stats = useMemo(() => {
    const done = bookmarks.filter((b) => b.status === "done");
    const watching = bookmarks.filter((b) => b.status === "watching");
    const backlog = bookmarks.filter((b) => b.status === "backlog");
    const dropped = bookmarks.filter((b) => b.status === "dropped");

    const totalMinutes = done
      .filter((b) => b.runtime_minutes)
      .reduce((sum, b) => sum + (b.runtime_minutes || 0), 0);

    const movies = bookmarks.filter((b) => b.type === "movie");
    const series = bookmarks.filter((b) => b.type === "series");
    const videos = bookmarks.filter((b) => b.type === "video");

    // Provider breakdown
    const providerCounts: Record<string, number> = {};
    bookmarks.forEach((b) => {
      providerCounts[b.provider] = (providerCounts[b.provider] || 0) + 1;
    });
    const topProviders = Object.entries(providerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
    const maxProvider = topProviders[0]?.[1] || 1;

    // Mood breakdown
    const moodCounts: Record<string, number> = {};
    bookmarks.forEach((b) => {
      (b.mood_tags || []).forEach((m) => {
        moodCounts[m] = (moodCounts[m] || 0) + 1;
      });
    });
    const topMoods = Object.entries(moodCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
    const maxMood = topMoods[0]?.[1] || 1;

    // Average user rating (for rated bookmarks)
    const ratedBookmarks = bookmarks.filter((b) => b.user_rating);
    const avgRating = ratedBookmarks.length
      ? ratedBookmarks.reduce((sum, b) => sum + (b.user_rating || 0), 0) / ratedBookmarks.length
      : null;

    // Monthly activity (last 12 months) — uses watched_at if available
    const monthlyActivity: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      monthlyActivity[format(d, "yyyy-MM")] = 0;
    }
    done.forEach((b) => {
      const dateStr = b.watched_at || b.updated_at;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        if (!isValid(d)) return;
        const monthKey = format(d, "yyyy-MM");
        if (monthKey in monthlyActivity) {
          monthlyActivity[monthKey] = (monthlyActivity[monthKey] || 0) + 1;
        }
      } catch {
        // ignore
      }
    });
    const monthlyData = Object.entries(monthlyActivity);
    const maxMonthly = Math.max(...monthlyData.map(([, v]) => v), 1);

    // Watch streak (consecutive days with something marked done)
    const watchedDays = new Set<string>();
    done.forEach((b) => {
      const dateStr = b.watched_at || null;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        if (isValid(d)) watchedDays.add(format(startOfDay(d), "yyyy-MM-dd"));
      } catch {
        // ignore
      }
    });
    let streak = 0;
    const today = startOfDay(new Date());
    for (let i = 0; i <= 365; i++) {
      const day = format(subDays(today, i), "yyyy-MM-dd");
      if (watchedDays.has(day)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      total: bookmarks.length,
      done: done.length,
      watching: watching.length,
      backlog: backlog.length,
      dropped: dropped.length,
      totalMinutes,
      movies: movies.length,
      series: series.length,
      videos: videos.length,
      topProviders,
      maxProvider,
      topMoods,
      maxMood,
      avgRating,
      ratedCount: ratedBookmarks.length,
      monthlyData,
      maxMonthly,
      streak,
    };
  }, [bookmarks]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 lg:px-8 flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Your Stats</h1>
            <p className="text-xs text-muted-foreground">Watchlist overview</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-8 max-w-2xl space-y-8">

        {/* Overview cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: BarChart2, color: "text-primary" },
            { label: "Watched", value: stats.done, icon: Film, color: "text-green-500" },
            { label: "Watching", value: stats.watching, icon: Tv, color: "text-blue-500" },
            { label: "Backlog", value: stats.backlog, icon: Calendar, color: "text-yellow-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Watch time + streak */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-xl p-5">
            <Clock className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-bold">{formatRuntime(stats.totalMinutes)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total watch time</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <Flame className="w-5 h-5 text-orange-500 mb-2" />
            <p className="text-2xl font-bold">
              {stats.streak > 0 ? `${stats.streak}d` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.streak > 0 ? "Current streak" : "No streak yet"}
            </p>
          </div>
        </div>

        {/* Type breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Content Types</h2>
          <div className="space-y-3">
            {[
              { label: "Movies", count: stats.movies, color: "bg-blue-500" },
              { label: "Series", count: stats.series, color: "bg-purple-500" },
              { label: "Videos", count: stats.videos, color: "bg-red-500" },
              { label: "Other", count: stats.total - stats.movies - stats.series - stats.videos, color: "bg-muted-foreground" },
            ].filter(({ count }) => count > 0).map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm w-16 text-muted-foreground">{label}</span>
                <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly activity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Monthly Activity (Watched)</h2>
          <div className="flex items-end gap-1 h-24">
            {stats.monthlyData.map(([month, count]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                  <div
                    className="w-full bg-primary/80 rounded-t-sm transition-all"
                    style={{ height: `${(count / stats.maxMonthly) * 80}px`, minHeight: count > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top providers */}
        {stats.topProviders.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Top Sources</h2>
            <div className="space-y-3">
              {stats.topProviders.map(([provider, count]) => (
                <div key={provider} className="flex items-center gap-3">
                  <span className="text-sm w-24 text-muted-foreground capitalize truncate">{provider}</span>
                  <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(count / stats.maxProvider) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top moods */}
        {stats.topMoods.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Top Moods</h2>
            <div className="flex flex-wrap gap-2">
              {stats.topMoods.map(([mood, count]) => (
                <div
                  key={mood}
                  className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5 text-sm"
                >
                  <span className="capitalize">{mood}</span>
                  <span className="text-muted-foreground text-xs">·{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Average rating */}
        {stats.avgRating !== null && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <div>
                <p className="text-2xl font-bold">{stats.avgRating.toFixed(1)}<span className="text-muted-foreground text-sm font-normal"> / 5</span></p>
                <p className="text-xs text-muted-foreground">Average rating across {stats.ratedCount} title{stats.ratedCount !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Stats;
