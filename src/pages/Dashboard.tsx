import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";
import { openSafe } from "@/lib/utils";
import { useDashboardQueries, type ScheduleWithBookmark } from "@/hooks/useDashboardQueries";
import type { AdvancedFilters } from "@/components/dashboard/FilterPanel";
import { storage } from "@/lib/storage";

const FILTER_STORAGE_KEY = "wm_dashboard_filters";

function loadStoredAdvancedFilters(): AdvancedFilters {
  const parsed = storage.get<Partial<AdvancedFilters>>(FILTER_STORAGE_KEY, { fallback: {} });
  return {
    providers: parsed.providers ?? [],
    moods: parsed.moods ?? [],
    runtimeMin: parsed.runtimeMin ?? null,
    runtimeMax: parsed.runtimeMax ?? null,
  };
}
import { bookmarkService } from "@/services/bookmarks";
import { socialService } from "@/services/social";
import { SkeletonRail } from "@/components/ui/skeleton-card";
import { Button } from "@/components/ui/button";
import { useDashboardTour } from "@/hooks/useDashboardTour";
import { useWatchStreak } from "@/hooks/useWatchStreak";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardView } from "@/hooks/useDashboardView";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { useSimilarTitles, type SimilarTitle } from "@/hooks/useSimilarTitles";
import { useTmdbTrending } from "@/hooks/useTmdbTrending";
import { useToast } from "@/hooks/use-toast";
import { DashboardShell } from "@/pages/dashboard/DashboardShell";
import { DashboardDialogs } from "@/pages/dashboard/DashboardDialogs";
import { buildDemoDataset } from "@/engine/demoData";
import { resolveDashboardSurfaceForDemo } from "@/engine/demoFlow";
import type { Bookmark, Schedule } from "@/types/database";

type DecisionIntentSeed = "quick" | "deep" | "random" | "continue";

const DEMO_URL = "https://tiktok.com/@user/video/demo";
const WELCOME_FLOW_KEY_PREFIX = "ww_welcome_flow_v1_";
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;
const INTENT_VALUES: DecisionIntentSeed[] = ["quick", "deep", "random", "continue"];

function getMetadataTmdbId(bookmark: Bookmark | null): number | null {
  if (!bookmark?.metadata || typeof bookmark.metadata !== "object") return null;
  const metadata = bookmark.metadata as Record<string, unknown>;
  const raw = metadata.tmdb_id ?? metadata.tmdbId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toBookmarkType(mediaType: SimilarTitle["media_type"]): Bookmark["type"] {
  return mediaType === "tv" ? "series" : "movie";
}

function toTmdbSourceUrl(item: SimilarTitle): string {
  const media = item.media_type === "tv" ? "tv" : "movie";
  return `https://www.themoviedb.org/${media}/${item.id}`;
}

function parseIntentParam(intentParam: string | null): DecisionIntentSeed | null {
  if (!intentParam) return null;
  return INTENT_VALUES.includes(intentParam as DecisionIntentSeed)
    ? (intentParam as DecisionIntentSeed)
    : null;
}

function buildDemoBookmark(): Bookmark {
  const now = new Date().toISOString();
  return {
    id: "demo-up-next",
    user_id: "demo",
    title: "Inception",
    type: "movie",
    provider: "tiktok",
    source_url: DEMO_URL,
    canonical_url: DEMO_URL,
    platform_label: "TikTok",
    status: "backlog",
    runtime_minutes: 148,
    release_year: 2010,
    poster_url: null,
    backdrop_url: null,
    tags: ["demo"],
    mood_tags: ["mind-bending", "thriller"],
    notes: "Saved from a short clip.",
    metadata: { isDemo: true },
    last_shown_at: null,
    shown_count: 0,
    created_at: now,
    updated_at: now,
    priority: 200,
    queue_status: "up_next",
    progress_percent: 0,
  };
}

function DemoTooltip({ message }: { message: string }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-black px-4 py-2 text-sm text-white shadow-2xl">
      {message}
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { showTour, dismissTour } = useDashboardTour();

  // ── Mood filter ───────────────────────────────────────────────────────────
  const [activeMood, setActiveMood] = useState<string | null>(null);

  // ── Advanced filters (persisted to localStorage via FilterPanel) ──────────
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(loadStoredAdvancedFilters);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [completionBookmark, setCompletionBookmark] = useState<Bookmark | null>(null);
  const [completionSheetOpen, setCompletionSheetOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [decisionModeOpen, setDecisionModeOpen] = useState(false);
  const [decisionSeedIntent, setDecisionSeedIntent] = useState<DecisionIntentSeed | null>(null);
  const [dismissedMissedBanner, setDismissedMissedBanner] = useState(false);

  // ── Demo state ────────────────────────────────────────────────────────────
  const [demoActive, setDemoActive] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoItem, setDemoItem] = useState<Bookmark | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoInputValue, setDemoInputValue] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [highlightBookmarkId, setHighlightBookmarkId] = useState<string | null>(null);

  // ── Welcome flow state ────────────────────────────────────────────────────
  const [welcomeFlowDismissed, setWelcomeFlowDismissed] = useState(true);
  const [welcomeFlowActive, setWelcomeFlowActive] = useState(false);

  const accountCreationTime = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).getTime()
    : null;
  const isNewAccount =
    accountCreationTime !== null && Date.now() - accountCreationTime <= NEW_ACCOUNT_WINDOW_MS;

  const { streak } = useWatchStreak();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const demoRunIdRef = useRef(0);
  const demoTimeoutsRef = useRef<number[]>([]);
  const upNextHighlightRef = useRef<HTMLDivElement | null>(null);
  const watchNextRailRef = useRef<HTMLDivElement | null>(null);
  const hasAutoFocusedWatchNextRef = useRef(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const dashboardQueries = useDashboardQueries();
  const bookmarksData = dashboardQueries.bookmarks.data ?? [];
  const { isLoading, error, refetch } = dashboardQueries.bookmarks;
  const upcomingSchedules = dashboardQueries.upcomingSchedules.data ?? [];
  const missedSchedules = dashboardQueries.missedSchedules.data ?? [];
  const plans = dashboardQueries.plans.data ?? [];

  // ── Demo dataset ──────────────────────────────────────────────────────────
  const demoDataset = useMemo(() => buildDemoDataset(now), [now]);

  const liveUpcomingSignals = useMemo(
    () =>
      (upcomingSchedules as ScheduleWithBookmark[]).map((schedule) => ({
        bookmarkId: schedule.bookmark_id,
        scheduledFor: schedule.scheduled_for,
      })),
    [upcomingSchedules],
  );

  const surface = useMemo(
    () =>
      resolveDashboardSurfaceForDemo({
        demoActive,
        demoStep,
        demoItem,
        demoDataset,
        liveBookmarks: bookmarksData,
        liveUpcomingSchedules: liveUpcomingSignals,
      }),
    [bookmarksData, demoActive, demoDataset, demoItem, demoStep, liveUpcomingSignals],
  );

  const allBookmarks = surface.bookmarks;
  const upcomingSignals = surface.upcomingSchedules;

  const upcomingSchedulesForDisplay = useMemo((): ScheduleWithBookmark[] => {
    if (!demoActive) return upcomingSchedules as ScheduleWithBookmark[];
    if (demoStep < 4) return [];
    return upcomingSignals.map((schedule) => ({
      id: `demo-schedule-${schedule.bookmarkId}`,
      user_id: "demo",
      bookmark_id: schedule.bookmarkId,
      scheduled_for: schedule.scheduledFor,
      reminder_offset_minutes: 0,
      recurrence_type: "none" as const,
      state: "scheduled" as const,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      bookmarks: allBookmarks.find((bookmark) => bookmark.id === schedule.bookmarkId) ?? null,
    }));
  }, [allBookmarks, demoActive, demoStep, upcomingSchedules, upcomingSignals]);

  const allScheduleMap = useMemo((): Record<string, Schedule> => {
    const map: Record<string, Schedule> = {};
    for (const s of upcomingSchedulesForDisplay) {
      if (!map[s.bookmark_id]) map[s.bookmark_id] = s;
    }
    return map;
  }, [upcomingSchedulesForDisplay]);


  const view = useDashboardView({
    allBookmarks,
    upcomingSchedules: upcomingSignals,
    now,
    advancedFilters,
  });

  const recommendationSeed = view.bestNextItem ?? view.heroBookmark;
  const recommendationSeedTmdbId = getMetadataTmdbId(recommendationSeed);
  const recommendationSeedType =
    recommendationSeed?.type === "series" || recommendationSeed?.type === "episode"
      ? "tv"
      : "movie";

  const { data: similarTitles = [] } = useSimilarTitles(
    recommendationSeedTmdbId,
    recommendationSeedType,
  );

  const recommendationCandidates = useMemo(() => {
    const existingTmdbIds = new Set<number>();
    const existingTitles = new Set<string>();

    for (const bookmark of view.visibleBookmarks) {
      const tmdbId = getMetadataTmdbId(bookmark);
      if (tmdbId) existingTmdbIds.add(tmdbId);
      existingTitles.add(bookmark.title.trim().toLowerCase());
    }

    return similarTitles
      .filter((item) => !existingTmdbIds.has(item.id))
      .filter((item) => !existingTitles.has(item.title.trim().toLowerCase()))
      .slice(0, 10);
  }, [similarTitles, view.visibleBookmarks]);

  // ── Trending discovery (shown to new users with < 10 bookmarks) ──────────
  const { data: trendingTitles = [] } = useTmdbTrending(allBookmarks.length);

  const trendingCandidates = useMemo(() => {
    const existingTmdbIds = new Set<number>();
    const existingTitles = new Set<string>();
    for (const bookmark of view.visibleBookmarks) {
      const tmdbId = getMetadataTmdbId(bookmark);
      if (tmdbId) existingTmdbIds.add(tmdbId);
      existingTitles.add(bookmark.title.trim().toLowerCase());
    }
    return trendingTitles
      .filter((item) => !existingTmdbIds.has(item.id))
      .filter((item) => !existingTitles.has(item.title.trim().toLowerCase()))
      .slice(0, 10);
  }, [trendingTitles, view.visibleBookmarks]);

  const saveRecommendationMutation = useMutation({
    mutationFn: async (item: SimilarTitle) =>
      bookmarkService.createBookmark({
        title: item.title,
        type: toBookmarkType(item.media_type),
        provider: "generic",
        source_url: toTmdbSourceUrl(item),
        canonical_url: toTmdbSourceUrl(item),
        poster_url: item.posterUrl ?? null,
        release_year: item.release_year ?? null,
        status: "backlog",
        tags: ["recommendation"],
        mood_tags: [],
        metadata: {
          tmdb_id: item.id,
          recommendation_source: "tmdb_similar_titles",
          vote_average: item.vote_average,
          media_type: item.media_type,
        },
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Saved", description: `"${saved.title}" added to your list.` });
    },
    onError: () => {
      toast({
        title: "Save failed",
        description: "Couldn't save recommendation right now.",
        variant: "destructive",
      });
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const mutations = useDashboardMutations({
    onMarkDoneSuccess: (bookmark) => {
      setCompletionBookmark(bookmark);
      setCompletionSheetOpen(true);
    },
    onPlanAdded: () => {
      setPlanOpen(false);
      setSelectedBookmark(null);
    },
  });

  // ── Demo mechanics ────────────────────────────────────────────────────────
  const clearDemoTimers = useCallback(() => {
    demoTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    demoTimeoutsRef.current = [];
  }, []);

  const delay = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => {
          demoTimeoutsRef.current = demoTimeoutsRef.current.filter((t) => t !== id);
          resolve();
        }, ms);
        demoTimeoutsRef.current.push(id);
      }),
    [],
  );

  const endDemo = useCallback(() => {
    storage.set("seen_demo", true);
    demoRunIdRef.current += 1;
    clearDemoTimers();
    setDemoActive(false);
    setDemoStep(0);
    setDemoItem(null);
    setDemoLoading(false);
    setDemoInputValue("");
  }, [clearDemoTimers]);

  const startDemo = useCallback(async () => {
    storage.set("seen_demo", true);
    const runId = demoRunIdRef.current + 1;
    demoRunIdRef.current = runId;
    clearDemoTimers();
    setDecisionModeOpen(false);
    setDecisionSeedIntent(null);
    setScheduleOpen(false);
    setPlanOpen(false);
    setSelectedBookmark(null);
    setDemoActive(true);
    setDemoStep(1);
    setDemoItem(null);
    setDemoLoading(false);
    setDemoInputValue(DEMO_URL);
    await delay(800);
    if (demoRunIdRef.current !== runId) return;
    setDemoStep(2);
    setDemoLoading(true);
    await delay(1200);
    if (demoRunIdRef.current !== runId) return;
    setDemoLoading(false);
    setDemoItem(buildDemoBookmark());
    setDemoStep(3);
    await delay(1200);
    if (demoRunIdRef.current !== runId) return;
    setDemoStep(4);
  }, [clearDemoTimers, delay]);

  // ── Dialog handlers ───────────────────────────────────────────────────────
  const handleSchedule = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setScheduleOpen(true);
  }, []);

  const handleAddToPlan = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setSelectedPlanId("");
    setPlanOpen(true);
  }, []);

  const closeDecisionMode = useCallback(() => {
    setDecisionModeOpen(false);
    setDecisionSeedIntent(null);
    const next = new URLSearchParams(searchParams);
    next.delete("decision");
    next.delete("intent");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleKeepStreak = useCallback(() => {
    if (!view.bestNextItem) return;
    watchNextRailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightBookmarkId(view.bestNextItem.id);
  }, [view.bestNextItem]);

  const handlePlay = useCallback(() => {
    openSafe(view.heroBookmark?.source_url);
  }, [view.heroBookmark]);

  const handlePlayNext = useCallback(() => {
    openSafe(view.bestNextItem?.source_url);
  }, [view.bestNextItem]);

  const handleMoreInfo = useCallback(() => {
    if (view.heroBookmark) navigate(`/b/${view.heroBookmark.id}`);
  }, [view.heroBookmark, navigate]);

  // ── Welcome flow ──────────────────────────────────────────────────────────
  const welcomeStorageKey = user?.uid ? `${WELCOME_FLOW_KEY_PREFIX}${user.uid}` : null;

  const dismissWelcomeFlow = useCallback(() => {
    if (welcomeStorageKey) storage.set(welcomeStorageKey, true);
    setWelcomeFlowActive(false);
    setWelcomeFlowDismissed(true);
  }, [welcomeStorageKey]);

  const handleWelcomeComplete = useCallback(
    async (payload: { genres: string[]; providers: string[]; addedSuggestionIds: string[] }) => {
      await mutations.handleWelcomeComplete(
        payload,
        (prefs) => socialService.savePrivatePreferences(prefs as Parameters<typeof socialService.savePrivatePreferences>[0]),
        dismissWelcomeFlow,
      );
    },
    [mutations, dismissWelcomeFlow],
  );

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      demoRunIdRef.current += 1;
      clearDemoTimers();
    };
  }, [clearDemoTimers]);

  useEffect(() => {
    if (demoStep === 4) {
      upNextHighlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [demoStep]);

  useEffect(() => {
    if (searchParams.get("decision") !== "1" || decisionModeOpen) return;
    setDecisionSeedIntent(parseIntentParam(searchParams.get("intent")));
    setDecisionModeOpen(true);
  }, [searchParams, decisionModeOpen]);

  useEffect(() => {
    if (isLoading || demoActive || bookmarksData.length > 0 || isNewAccount) return;
    const hasSeenDemo = storage.get("seen_demo", { fallback: false });
    if (hasSeenDemo) return;
    void startDemo();
  }, [bookmarksData.length, demoActive, isLoading, isNewAccount, startDemo]);

  useEffect(() => {
    if (isLoading || demoActive) return;
    if (hasAutoFocusedWatchNextRef.current) return;
    if (!view.bestNextItem) return;
    hasAutoFocusedWatchNextRef.current = true;
    const watchNextId = view.bestNextItem.id;
    setHighlightBookmarkId(watchNextId);
    const focusTimeout = window.setTimeout(() => {
      watchNextRailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstCardLink = watchNextRailRef.current?.querySelector<HTMLElement>(
        "[data-rail-card-link='true']",
      );
      firstCardLink?.focus();
    }, 140);
    const clearHighlightTimeout = window.setTimeout(() => {
      setHighlightBookmarkId((current) => (current === watchNextId ? null : current));
    }, 4200);
    return () => {
      window.clearTimeout(focusTimeout);
      window.clearTimeout(clearHighlightTimeout);
    };
  }, [isLoading, demoActive, view.bestNextItem]);

  useEffect(() => {
    if (!welcomeStorageKey) {
      setWelcomeFlowActive(false);
      setWelcomeFlowDismissed(true);
      return;
    }
    setWelcomeFlowDismissed(storage.get(welcomeStorageKey, { fallback: false }));
  }, [welcomeStorageKey]);

  useEffect(() => {
    const shouldActivate =
      !welcomeFlowDismissed &&
      !welcomeFlowActive &&
      !demoActive &&
      !showTour &&
      !isLoading &&
      isNewAccount &&
      allBookmarks.length === 0;
    if (shouldActivate) setWelcomeFlowActive(true);
  }, [
    welcomeFlowDismissed,
    welcomeFlowActive,
    demoActive,
    showTour,
    isLoading,
    isNewAccount,
    allBookmarks.length,
  ]);

  // ── Demo tooltip ──────────────────────────────────────────────────────────
  const demoTooltipMessage =
    demoStep === 1
      ? "Paste a link from TikTok, YouTube or anywhere"
      : demoStep === 2
        ? "We find the movie automatically"
        : demoStep === 3
          ? "This is your saved movie"
          : demoStep === 4
            ? "We suggest what to watch next"
            : null;

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-[68px]">
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-8 space-y-4">
          <div className="h-14 bg-wm-surface rounded-xl animate-pulse" />
          <div className="h-10 bg-wm-surface rounded-lg animate-pulse w-2/3" />
        </div>
        <div className="space-y-2">
          <SkeletonRail count={6} />
          <SkeletonRail count={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ArrowUpDown className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Couldn't load your watchlist</p>
            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
          </div>
          <Button onClick={() => refetch()} className="w-full sm:w-auto">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // ── Filter helpers ────────────────────────────────────────────────────────
  const advancedFilterCount =
    advancedFilters.providers.length +
    advancedFilters.moods.length +
    (advancedFilters.runtimeMin !== null || advancedFilters.runtimeMax !== null ? 1 : 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {demoActive && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 pointer-events-none" />
          <Button
            variant="secondary"
            size="sm"
            onClick={endDemo}
            className="fixed right-4 top-20 z-[60]"
          >
            Skip Demo
          </Button>
          {demoTooltipMessage && <DemoTooltip message={demoTooltipMessage} />}
        </>
      )}

      <DashboardShell
        heroBookmark={view.heroBookmark}
        bestNextItem={view.bestNextItem}
        nextReason={view.nextReason}
        supportingRails={view.supportingRails}
        insights={view.insights}
        isEmpty={view.isEmpty}
        hasOnlyVaultedItems={view.hasOnlyVaultedItems}
        vaultedBookmarks={view.vaultedBookmarks}
        visibleBookmarks={view.visibleBookmarks}
        allScheduleMap={allScheduleMap}
        missedSchedules={missedSchedules}
        streakCount={streak}
        highlightBookmarkId={highlightBookmarkId}
        dismissedMissedBanner={dismissedMissedBanner}
        activeMood={activeMood}
        onMoodSelect={setActiveMood}
        recommendationItems={recommendationCandidates}
        recommendationSavingItemId={
          saveRecommendationMutation.isPending && saveRecommendationMutation.variables
            ? `${saveRecommendationMutation.variables.media_type}-${saveRecommendationMutation.variables.id}`
            : null
        }
        onSaveRecommendation={(item) => {
          saveRecommendationMutation.mutate(item);
        }}
        demoActive={demoActive}
        demoLoading={demoLoading}
        demoInputValue={demoInputValue}
        demoStep={demoStep}
        watchNextRailRef={watchNextRailRef}
        upNextHighlightRef={upNextHighlightRef}
        onPlay={handlePlay}
        onHeroSchedule={() => view.heroBookmark && handleSchedule(view.heroBookmark)}
        onHeroSkip={() => {
          const pick = view.bestNextItem ?? view.heroBookmark;
          if (pick) mutations.handleSkip(pick);
        }}
        onMoreInfo={handleMoreInfo}
        onKeepStreak={handleKeepStreak}
        onSchedule={handleSchedule}
        onSkip={mutations.handleSkip}
        onMarkDone={mutations.handleMarkDone}
        onAddToPlan={handleAddToPlan}
        onDelete={mutations.handleDelete}
        onUndoDone={mutations.handleUndoDone}
        onSetWatching={mutations.handleSetWatching}
        onStatusCycle={mutations.handleStatusCycle}
        onEpisodeUpdate={mutations.handleEpisodeUpdate}
        onToggleUpNext={mutations.handleToggleUpNext}
        onSharePublic={mutations.handleSharePublic}
        onSharePrivate={mutations.handleSharePrivate}
        onVault={mutations.handleVault}
        onUnvault={mutations.handleUnvault}
        onMissedScheduleSkip={mutations.handleMissedScheduleSkip}
        onDismissMissedBanner={() => setDismissedMissedBanner(true)}
        onDemoInputChange={setDemoInputValue}
        onStartDemo={() => { void startDemo(); }}
        advancedFilters={advancedFilters}
        showFilterPanel={showFilterPanel}
        onFilterToggle={() => setShowFilterPanel((v) => !v)}
        advancedFilterCount={advancedFilterCount}
        onFilterApply={(filters) => setAdvancedFilters(filters)}
        onFilterReset={() =>
          setAdvancedFilters({ providers: [], moods: [], runtimeMin: null, runtimeMax: null })
        }
        filterResultCount={view.visibleBookmarks.length}
        trendingCandidates={trendingCandidates}
        trendingRailSavingItemId={
          saveRecommendationMutation.isPending && saveRecommendationMutation.variables
            ? `${saveRecommendationMutation.variables.media_type}-${saveRecommendationMutation.variables.id}`
            : null
        }
        onSaveTrendingItem={(item) => {
          saveRecommendationMutation.mutate(item);
        }}
      />

      <DashboardDialogs
        decisionModeOpen={decisionModeOpen}
        decisionSeedIntent={decisionSeedIntent}
        visibleBookmarks={view.visibleBookmarks}
        onCloseDecisionMode={closeDecisionMode}
        scheduleOpen={scheduleOpen}
        selectedBookmark={selectedBookmark}
        onScheduleOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setSelectedBookmark(null);
        }}
        planOpen={planOpen}
        plans={plans}
        selectedPlanId={selectedPlanId}
        addToPlanIsPending={mutations.addToPlanIsPending}
        onPlanOpenChange={setPlanOpen}
        onPlanSelectChange={setSelectedPlanId}
        onAddToPlanSubmit={() => {
          if (selectedBookmark && selectedPlanId) {
            mutations.handleAddToPlanSubmit(selectedPlanId, selectedBookmark.id);
          }
        }}
        completionSheetOpen={completionSheetOpen}
        completionBookmark={completionBookmark}
        bestNextItem={view.bestNextItem}
        nextReason={view.nextReason}
        streakCount={streak}
        onCompletionOpenChange={setCompletionSheetOpen}
        onRate={mutations.handleRate}
        onPlayNext={view.bestNextItem?.source_url ? handlePlayNext : undefined}
        onScheduleNext={view.bestNextItem ? () => handleSchedule(view.bestNextItem!) : undefined}
        shouldShowWelcomeFlow={welcomeFlowActive}
        onWelcomeDismiss={dismissWelcomeFlow}
        onWelcomeSuggestionAdd={mutations.handleWelcomeSuggestionAdd}
        onWelcomeComplete={handleWelcomeComplete}
        showTour={showTour}
        demoActive={demoActive}
        onDismissTour={dismissTour}
      />
    </>
  );
};

export default Dashboard;
