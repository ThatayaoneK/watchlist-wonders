import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { bookmarkService } from "@/services/bookmarks";
import { queueService } from "@/services/queue";
import { scheduleService } from "@/services/schedules";
import { watchPlanService } from "@/services/watchPlans";
import { sharingService } from "@/services/sharing";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/errorMessage";
import { ToastAction } from "@/components/ui/toast";
import type { Bookmark } from "@/types/database";
import type { OnboardingSuggestion } from "@/components/onboarding/WelcomeFlow";

interface DashboardMutationCallbacks {
  onMarkDoneSuccess: (bookmark: Bookmark) => void;
  onPlanAdded: () => void;
}

export function useDashboardMutations({ onMarkDoneSuccess, onPlanAdded }: DashboardMutationCallbacks) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Mark done ───────────────────────────────────────────────────────────
  const undoDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, "backlog"),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) => (b.id === id ? { ...b, status: "backlog" } : b)),
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
    onSuccess: () => {
      toast({ title: "Added back to your list", description: "Ready to watch when you are." });
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, "done"),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) => (b.id === id ? { ...b, status: "done" } : b)),
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
    onSuccess: (_, id) => {
      const completed = queryClient.getQueryData<Bookmark[]>(["bookmarks"])?.find((b) => b.id === id);
      if (completed) onMarkDoneSuccess(completed);
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

  // ── Set watching ────────────────────────────────────────────────────────
  const setWatchingMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, "watching"),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) => (b.id === id ? { ...b, status: "watching" } : b)),
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
    onSuccess: () => {
      toast({ title: "Now watching!", description: "Added to Continue Watching." });
    },
  });

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleUndoDelete = useCallback(
    (bookmark: Bookmark) => {
      bookmarkService
        .updateBookmark(bookmark.id, bookmark)
        .then((restoredBookmark) => {
          queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
          toast({ title: "Restored", description: `"${restoredBookmark.title}" has been restored.` });
        })
        .catch((error: unknown) => {
          toast({
            title: "Error restoring bookmark",
            description: getSafeErrorMessage(error, "Failed to restore. Please try again."),
            variant: "destructive",
          });
        });
    },
    [queryClient, toast],
  );

  const deleteMutation = useMutation({
    mutationFn: (bookmark: Bookmark) => bookmarkService.deleteBookmark(bookmark.id),
    onMutate: async (bookmark) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.filter((b) => b.id !== bookmark.id),
      );
      return { prev };
    },
    onError: (error: unknown, _, ctx) => {
      queryClient.setQueryData(["bookmarks"], ctx?.prev);
      toast({
        title: "Error deleting",
        description: getSafeErrorMessage(error, "Something went wrong."),
        variant: "destructive",
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
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

  // ── Episodes ────────────────────────────────────────────────────────────
  const updateEpisodesMutation = useMutation({
    mutationFn: ({ id, count, existing }: { id: string; count: number; existing: Record<string, unknown> }) =>
      bookmarkService.updateBookmark(id, { metadata: { ...existing, episodes_watched: count } }),
    onMutate: async ({ id, count }) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) => (b.id === id ? { ...b, metadata: { ...b.metadata, episodes_watched: count } } : b)),
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  // ── Skip ────────────────────────────────────────────────────────────────
  const getSkippedPriority = (bookmark: Bookmark) => Math.max((bookmark.priority ?? 100) - 20, 40);

  const skipMutation = useMutation({
    mutationFn: async (bookmark: Bookmark) => {
      const maxRetries = 3;
      let lastError: unknown;
      
      // First, mark as shown
      await bookmarkService.markAsShown(bookmark.id);
      
      // Then attempt queue update with retries
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (bookmark.queue_status === "up_next") {
            await queueService.toggleUpNext(bookmark.id, false);
          } else {
            await queueService.setPriority(bookmark.id, getSkippedPriority(bookmark));
          }
          return; // Success
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries - 1) {
            // Exponential backoff: 100ms, 200ms, 400ms
            await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
          }
        }
      }
      
      // If all retries failed, attempt to compensate by reverting markAsShown
      try {
        // Revert the shown counter by marking it unshown
        await bookmarkService.updateBookmark(bookmark.id, {
          last_shown_at: bookmark.last_shown_at,
          shown_count: bookmark.shown_count,
        });
      } catch (compensateError) {
        console.error('[skipMutation] Failed to compensate after queue update failure', compensateError);
      }
      
      throw lastError;
    },
    onMutate: async (bookmark) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      const skippedAt = new Date().toISOString();
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) =>
          b.id !== bookmark.id
            ? b
            : {
                ...b,
                last_shown_at: skippedAt,
                shown_count: (b.shown_count ?? 0) + 1,
                queue_status: b.queue_status === "up_next" ? "queued" : b.queue_status,
                priority: b.queue_status === "up_next" ? 100 : getSkippedPriority(b),
              },
        ),
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
    onSuccess: (_, bookmark) => {
      toast({
        title: "Skipped for now",
        description: `"${bookmark.title}" moved down. We'll suggest a different pick next.`,
      });
    },
  });

  // ── Up Next ─────────────────────────────────────────────────────────────
  const toggleUpNextMutation = useMutation({
    mutationFn: ({ id, promote }: { id: string; promote: boolean }) =>
      queueService.toggleUpNext(id, promote),
    onMutate: async ({ id, promote }) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) =>
          b.id === id
            ? { ...b, queue_status: promote ? "up_next" : "queued", priority: promote ? 200 : 100 }
            : b,
        ),
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
    onSuccess: (_, { promote }) => {
      toast({
        title: promote ? "Added to Up Next" : "Removed from Up Next",
        description: promote
          ? "This will appear at the top of your queue."
          : "Moved back to your main queue.",
      });
    },
  });

  // ── Add to plan ─────────────────────────────────────────────────────────
  const addToPlanMutation = useMutation({
    mutationFn: ({ planId, bookmarkId }: { planId: string; bookmarkId: string }) =>
      watchPlanService.addBookmarkToPlan(planId, bookmarkId),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ["watch-plans"] });
      queryClient.invalidateQueries({ queryKey: ["plan-bookmarks", planId] });
      onPlanAdded();
      toast({ title: "Added to plan!", description: "Bookmark added to your watch plan." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error adding to plan",
        description: getSafeErrorMessage(error, "Something went wrong."),
        variant: "destructive",
      });
    },
  });

  // ── Rate ────────────────────────────────────────────────────────────────
  const rateMutation = useMutation({
    mutationFn: async ({
      id,
      rating,
      review,
      watchedWith,
      existingMetadata,
    }: {
      id: string;
      rating: number | undefined;
      review?: string;
      watchedWith?: string | null;
      existingMetadata?: Record<string, unknown>;
    }) => {
      const tasks: Promise<unknown>[] = [];
      if (rating != null && rating > 0) tasks.push(bookmarkService.rateBookmark(id, rating, review));
      if (watchedWith !== undefined) {
        const existing = existingMetadata ??
          queryClient.getQueryData<Bookmark[]>(["bookmarks"])?.find((b) => b.id === id)?.metadata ?? {};
        tasks.push(bookmarkService.updateBookmark(id, { metadata: { ...existing, watched_with: watchedWith } }));
      }
      await Promise.all(tasks);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  // ── Share / Vault async handlers ────────────────────────────────────────
  const handleSharePublic = useCallback(
    async (bookmark: Bookmark) => {
      try {
        const token = await sharingService.makeBookmarkPublic(bookmark.id);
        await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        const shareUrl = `${window.location.origin}/share/${token}`;
        let copied = false;
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(shareUrl);
            copied = true;
          } catch {
            copied = false;
          }
        }
        toast({
          title: copied ? "Public link copied" : "Public link ready",
          description: copied ? "Anyone with the link can view this bookmark." : shareUrl,
        });
      } catch (error) {
        toast({
          title: "Couldn't create public link",
          description: getSafeErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      }
    },
    [queryClient, toast],
  );

  const handleSharePrivate = useCallback(
    async (bookmark: Bookmark) => {
      try {
        await sharingService.makeBookmarkPrivate(bookmark.id);
        await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        toast({ title: "Sharing turned off", description: `"${bookmark.title}" is now private.` });
      } catch (error) {
        toast({
          title: "Couldn't update sharing",
          description: getSafeErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      }
    },
    [queryClient, toast],
  );

  const handleVault = useCallback(
    async (bookmark: Bookmark) => {
      try {
        await bookmarkService.updateBookmark(bookmark.id, { is_vaulted: true });
        await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        toast({ title: "Moved to Vault", description: `"${bookmark.title}" is hidden from your dashboard.` });
      } catch (error) {
        toast({
          title: "Couldn't move to Vault",
          description: getSafeErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      }
    },
    [queryClient, toast],
  );

  const handleUnvault = useCallback(
    async (bookmark: Bookmark) => {
      try {
        await bookmarkService.updateBookmark(bookmark.id, { is_vaulted: false });
        await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        toast({
          title: "Removed from Vault",
          description: `"${bookmark.title}" is visible on your dashboard again.`,
        });
      } catch (error) {
        toast({
          title: "Couldn't remove from Vault",
          description: getSafeErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      }
    },
    [queryClient, toast],
  );

  // ── Missed schedule skip ────────────────────────────────────────────────
  const handleMissedScheduleSkip = useCallback(
    (schedId: string) => {
      scheduleService
        .cancelSchedule(schedId)
        .then(async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["schedules"] }),
            queryClient.invalidateQueries({ queryKey: ["schedules", "missed"] }),
          ]);
          toast({ title: "Schedule skipped", description: "Removed from your missed schedules." });
        })
        .catch((error: unknown) => {
          toast({
            title: "Could not skip schedule",
            description: getSafeErrorMessage(error, "Please try again."),
            variant: "destructive",
          });
        });
    },
    [queryClient, toast],
  );

  // ── Composed handler callbacks ──────────────────────────────────────────
  const handleMarkDone = useCallback(
    (bookmark: Bookmark) => markDoneMutation.mutate(bookmark.id),
    [markDoneMutation],
  );
  const handleUndoDone = useCallback(
    (bookmark: Bookmark) => undoDoneMutation.mutate(bookmark.id),
    [undoDoneMutation],
  );
  const handleSetWatching = useCallback(
    (bookmark: Bookmark) => setWatchingMutation.mutate(bookmark.id),
    [setWatchingMutation],
  );
  const handleDelete = useCallback(
    (bookmark: Bookmark) => deleteMutation.mutate(bookmark),
    [deleteMutation],
  );
  const handleStatusCycle = useCallback(
    (bookmark: Bookmark, newStatus: string) => {
      if (newStatus === "done") markDoneMutation.mutate(bookmark.id);
      else if (newStatus === "watching") setWatchingMutation.mutate(bookmark.id);
      else undoDoneMutation.mutate(bookmark.id);
    },
    [markDoneMutation, setWatchingMutation, undoDoneMutation],
  );
  const handleEpisodeUpdate = useCallback(
    (bookmark: Bookmark, count: number) =>
      updateEpisodesMutation.mutate({ id: bookmark.id, count, existing: bookmark.metadata ?? {} }),
    [updateEpisodesMutation],
  );
  const handleSkip = useCallback(
    (bookmark: Bookmark) => skipMutation.mutate(bookmark),
    [skipMutation],
  );
  const handleToggleUpNext = useCallback(
    (bookmark: Bookmark) =>
      toggleUpNextMutation.mutate({ id: bookmark.id, promote: bookmark.queue_status !== "up_next" }),
    [toggleUpNextMutation],
  );
  const handleAddToPlanSubmit = useCallback(
    (planId: string, bookmarkId: string) => addToPlanMutation.mutate({ planId, bookmarkId }),
    [addToPlanMutation],
  );
  const handleRate = useCallback(
    (id: string, rating: number | undefined, review?: string, watchedWith?: string | null) => {
      const existingMetadata =
        queryClient.getQueryData<Bookmark[]>(["bookmarks"])?.find((b) => b.id === id)?.metadata;
      rateMutation.mutate({ id, rating, review, watchedWith, existingMetadata });
    },
    [rateMutation, queryClient],
  );

  const handleWelcomeSuggestionAdd = useCallback(
    async (suggestion: OnboardingSuggestion) => {
      try {
        await bookmarkService.createBookmark({
          title: suggestion.title,
          type: suggestion.type,
          provider: suggestion.provider,
          source_url: null,
          canonical_url: null,
          platform_label: null,
          status: "backlog",
          runtime_minutes: null,
          release_year: suggestion.release_year,
          poster_url: suggestion.poster_url,
          mood_tags: suggestion.genres.map((g) => g.toLowerCase()),
          tags: ["onboarding", ...suggestion.genres.map((g) => g.toLowerCase())],
          metadata: {
            onboarding_seed: true,
            onboarding_suggestion_id: suggestion.id,
            onboarding_genres: suggestion.genres,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        toast({ title: "Added to watchlist", description: suggestion.title });
      } catch (error) {
        toast({
          title: "Couldn't add title",
          description: getSafeErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      }
    },
    [queryClient, toast],
  );

  const handleWelcomeComplete = useCallback(
    async (
      payload: { genres: string[]; providers: string[]; addedSuggestionIds: string[] },
      savePreferences: (prefs: Record<string, unknown>) => Promise<void>,
      onDone: () => void,
    ) => {
      try {
        await savePreferences({
          favorite_genres: payload.genres,
          preferred_providers: payload.providers,
          onboarding_added_ids: payload.addedSuggestionIds,
          onboarding_completed_at: new Date().toISOString(),
        });
        onDone();
        toast({ title: "Setup complete", description: "We'll use these picks for future recommendations." });
      } catch (error) {
        toast({
          title: "Couldn't save onboarding preferences",
          description: getSafeErrorMessage(error, "Please try again."),
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleNavigatePlans = useCallback(() => navigate("/plans"), [navigate]);

  return {
    handleMarkDone,
    handleUndoDone,
    handleSetWatching,
    handleDelete,
    handleStatusCycle,
    handleEpisodeUpdate,
    handleSkip,
    handleToggleUpNext,
    handleAddToPlanSubmit,
    handleRate,
    handleSharePublic,
    handleSharePrivate,
    handleVault,
    handleUnvault,
    handleMissedScheduleSkip,
    handleWelcomeSuggestionAdd,
    handleWelcomeComplete,
    handleNavigatePlans,
    addToPlanIsPending: addToPlanMutation.isPending,
  };
}
