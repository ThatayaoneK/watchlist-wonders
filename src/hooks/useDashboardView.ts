import { useMemo } from "react";
import { buildDecisionSnapshot } from "@/engine/decisionEngine";
import type { Bookmark } from "@/types/database";
import type { DecisionRail, RecommendationInsights } from "@/engine/decisionEngine";
import type { AdvancedFilters } from "@/components/dashboard/FilterPanel";

export interface UpcomingScheduleSignal {
  bookmarkId: string;
  scheduledFor: string;
}

interface DashboardViewOptions {
  allBookmarks: Bookmark[];
  upcomingSchedules: UpcomingScheduleSignal[];
  now: Date;
  maxRails?: number;
  advancedFilters?: AdvancedFilters;
}

export interface DashboardView {
  heroBookmark: Bookmark | null;
  bestNextItem: Bookmark | null;
  nextReason: string | undefined;
  supportingRails: DecisionRail[];
  insights: RecommendationInsights;
  isEmpty: boolean;
  hasOnlyVaultedItems: boolean;
  vaultedBookmarks: Bookmark[];
  visibleBookmarks: Bookmark[];
}

const MAX_RAILS = 4;

export function useDashboardView({
  allBookmarks,
  upcomingSchedules,
  now,
  maxRails = MAX_RAILS,
  advancedFilters,
}: DashboardViewOptions): DashboardView {
  const vaultedBookmarks = useMemo(
    () => allBookmarks.filter((b) => b.is_vaulted),
    [allBookmarks],
  );

  const visibleBookmarks = useMemo(
    () => allBookmarks.filter((b) => !b.is_vaulted),
    [allBookmarks],
  );

  // Apply advanced filters (provider, mood, runtime) to visible bookmarks
  const filteredBookmarks = useMemo(() => {
    if (!advancedFilters) return visibleBookmarks;
    const { providers, moods, runtimeMin, runtimeMax } = advancedFilters;
    const hasFilters =
      providers.length > 0 || moods.length > 0 || runtimeMin !== null || runtimeMax !== null;
    if (!hasFilters) return visibleBookmarks;
    return visibleBookmarks.filter((b) => {
      if (providers.length > 0 && !providers.includes(b.provider)) return false;
      if (moods.length > 0 && !b.mood_tags?.some((m) => moods.includes(m))) return false;
      if (runtimeMin !== null && b.runtime_minutes != null && b.runtime_minutes < runtimeMin) return false;
      if (runtimeMax !== null && b.runtime_minutes != null && b.runtime_minutes > runtimeMax) return false;
      return true;
    });
  }, [visibleBookmarks, advancedFilters]);

  const decisionSnapshot = useMemo(
    () =>
      buildDecisionSnapshot(filteredBookmarks, {
        now,
        maxRails,
        upcomingSchedules,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredBookmarks, now, upcomingSchedules, maxRails],
  );

  const bestNextItem = decisionSnapshot.bestNext;

  const continueWatching = useMemo(
    () =>
      filteredBookmarks
        .filter((b) => b.status === "watching" || (b.progress_percent ?? 0) > 0)
        .sort((a, b) => {
          const progressDelta = (b.progress_percent ?? 0) - (a.progress_percent ?? 0);
          if (progressDelta !== 0) return progressDelta;
          return b.updated_at.localeCompare(a.updated_at);
        }),
    [filteredBookmarks],
  );

  const heroBookmark = bestNextItem ?? continueWatching[0] ?? null;
  const nextReason = bestNextItem
    ? decisionSnapshot.insights.reasons[bestNextItem.id]
    : undefined;

  const supportingRails = useMemo((): DecisionRail[] => {
    if (!bestNextItem) return decisionSnapshot.rails;
    return decisionSnapshot.rails
      .map((rail) => ({
        ...rail,
        bookmarks: rail.bookmarks.filter((b) => b.id !== bestNextItem.id),
      }))
      .filter((rail) => {
        const minSize =
          rail.id === "continue-watching" || rail.id === "planned" ? 1 : 2;
        return rail.bookmarks.length >= minSize;
      });
  }, [decisionSnapshot.rails, bestNextItem]);

  return {
    heroBookmark,
    bestNextItem,
    nextReason,
    supportingRails,
    insights: decisionSnapshot.insights,
    isEmpty: visibleBookmarks.length === 0,
    hasOnlyVaultedItems: visibleBookmarks.length === 0 && vaultedBookmarks.length > 0,
    vaultedBookmarks,
    visibleBookmarks,
  };
}
