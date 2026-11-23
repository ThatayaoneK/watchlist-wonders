import { useState, type RefObject } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play, SkipForward, SlidersHorizontal } from "lucide-react";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { QuickAddBar } from "@/components/QuickAddBar";
import { Rail } from "@/components/bookmarks/Rail";
import { PosterCard } from "@/components/bookmarks/PosterCard";
import { EmptyStateGuide } from "@/components/EmptyStateGuide";
import { MissedSchedulesBanner } from "@/components/schedules/MissedSchedulesBanner";
import { FilterPanel } from "@/components/dashboard/FilterPanel";
import { RecommendationRail } from "@/components/recommendations/RecommendationRail";
import { Button } from "@/components/ui/button";
import { cn, openSafe } from "@/lib/utils";
import type { Bookmark, Schedule } from "@/types/database";
import type { DecisionRail, RecommendationInsights } from "@/engine/decisionEngine";
import type { SimilarTitle } from "@/hooks/useSimilarTitles";
import type { AdvancedFilters } from "@/components/dashboard/FilterPanel";

type ScheduleWithBookmark = {
  id: string;
  bookmark_id: string;
  scheduled_for: string;
  bookmarks: Bookmark | null;
};

interface DashboardShellProps {
  // View data
  heroBookmark: Bookmark | null;
  bestNextItem: Bookmark | null;
  nextReason: string | undefined;
  supportingRails: DecisionRail[];
  insights: RecommendationInsights;
  isEmpty: boolean;
  hasOnlyVaultedItems: boolean;
  vaultedBookmarks: Bookmark[];
  visibleBookmarks: Bookmark[];
  allScheduleMap: Record<string, Schedule>;
  missedSchedules: ScheduleWithBookmark[];
  streakCount: number;
  highlightBookmarkId: string | null;
  dismissedMissedBanner: boolean;
  // Mood filter
  activeMood: string | null;
  onMoodSelect: (mood: string | null) => void;
  recommendationItems: SimilarTitle[];
  recommendationSavingItemId: string | null;
  onSaveRecommendation: (item: SimilarTitle) => void;
  // Demo state
  demoActive: boolean;
  demoLoading: boolean;
  demoInputValue: string;
  demoStep: number;
  // Refs
  watchNextRailRef: RefObject<HTMLDivElement>;
  upNextHighlightRef: RefObject<HTMLDivElement>;
  // Callbacks
  onPlay: () => void;
  onHeroSchedule: () => void;
  onHeroSkip: () => void;
  onMoreInfo: () => void;
  onKeepStreak: () => void;
  onSchedule: (bookmark: Bookmark) => void;
  onSkip: (bookmark: Bookmark) => void;
  onMarkDone: (bookmark: Bookmark) => void;
  onAddToPlan: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onUndoDone: (bookmark: Bookmark) => void;
  onSetWatching: (bookmark: Bookmark) => void;
  onStatusCycle: (bookmark: Bookmark, newStatus: string) => void;
  onEpisodeUpdate: (bookmark: Bookmark, count: number) => void;
  onToggleUpNext: (bookmark: Bookmark) => void;
  onSharePublic: (bookmark: Bookmark) => void;
  onSharePrivate: (bookmark: Bookmark) => void;
  onVault: (bookmark: Bookmark) => void;
  onUnvault: (bookmark: Bookmark) => void;
  onMissedScheduleSkip: (schedId: string) => void;
  onDismissMissedBanner: () => void;
  onDemoInputChange: (value: string) => void;
  onStartDemo: () => void;
  // Advanced filters
  advancedFilters: AdvancedFilters;
  showFilterPanel: boolean;
  onFilterToggle: () => void;
  advancedFilterCount: number;
  onFilterApply: (filters: AdvancedFilters) => void;
  onFilterReset: () => void;
  filterResultCount: number;
  // Trending discovery rail (shown when user has < 10 bookmarks)
  trendingCandidates: SimilarTitle[];
  trendingRailSavingItemId: string | null;
  onSaveTrendingItem: (item: SimilarTitle) => void;
}

function RevealSection({
  children,
  delayMs,
  className,
  sectionRef,
}: {
  children: React.ReactNode;
  delayMs: number;
  className?: string;
  sectionRef?: RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={sectionRef}
      className={cn("section-reveal is-visible", className)}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  netflix: "Netflix",
  youtube: "YouTube",
  imdb: "IMDb",
  disneyplus: "Disney+",
  primevideo: "Prime Video",
  hbomax: "HBO Max",
  generic: "Web",
};

function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function TonightPickCard({
  bookmark,
  streakCount,
  reason,
  onSkip,
}: {
  bookmark: Bookmark;
  streakCount: number;
  reason?: string;
  onSkip: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const thumbUrl = bookmark.backdrop_url || bookmark.poster_url;
  const provider = PROVIDER_LABEL[bookmark.provider] || bookmark.provider;
  const runtime = bookmark.runtime_minutes ? formatRuntime(bookmark.runtime_minutes) : null;
  const meta = [provider, runtime, bookmark.release_year].filter(Boolean).join(" · ");

  return (
    <div className="flex rounded-xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="w-36 sm:w-48 shrink-0 bg-muted relative overflow-hidden">
        {thumbUrl && !imgError ? (
          <img
            src={thumbUrl}
            alt={bookmark.title}
            loading="eager"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/10" />
      </div>

      <div className="flex-1 min-w-0 p-4 flex flex-col justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.18em] mb-1 select-none">
            Tonight&apos;s pick
          </p>
          <h3 className="font-bold text-foreground text-base sm:text-lg leading-tight line-clamp-1">
            {bookmark.title}
          </h3>
          {meta && <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>}
          {reason && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1 italic">{reason}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={!bookmark.source_url}
            onClick={() => {
              openSafe(bookmark.source_url);
            }}
          >
            <Play className="w-3 h-3 fill-current" />
            Watch now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={onSkip}
          >
            <SkipForward className="w-3 h-3" />
            Skip
          </Button>
          {streakCount > 0 && (
            <span className="ml-auto text-xs text-primary font-semibold">{streakCount} day streak</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({
  heroBookmark,
  bestNextItem,
  nextReason,
  supportingRails,
  insights,
  isEmpty,
  hasOnlyVaultedItems,
  vaultedBookmarks,
  visibleBookmarks,
  allScheduleMap,
  missedSchedules,
  streakCount,
  highlightBookmarkId,
  dismissedMissedBanner,
  activeMood,
  onMoodSelect: _onMoodSelect,
  recommendationItems,
  recommendationSavingItemId,
  onSaveRecommendation,
  demoActive,
  demoLoading,
  demoInputValue,
  demoStep,
  watchNextRailRef,
  upNextHighlightRef,
  onPlay,
  onHeroSchedule,
  onHeroSkip,
  onMoreInfo,
  onKeepStreak,
  onSchedule,
  onSkip,
  onMarkDone,
  onAddToPlan,
  onDelete,
  onUndoDone,
  onSetWatching,
  onStatusCycle,
  onEpisodeUpdate,
  onToggleUpNext,
  onSharePublic,
  onSharePrivate,
  onVault,
  onUnvault,
  onMissedScheduleSkip,
  onDismissMissedBanner,
  onDemoInputChange,
  onStartDemo,
  advancedFilters: _advancedFilters,
  showFilterPanel,
  onFilterToggle,
  advancedFilterCount,
  onFilterApply,
  onFilterReset,
  filterResultCount,
  trendingCandidates,
  trendingRailSavingItemId,
  onSaveTrendingItem,
}: DashboardShellProps) {
  const navigate = useNavigate();

  const railHandlers = {
    onSchedule,
    onSkip,
    onMarkDone,
    onAddToPlan,
    onDelete,
    onUndoDone,
    onSetWatching,
    onStatusCycle,
    onEpisodeUpdate,
    onToggleUpNext,
    onSharePublic,
    onSharePrivate,
    onVault,
    onUnvault,
  };

  const posterHandlers = (bookmark: Bookmark) => ({
    onSchedule: () => onSchedule(bookmark),
    onSkip: () => onSkip(bookmark),
    onMarkDone: () => onMarkDone(bookmark),
    onAddToPlan: () => onAddToPlan(bookmark),
    onDelete: () => onDelete(bookmark),
    onUndoDone: () => onUndoDone(bookmark),
    onSetWatching: () => onSetWatching(bookmark),
    onStatusCycle,
    onEpisodeUpdate,
    onToggleUpNext,
    onSharePublic: () => onSharePublic(bookmark),
    onSharePrivate: () => onSharePrivate(bookmark),
    onVault: () => onVault(bookmark),
    onUnvault: () => onUnvault(bookmark),
  });

  // Filter saved bookmarks by active mood for the intent-first view
  const moodFilteredBookmarks = activeMood
    ? visibleBookmarks.filter((b) => b.mood_tags?.includes(activeMood))
    : [];

  const showHero = !!heroBookmark && !activeMood && !demoActive;
  const isDemoSavedStep = demoActive && demoStep === 3;
  const isDemoPickStep = demoActive && demoStep === 4;
  const demoSavedBookmark = isDemoSavedStep ? (visibleBookmarks[0] ?? null) : null;
  const demoPickBookmark = isDemoPickStep
    ? (bestNextItem ?? heroBookmark ?? visibleBookmarks[0] ?? null)
    : null;

  return (
    <div className="min-h-full bg-background pb-20 md:pb-0">
      {/* Hero Banner — hidden when mood is active */}
      {showHero && (
        <HeroBanner
          bookmark={heroBookmark}
          onPlay={onPlay}
          onSchedule={onHeroSchedule}
          onSkip={onHeroSkip}
          onMoreInfo={onMoreInfo}
          reason={bestNextItem ? nextReason : undefined}
          streakCount={streakCount}
          onKeepStreak={onKeepStreak}
        />
      )}

      {showHero && (
        <div className="relative z-10 -mt-24 md:-mt-28 lg:-mt-32 h-24 md:h-28 lg:h-32 bg-gradient-to-b from-transparent via-background/70 to-background pointer-events-none" />
      )}

      <div
        className={cn(
          "flex gap-0 relative",
          showHero ? "-mt-16 md:-mt-20 lg:-mt-24 z-20" : "pt-[68px]",
        )}
      >
        <div className="flex-1 min-w-0 relative z-10 pb-16">
          <div className="animate-fade-in">

            {/* ── Quick Add Bar — primary action, always reachable ── */}
            {!isEmpty && !demoActive && (
              <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-2">
                <QuickAddBar />
              </div>
            )}

            {/* ── Filter bar — persistent filter access with count badge ── */}
            {!isEmpty && !demoActive && (
              <div className="px-4 sm:px-6 lg:px-8 pt-2 pb-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onFilterToggle}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                    showFilterPanel || advancedFilterCount > 0
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                  aria-label={advancedFilterCount > 0 ? `Filters (${advancedFilterCount} active)` : "Filters"}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {advancedFilterCount > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                      {advancedFilterCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* ── FilterPanel — shown when toggled ── */}
            {!isEmpty && !demoActive && showFilterPanel && (
              <div className="pb-2">
                <FilterPanel
                  onApply={onFilterApply}
                  onReset={onFilterReset}
                  resultCount={filterResultCount}
                />
              </div>
            )}

            {/* ── Missed schedules banner ── */}
            {missedSchedules.length > 0 && !dismissedMissedBanner && !demoActive && (
              <div className="px-4 sm:px-6 lg:px-8 pb-3">
                <MissedSchedulesBanner
                  missed={missedSchedules}
                  onWatch={(bm) => navigate(`/b/${bm.id}`)}
                  onReschedule={onSchedule}
                  onSkip={onMissedScheduleSkip}
                  onDismiss={onDismissMissedBanner}
                />
              </div>
            )}

            {/* ── Mood-filtered grid (intent-first view) ── */}
            {activeMood && !demoActive && (
              <div className="px-4 sm:px-6 lg:px-8">
                {moodFilteredBookmarks.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <p className="text-4xl">🎭</p>
                    <p className="font-semibold text-foreground">
                      No {activeMood} items saved yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Share a link from any app to save it here.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/new">Add one now</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {moodFilteredBookmarks.map((bookmark) => (
                      <PosterCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        schedule={allScheduleMap[bookmark.id]}
                        {...posterHandlers(bookmark)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Default view (no mood selected) ── */}
            {!activeMood && (
              <div className="space-y-6">
                {/* Section label removed — individual rail titles are sufficient */}

                {isDemoPickStep && demoPickBookmark && (
                  <div className="px-4 sm:px-6 lg:px-8" ref={upNextHighlightRef}>
                    <div className="relative z-50 rounded-2xl ring-2 ring-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_40px_rgba(255,255,255,0.18)] p-1">
                      <TonightPickCard
                        bookmark={demoPickBookmark}
                        streakCount={streakCount}
                        reason={nextReason}
                        onSkip={onHeroSkip}
                      />
                    </div>
                  </div>
                )}

                {!demoActive && bestNextItem && (
                  <RevealSection delayMs={0} sectionRef={watchNextRailRef}>
                    <Rail
                      title="Watch This Next"
                      subtitle={insights.timeSubtitle}
                      bookmarks={[bestNextItem]}
                      itemReasons={insights.reasons}
                      itemSchedules={allScheduleMap}
                      highlightBookmarkId={highlightBookmarkId ?? undefined}
                      cardSize="featured"
                      {...railHandlers}
                    />
                  </RevealSection>
                )}

                {!demoActive &&
                  supportingRails.map((rail, index) => (
                    <RevealSection key={rail.id} delayMs={(index + 1) * 80}>
                      <Rail
                        title={rail.title}
                        subtitle={rail.subtitle}
                        bookmarks={rail.bookmarks}
                        itemReasons={insights.reasons}
                        itemSchedules={allScheduleMap}
                        variant={rail.variant}
                        {...railHandlers}
                      />
                    </RevealSection>
                  ))}

                {isDemoSavedStep && demoSavedBookmark && (
                  <div className="px-4 sm:px-6 lg:px-8">
                    <div className="max-w-[220px]">
                      <PosterCard
                        bookmark={demoSavedBookmark}
                        schedule={allScheduleMap[demoSavedBookmark.id]}
                        isHighlighted
                        {...posterHandlers(demoSavedBookmark)}
                      />
                    </div>
                  </div>
                )}

                {isEmpty && !hasOnlyVaultedItems && (
                  <div className="px-4 sm:px-6 lg:px-8">
                    <EmptyStateGuide
                      demoActive={demoActive}
                      demoLoading={demoLoading}
                      demoInputValue={demoInputValue}
                      onDemoInputChange={onDemoInputChange}
                      onStartDemo={onStartDemo}
                    />
                  </div>
                )}

                {hasOnlyVaultedItems && (
                  <div className="px-4 sm:px-6 lg:px-8 py-12">
                    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center">
                      <p className="text-lg font-semibold text-foreground mb-1">
                        Your dashboard is hidden by Vault
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {`You have 🔒 ${vaultedBookmarks.length} item${vaultedBookmarks.length === 1 ? "" : "s"} tucked away.`}
                      </p>
                      <Button asChild>
                        <Link to="/vault">Open Vault</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {trendingCandidates.length > 0 && !demoActive && (
                  <div className="px-4 sm:px-6 lg:px-8 pt-2">
                    <RecommendationRail
                      title="Trending Now"
                      subtitle="Popular titles to kick-start your watchlist"
                      items={trendingCandidates}
                      onSave={onSaveTrendingItem}
                      savingItemId={trendingRailSavingItemId}
                    />
                  </div>
                )}

                {recommendationItems.length > 0 && !demoActive && (
                  <div className="px-4 sm:px-6 lg:px-8 pt-2">
                    <RecommendationRail
                      title="You might also like"
                      subtitle="External recommendations"
                      items={recommendationItems}
                      onSave={onSaveRecommendation}
                      savingItemId={recommendationSavingItemId}
                    />
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
