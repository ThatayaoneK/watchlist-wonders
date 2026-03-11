import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock, Shuffle, ArrowUpDown, Play, Check } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { HeroBanner } from "@/components/layout/HeroBanner";
import { Rail } from "@/components/bookmarks/Rail";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { FilterChips } from "@/components/dashboard/FilterChips";
import { FilterPanel, type AdvancedFilters } from "@/components/dashboard/FilterPanel";
import { BulkActionBar } from "@/components/dashboard/BulkActionBar";
import { SkeletonRail } from "@/components/ui/skeleton-card";
import { EmptyStateGuide } from "@/components/EmptyStateGuide";
import { DashboardTour } from "@/components/onboarding/DashboardTour";
import { useDashboardTour } from "@/hooks/useDashboardTour";
import { CompletionSheet } from "@/components/bookmarks/CompletionSheet";
import { bookmarkService } from "@/services/bookmarks";
import { scheduleService } from "@/services/schedules";
import { ScheduleDialog } from "@/components/schedules/ScheduleDialog";
import { watchPlanService } from "@/services/watchPlans";
import { notificationService } from "@/services/notifications";
import { useToast } from "@/hooks/use-toast";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRuntime } from "@/lib/utils";

type FilterType = "all" | "movie" | "series" | "video" | "doc";
type FilterStatus = "all" | "backlog" | "watching" | "done";
type SortOption = "newest" | "oldest" | "az" | "runtime" | "rating";

const Dashboard = () => {
  const navigate = useNavigate();
  const { isSearchOpen, openSearch, closeSearch } = useSearchShortcut();
  const { showTour, dismissTour } = useDashboardTour();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [completionBookmark, setCompletionBookmark] = useState<Bookmark | null>(null);
  const [completionSheetOpen, setCompletionSheetOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  
  // Filter state
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    providers: [], moods: [], runtimeMin: null, runtimeMax: null,
  });

  // Sort + Surprise Me state
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [surpriseBookmark, setSurpriseBookmark] = useState<Bookmark | null>(null);

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch bookmarks
  const { data: bookmarks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  // Fetch upcoming schedules for "Up Next" rail
  const { data: upcomingSchedules = [] } = useQuery({
    queryKey: ['schedules', 'upcoming'],
    queryFn: () => scheduleService.getUpcomingSchedules(8),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch notification count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationService.getUnreadCount(),
    staleTime: 60 * 1000,
  });

  // Fetch watch plans for the "Add to Plan" dialog
  const { data: plans = [] } = useQuery({
    queryKey: ['watch-plans'],
    queryFn: () => watchPlanService.getWatchPlans(),
  });

  // Calculate filter counts
  const filterCounts = useMemo(() => ({
    movie: bookmarks.filter((b) => b.type === "movie").length,
    series: bookmarks.filter((b) => b.type === "series").length,
    video: bookmarks.filter((b) => b.type === "video").length,
    doc: bookmarks.filter((b) => b.type === "doc").length,
    backlog: bookmarks.filter((b) => b.status === "backlog").length,
    watching: bookmarks.filter((b) => b.status === "watching").length,
    done: bookmarks.filter((b) => b.status === "done").length,
  }), [bookmarks]);

  // Apply filters + sort
  const filteredBookmarks = useMemo(() => {
    const hasAdvanced =
      advancedFilters.providers.length > 0 ||
      advancedFilters.moods.length > 0 ||
      advancedFilters.runtimeMin !== null ||
      advancedFilters.runtimeMax !== null;

    const filtered = bookmarks.filter((b) => {
      const typeMatch = filterType === "all" || b.type === filterType;
      const statusMatch = filterStatus === "all" || b.status === filterStatus;
      if (!typeMatch || !statusMatch) return false;
      if (!hasAdvanced) return true;
      const providerMatch = advancedFilters.providers.length === 0 || advancedFilters.providers.includes(b.provider);
      const moodMatch = advancedFilters.moods.length === 0 || (b.mood_tags || []).some((m) => advancedFilters.moods.includes(m));
      const rtMin = advancedFilters.runtimeMin;
      const rtMax = advancedFilters.runtimeMax;
      const runtimeMatch =
        (rtMin === null || (b.runtime_minutes !== null && b.runtime_minutes >= rtMin)) &&
        (rtMax === null || (b.runtime_minutes !== null && b.runtime_minutes <= rtMax));
      return providerMatch && moodMatch && runtimeMatch;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "oldest": return a.created_at.localeCompare(b.created_at);
        case "az": return a.title.localeCompare(b.title);
        case "runtime": return (b.runtime_minutes || 0) - (a.runtime_minutes || 0);
        case "rating": return (b.user_rating || 0) - (a.user_rating || 0);
        default: return b.created_at.localeCompare(a.created_at); // newest
      }
    });
  }, [bookmarks, filterType, filterStatus, advancedFilters, sortBy]);

  // Mark as done mutation
  const markDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'done'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const prev = queryClient.getQueryData<Bookmark[]>(['bookmarks']);
      queryClient.setQueryData<Bookmark[]>(['bookmarks'], (old = []) =>
        old.map((b) => b.id === id ? { ...b, status: 'done' } : b)
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['bookmarks'], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onSuccess: (_, id) => {
      const completed = queryClient.getQueryData<Bookmark[]>(['bookmarks'])?.find((b) => b.id === id);
      if (completed) {
        setCompletionBookmark(completed);
        setCompletionSheetOpen(true);
      }
      toast({
        title: "Marked as done!",
        description: "Moved to your watched list.",
        action: (
          <ToastAction altText="Undo" onClick={() => undoDoneMutation.mutate(id)}>
            Undo
          </ToastAction>
        ),
      });
    },
  });

  // Rate a completed bookmark (from CompletionSheet)
  const rateMutation = useMutation({
    mutationFn: async ({ id, rating, review, watchedWith }: { id: string; rating: number | undefined; review?: string; watchedWith?: string | null }) => {
      const tasks: Promise<unknown>[] = [];
      if (rating != null && rating > 0) tasks.push(bookmarkService.rateBookmark(id, rating, review));
      if (watchedWith) {
        const existing = queryClient.getQueryData<Bookmark[]>(['bookmarks'])?.find((b) => b.id === id)?.metadata ?? {};
        tasks.push(bookmarkService.updateBookmark(id, { metadata: { ...existing, watched_with: watchedWith } }));
      }
      await Promise.all(tasks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
  });

  // Undo done mutation (move back to backlog)
  const undoDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'backlog'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const prev = queryClient.getQueryData<Bookmark[]>(['bookmarks']);
      queryClient.setQueryData<Bookmark[]>(['bookmarks'], (old = []) =>
        old.map((b) => b.id === id ? { ...b, status: 'backlog' } : b)
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['bookmarks'], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onSuccess: () => {
      toast({ title: "Added back to your list", description: "Ready to watch when you are." });
    },
  });

  // Set as watching mutation
  const setWatchingMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'watching'),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const prev = queryClient.getQueryData<Bookmark[]>(['bookmarks']);
      queryClient.setQueryData<Bookmark[]>(['bookmarks'], (old = []) =>
        old.map((b) => b.id === id ? { ...b, status: 'watching' } : b)
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['bookmarks'], ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onSuccess: () => {
      toast({ title: "Now watching!", description: "Added to Continue Watching." });
    },
  });

  // Undo delete — recreate the bookmark with its original data
  const handleUndoDelete = (bookmark: Bookmark) => {
    bookmarkService.createBookmark({
      title: bookmark.title,
      type: bookmark.type,
      provider: bookmark.provider,
      source_url: bookmark.source_url,
      canonical_url: bookmark.canonical_url,
      platform_label: bookmark.platform_label,
      status: bookmark.status,
      runtime_minutes: bookmark.runtime_minutes,
      release_year: bookmark.release_year,
      poster_url: bookmark.poster_url,
      backdrop_url: bookmark.backdrop_url,
      tags: bookmark.tags,
      mood_tags: bookmark.mood_tags,
      notes: bookmark.notes,
      metadata: bookmark.metadata,
    }).then((newBookmark) => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({
        title: "Restored",
        description: `"${newBookmark.title}" has been restored to your watchlist.`,
      });
    }).catch((error: any) => {
      toast({
        title: "Error restoring bookmark",
        description: error.message || "Failed to restore the bookmark. Please try again.",
        variant: "destructive",
      });
    });
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (bookmark: Bookmark) => bookmarkService.deleteBookmark(bookmark.id),
    onMutate: async (bookmark) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      const prev = queryClient.getQueryData<Bookmark[]>(['bookmarks']);
      queryClient.setQueryData<Bookmark[]>(['bookmarks'], (old = []) =>
        old.filter((b) => b.id !== bookmark.id)
      );
      return { prev };
    },
    onError: (error: any, _, ctx) => {
      queryClient.setQueryData(['bookmarks'], ctx?.prev);
      toast({
        title: "Error deleting",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onSuccess: (_, bookmark) => {
      toast({
        title: "Deleted",
        description: `"${bookmark.title}" removed.`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndoDelete(bookmark)}>
            Undo
          </ToastAction>
        ),
      });
    },
  });

  // Add to plan mutation
  const addToPlanMutation = useMutation({
    mutationFn: ({ planId, bookmarkId }: { planId: string; bookmarkId: string }) =>
      watchPlanService.addBookmarkToPlan(planId, bookmarkId),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ['watch-plans'] });
      queryClient.invalidateQueries({ queryKey: ['plan-bookmarks', planId] });
      setPlanOpen(false);
      setSelectedBookmark(null);
      toast({
        title: "Added to plan!",
        description: "Bookmark added to your watch plan.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding to plan",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const handleSchedule = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setScheduleOpen(true);
  };

  const handleMarkDone = (bookmark: Bookmark) => {
    markDoneMutation.mutate(bookmark.id);
  };

  const handleUndoDone = (bookmark: Bookmark) => {
    undoDoneMutation.mutate(bookmark.id);
  };

  const handleSetWatching = (bookmark: Bookmark) => {
    setWatchingMutation.mutate(bookmark.id);
  };

  const handleDelete = (bookmark: Bookmark) => {
    deleteMutation.mutate(bookmark);
  };

  const handleStatusCycle = (bookmark: Bookmark, newStatus: string) => {
    if (newStatus === "done") markDoneMutation.mutate(bookmark.id);
    else if (newStatus === "watching") setWatchingMutation.mutate(bookmark.id);
    else undoDoneMutation.mutate(bookmark.id);
  };

  // Episode update mutation
  const updateEpisodesMutation = useMutation({
    mutationFn: ({ id, count, existing }: { id: string; count: number; existing: Record<string, unknown> }) =>
      bookmarkService.updateBookmark(id, { metadata: { ...existing, episodes_watched: count } }),
    onMutate: async ({ id, count }) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) => b.id === id ? { ...b, metadata: { ...b.metadata, episodes_watched: count } } : b)
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const handleEpisodeUpdate = (bookmark: Bookmark, count: number) => {
    updateEpisodesMutation.mutate({ id: bookmark.id, count, existing: bookmark.metadata ?? {} });
  };

  const handleAddToPlan = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setSelectedPlanId("");
    setPlanOpen(true);
  };

  const handleAddToPlanSubmit = () => {
    if (!selectedBookmark || !selectedPlanId) return;
    addToPlanMutation.mutate({
      planId: selectedPlanId,
      bookmarkId: selectedBookmark.id,
    });
  };

  const toggleSelect = (bookmarkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookmarkId)) next.delete(bookmarkId);
      else next.add(bookmarkId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => bookmarkService.deleteBookmark(id)));
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    if (succeeded.length > 0) queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    setSelectedIds(new Set(failedIds));
    if (failedIds.length === 0) {
      toast({ title: `Deleted ${succeeded.length} bookmark${succeeded.length !== 1 ? "s" : ""}` });
    } else {
      toast({
        title: `Deleted ${succeeded.length} of ${ids.length}`,
        description: `${failedIds.length} could not be deleted`,
        variant: "destructive",
      });
    }
  };

  const handleBulkMarkDone = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => bookmarkService.updateStatus(id, 'done')));
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    if (succeeded.length > 0) queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    setSelectedIds(new Set(failedIds));
    if (failedIds.length === 0) {
      toast({ title: `Marked ${succeeded.length} as done` });
    } else {
      toast({
        title: `Marked ${succeeded.length} of ${ids.length} as done`,
        description: `${failedIds.length} could not be updated`,
        variant: "destructive",
      });
    }
  };

  const handleBulkAddToPlan = async (planId: string) => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => watchPlanService.addBookmarkToPlan(planId, id)));
    const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
    setSelectedIds(new Set(failedIds));
    if (failedIds.length === 0) {
      toast({ title: `Added ${succeeded.length} to plan` });
    } else {
      toast({
        title: `Added ${succeeded.length} of ${ids.length} to plan`,
        description: `${failedIds.length} could not be added`,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav onSearchClick={openSearch} notificationCount={0} />
        <div className="container mx-auto px-4 lg:px-8 pt-24 pb-8 space-y-4">
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-destructive mb-2">Error loading bookmarks</p>
          <p className="text-muted-foreground text-sm">Something went wrong fetching your data.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // Check if filters are active (basic or advanced)
  const hasActiveFilters =
    filterType !== "all" ||
    filterStatus !== "all" ||
    advancedFilters.providers.length > 0 ||
    advancedFilters.moods.length > 0 ||
    advancedFilters.runtimeMin !== null ||
    advancedFilters.runtimeMax !== null;

  const totalActiveFilterCount =
    (filterType !== "all" ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    advancedFilters.providers.length +
    advancedFilters.moods.length +
    (advancedFilters.runtimeMin !== null ? 1 : 0) +
    (advancedFilters.runtimeMax !== null ? 1 : 0);

  // Group bookmarks (use filtered if filters active, otherwise use all)
  const displayBookmarks = hasActiveFilters ? filteredBookmarks : bookmarks;
  const continueWatching = displayBookmarks.filter((b) => b.status === "watching");
  const backlog = displayBookmarks.filter((b) => b.status === "backlog");
  const completed = displayBookmarks.filter((b) => b.status === "done");

  // Hero bookmark: only show when actively watching something
  const heroBookmark = continueWatching[0] || null;

  // Group by mood
  const byMood: Record<string, Bookmark[]> = {};
  displayBookmarks.forEach((b) => {
    (b.mood_tags || []).forEach((mood) => {
      if (!byMood[mood]) byMood[mood] = [];
      byMood[mood].push(b);
    });
  });

  const handleSurpriseMe = () => {
    const pool = backlog.length > 0 ? backlog : displayBookmarks;
    if (pool.length === 0) return;
    setSurpriseBookmark(pool[Math.floor(Math.random() * pool.length)]);
  };

  const handlePlay = () => {
    if (heroBookmark?.source_url) {
      window.open(heroBookmark.source_url, "_blank");
    }
  };

  const handleMoreInfo = () => {
    if (heroBookmark) {
      navigate(`/b/${heroBookmark.id}`);
    }
  };

  // Empty state check
  const isEmpty = bookmarks.length === 0;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav onSearchClick={openSearch} notificationCount={unreadCount} />

      {/* Hero Banner — only when actively watching */}
      {heroBookmark && (
        <HeroBanner
          bookmark={heroBookmark}
          onPlay={handlePlay}
          onMoreInfo={handleMoreInfo}
        />
      )}

      {/* Main content area */}
      <div className={cn(
        "relative z-10 pb-16 space-y-4",
        heroBookmark ? "-mt-24" : "pt-20"
      )}>

        {/* Filter Chips + Toolbar */}
        {bookmarks.length > 0 && (
          <div id="filter-toolbar" className="animate-fade-in">
            <div className="container mx-auto px-4 lg:px-8 flex items-center gap-3">
              {/* Scrollable filter pills — takes remaining space */}
              <FilterChips
                activeType={filterType}
                activeStatus={filterStatus}
                onTypeChange={setFilterType}
                onStatusChange={setFilterStatus}
                counts={filterCounts}
                className="flex-1 min-w-0"
              />
              {/* Right controls — always visible, compact */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSurpriseMe}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Surprise me — pick a random title"
                  aria-label="Surprise me, pick a random title"
                >
                  <Shuffle className="w-4 h-4" />
                </Button>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="h-8 text-xs w-[100px] gap-1 border-0 bg-transparent text-muted-foreground hover:text-foreground">
                    <ArrowUpDown className="w-3 h-3 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="az">A–Z</SelectItem>
                    <SelectItem value="runtime">Runtime</SelectItem>
                    <SelectItem value="rating">My Rating</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={filterPanelOpen ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterPanelOpen((v) => !v)}
                  className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Filters
                  {totalActiveFilterCount > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                      {totalActiveFilterCount}
                    </span>
                  )}
                </Button>
                <Button
                  variant={selectMode ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  {selectMode ? "Cancel" : "Select"}
                </Button>
              </div>
            </div>
            {filterPanelOpen && (
              <div className="mt-2">
                <FilterPanel
                  onApply={(f) => { setAdvancedFilters(f); }}
                  onReset={() => { setAdvancedFilters({ providers: [], moods: [], runtimeMin: null, runtimeMax: null }); }}
                />
              </div>
            )}
          </div>
        )}

        {/* Rails */}
        <div className="space-y-4 animate-fade-in">
          {/* Up Next — upcoming scheduled items */}
          {upcomingSchedules.length > 0 && (
            <section className="py-4">
              <div className="container mx-auto px-4 lg:px-8 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <CalendarClock className="w-5 h-5 text-wm-gold" />
                      Up Next
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Scheduled & coming up</p>
                  </div>
                  <Link to="/calendar" className="text-xs text-primary hover:underline">
                    View calendar
                  </Link>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto px-4 lg:px-8 pb-2" style={{ scrollbarWidth: "none" }}>
                {upcomingSchedules.map((sched) => {
                  const bm = sched.bookmarks;
                  if (!bm) return null;
                  const rawDate = sched.scheduled_for ? new Date(sched.scheduled_for) : null;
                  const scheduledDate = rawDate && isFinite(rawDate.getTime()) ? rawDate : null;
                  const isToday = scheduledDate ? scheduledDate.toDateString() === new Date().toDateString() : false;
                  return (
                    <Link
                      key={sched.id}
                      to={`/b/${bm.id}`}
                      className="shrink-0 w-56 bg-wm-surface border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all group"
                    >
                      {/* Poster strip */}
                      <div className="relative h-28 bg-muted overflow-hidden">
                        {bm.backdrop_url || bm.poster_url ? (
                          <img
                            src={bm.backdrop_url || bm.poster_url || ""}
                            alt={bm.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-3xl font-bold text-muted-foreground">{bm.title.charAt(0)}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                        {/* Time badge */}
                        {scheduledDate && (
                          <div className={cn(
                            "absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                            isToday ? "bg-primary text-primary-foreground" : "bg-wm-gold text-background"
                          )}>
                            {isToday ? `Today ${format(scheduledDate, "h:mm a")}` : format(scheduledDate, "EEE, MMM d")}
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {bm.title}
                        </p>
                        {bm.runtime_minutes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {bm.runtime_minutes < 60 ? `${bm.runtime_minutes}m` : `${Math.floor(bm.runtime_minutes / 60)}h ${bm.runtime_minutes % 60}m`}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <Rail
            title="Continue Watching"
            bookmarks={continueWatching}
            onSchedule={handleSchedule}
            onMarkDone={handleMarkDone}
            onAddToPlan={handleAddToPlan}
            onDelete={handleDelete}
            onUndoDone={handleUndoDone}
            onSetWatching={handleSetWatching}
            onStatusCycle={handleStatusCycle}
            onEpisodeUpdate={handleEpisodeUpdate}
            isSelectable={selectMode}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
          />

          <div id="backlog-rail">
            <Rail
              title="Saved for Later"
              subtitle="Ready when you are"
              bookmarks={backlog}
              onSchedule={handleSchedule}
              onMarkDone={handleMarkDone}
              onAddToPlan={handleAddToPlan}
              onDelete={handleDelete}
              onUndoDone={handleUndoDone}
              onSetWatching={handleSetWatching}
              onStatusCycle={handleStatusCycle}
              onEpisodeUpdate={handleEpisodeUpdate}
              isSelectable={selectMode}
              selectedIds={selectedIds}
              onSelect={toggleSelect}
            />
          </div>

          {/* Mood Rails */}
          {Object.entries(byMood)
            .filter(([_, items]) => items.length >= 2)
            .sort(([, a], [, b]) => b.length - a.length)
            .slice(0, 3)
            .map(([mood, items]) => (
              <Rail
                key={mood}
                title={`${mood.charAt(0).toUpperCase()}${mood.slice(1)} Picks`}
                bookmarks={items}
                onSchedule={handleSchedule}
                onMarkDone={handleMarkDone}
                onAddToPlan={handleAddToPlan}
                onDelete={handleDelete}
                onUndoDone={handleUndoDone}
                onSetWatching={handleSetWatching}
                onStatusCycle={handleStatusCycle}
                onEpisodeUpdate={handleEpisodeUpdate}
                isSelectable={selectMode}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
              />
            ))}

          <Rail
            title="Recently Watched"
            bookmarks={completed}
            onSchedule={handleSchedule}
            onMarkDone={handleMarkDone}
            onAddToPlan={handleAddToPlan}
            onDelete={handleDelete}
            onUndoDone={handleUndoDone}
            onSetWatching={handleSetWatching}
            onStatusCycle={handleStatusCycle}
            onEpisodeUpdate={handleEpisodeUpdate}
            isSelectable={selectMode}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
          />

          {/* Filtered empty state */}
          {hasActiveFilters && filteredBookmarks.length === 0 && (
            <div className="container mx-auto px-4 lg:px-8 text-center py-16">
              <p className="text-muted-foreground mb-4">No bookmarks match your filters</p>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterType("all");
                  setFilterStatus("all");
                  setAdvancedFilters({ providers: [], moods: [], runtimeMin: null, runtimeMax: null });
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Empty state — new user */}
          {isEmpty && (
            <div className="container mx-auto px-4 lg:px-8">
              <EmptyStateGuide />
            </div>
          )}
        </div>
      </div>

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        bookmarks={bookmarks}
      />

      {/* Schedule Dialog */}
      <ScheduleDialog
        bookmark={selectedBookmark}
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setSelectedBookmark(null);
        }}
      />

      {/* Add to Plan Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Watch Plan</DialogTitle>
            <DialogDescription>
              Choose a plan to add "{selectedBookmark?.title}" to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {plans.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">No watch plans yet</p>
                <Button onClick={() => { setPlanOpen(false); navigate('/plans'); }}>
                  Create a Plan
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="plan-select">Select Plan</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="ghost" onClick={() => setPlanOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddToPlanSubmit} 
                    disabled={addToPlanMutation.isPending || !selectedPlanId}
                  >
                    {addToPlanMutation.isPending ? "Adding..." : "Add to Plan"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        plans={plans}
        onDeleteAll={handleBulkDelete}
        onMarkDone={handleBulkMarkDone}
        onAddToPlan={handleBulkAddToPlan}
        onClear={() => { setSelectedIds(new Set()); setSelectMode(false); }}
      />

      {/* Completion Rating Sheet */}
      <CompletionSheet
        bookmark={completionBookmark}
        open={completionSheetOpen}
        onOpenChange={setCompletionSheetOpen}
        onRate={(id, rating, review, watchedWith) => rateMutation.mutate({ id, rating, review, watchedWith })}
        onSkip={() => setCompletionSheetOpen(false)}
      />

      {/* Onboarding Tour */}
      <DashboardTour
        open={showTour}
        onDismiss={dismissTour}
        onFinish={dismissTour}
      />

      {/* Surprise Me Sheet */}
      <Sheet open={!!surpriseBookmark} onOpenChange={(o) => { if (!o) setSurpriseBookmark(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          {surpriseBookmark && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-primary" />
                  Watch Tonight
                </SheetTitle>
              </SheetHeader>
              <div className="flex gap-4">
                {(surpriseBookmark.poster_url || surpriseBookmark.backdrop_url) && (
                  <img
                    src={surpriseBookmark.poster_url || surpriseBookmark.backdrop_url!}
                    alt={surpriseBookmark.title}
                    className="w-20 h-28 object-cover rounded-lg shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{surpriseBookmark.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {surpriseBookmark.release_year && <span>{surpriseBookmark.release_year}</span>}
                    {surpriseBookmark.runtime_minutes && (
                      <span>· {formatRuntime(surpriseBookmark.runtime_minutes)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {surpriseBookmark.source_url && (
                      <Button size="sm" onClick={() => window.open(surpriseBookmark.source_url!, "_blank")}>
                        <Play className="w-3 h-3 mr-1 fill-current" />
                        Watch Now
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => {
                      const id = surpriseBookmark.id;
                      markDoneMutation.mutate(id);
                      setSurpriseBookmark(null);
                    }}>
                      <Check className="w-3 h-3 mr-1" />
                      Mark Done
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigate(`/b/${surpriseBookmark.id}`);
                      setSurpriseBookmark(null);
                    }}>
                      Details
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleSurpriseMe}>
                      <Shuffle className="w-3 h-3 mr-1" />
                      Reroll
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
};

export default Dashboard;
