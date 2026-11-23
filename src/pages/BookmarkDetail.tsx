import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Play, Check, Trash2, Edit2,
  Tag, ExternalLink, Save, X,
  FileText, Download, Upload, Loader2, Star,
  Globe, Lock, Unlock, Copy, Plus,
  CalendarCheck, ThumbsUp, ThumbsDown, Share2, MoreHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import { buildBookmarkDeepLink } from "@watchmarks/shared/deep-links";
import { useWatchProviders } from "@/hooks/useWatchProviders";
import { useTmdbSearch } from "@/hooks/useTmdbSearch";
import { useSimilarTitles } from "@/hooks/useSimilarTitles";
import { useTmdbDetails } from "@/hooks/useTmdbDetails";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sharingService } from "@/services/sharing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { bookmarkService } from "@/services/bookmarks";
import { attachmentService } from "@/services/attachments";
import { useToast } from "@/hooks/use-toast";
import { getPreferredRegionFromBrowser } from "@/lib/localeRegion";
import { formatRuntime, getMoodEmoji } from "@/lib/utils";
import {
  buildAvailabilityFromWatchProviders,
  buildFallbackSearchUrls,
  DEFAULT_WATCH_REGION,
  getAvailabilityFromBookmark,
  isAvailabilityFresh,
  resolveAndFetchAvailability,
  type BookmarkAvailability,
} from "@/services/watchAvailability";
import { TmdbCandidatePicker } from "@/components/bookmarks/TmdbCandidatePicker";
import { parseMatchCandidates, type EnrichmentMatchCandidate } from "@/lib/enrichmentSmartFill";
import type { Bookmark } from "@/types/database";

type Tab = "overview" | "details" | "similar";

function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

const STATUS_OPTIONS: { value: Bookmark["status"]; label: string }[] = [
  { value: "backlog", label: "Want to Watch" },
  { value: "watching", label: "Currently Watching" },
  { value: "done", label: "Watched" },
  { value: "dropped", label: "Not for Me" },
  { value: "scheduled", label: "Scheduled" },
];

const STATUS_CONFIG: Record<Bookmark["status"], { dotClass: string; borderClass: string }> = {
  backlog:   { dotClass: "bg-muted-foreground",   borderClass: "border-l-muted-foreground" },
  watching:  { dotClass: "bg-blue-500",            borderClass: "border-l-blue-500" },
  done:      { dotClass: "bg-green-500",           borderClass: "border-l-green-500" },
  dropped:   { dotClass: "bg-destructive/70",      borderClass: "border-l-destructive/70" },
  scheduled: { dotClass: "bg-amber-400",           borderClass: "border-l-amber-400" },
};

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "similar", label: "Similar" },
];

const BookmarkDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [watchDialogOpen, setWatchDialogOpen] = useState(false);
  const [resolutionPickerOpen, setResolutionPickerOpen] = useState(false);
  const [isOpeningWatch, setIsOpeningWatch] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const attachFileRef = useRef<HTMLInputElement>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<Bookmark["status"]>("backlog");

  const { data: bookmark, isLoading, error } = useQuery({
    queryKey: ["bookmark", id],
    queryFn: () => bookmarkService.getBookmark(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;
    void bookmarkService.recordView(id);
  }, [id]);

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["attachments", id],
    queryFn: () => attachmentService.getAttachments(id!),
    enabled: !!id,
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => attachmentService.deleteAttachment(attachmentId),
    onSuccess: () => {
      setDeletingAttachmentId(null);
      refetchAttachments();
      toast({ title: "File deleted" });
    },
    onError: () => {
      setDeletingAttachmentId(null);
      toast({ title: "Failed to delete attachment", description: "Could not delete the attachment. Please try again.", variant: "destructive" });
    },
  });

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    try {
      await attachmentService.createAttachment(file, id);
      refetchAttachments();
      toast({ title: "File uploaded", description: file.name });
      if (attachFileRef.current) attachFileRef.current.value = "";
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the file. Please try again.", variant: "destructive" });
    }
  };

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Bookmark>) => bookmarkService.updateBookmark(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      setIsEditing(false);
      toast({ title: "Changes saved" });
    },
    onError: () => {
      toast({ title: "Couldn't save changes", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => bookmarkService.deleteBookmark(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Removed from your list" });
      navigate("/dashboard");
    },
    onError: () => {
      toast({ title: "Couldn't remove this title", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const makePublicMutation = useMutation({
    mutationFn: () => sharingService.makeBookmarkPublic(id!),
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", id] });
      const shareUrl = `${window.location.origin}/share/${token}`;
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      toast({ title: "Share link copied!", description: shareUrl });
    },
    onError: () => {
      toast({ title: "Couldn't create share link", description: "Please try again.", variant: "destructive" });
    },
  });

  const makePrivateMutation = useMutation({
    mutationFn: () => sharingService.makeBookmarkPrivate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", id] });
      toast({ title: "Sharing turned off" });
    },
    onError: () => {
      toast({ title: "Couldn't turn off sharing", description: "Please try again.", variant: "destructive" });
    },
  });

  const vaultMutation = useMutation({
    mutationFn: (vaulted: boolean) => bookmarkService.updateBookmark(id!, { is_vaulted: vaulted }),
    onSuccess: (_, vaulted) => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({
        title: vaulted ? "Moved to Vault" : "Removed from Vault",
        description: vaulted ? "Hidden from dashboard by default." : "This title is visible on your dashboard again.",
      });
    },
    onError: () => {
      toast({ title: "Couldn't update vault", description: "Please try again.", variant: "destructive" });
    },
  });

  const rateMutation = useMutation({
    mutationFn: ({ rating, review }: { rating: number | null; review?: string | null }) =>
      bookmarkService.rateBookmark(id!, rating, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onError: () => {
      toast({ title: "Couldn't save your rating", description: "Please try again.", variant: "destructive" });
    },
  });

  const selectResolutionMutation = useMutation({
    mutationFn: (candidate: EnrichmentMatchCandidate) =>
      bookmarkService.selectResolutionCandidate(id!, candidate),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      setResolutionPickerOpen(false);
      toast({ title: "Match saved", description: updated.title });
    },
    onError: () => {
      toast({ title: "Couldn't save match", description: "Please try again.", variant: "destructive" });
    },
  });

  const addSimilarMutation = useMutation({
    mutationFn: (item: { id: number; title: string; posterUrl: string | null; release_year: number | null; media_type: "movie" | "tv" }) =>
      bookmarkService.createBookmark({
        title: item.title,
        type: item.media_type === "tv" ? "series" : "movie",
        provider: "generic",
        platform_label: "TMDB",
        poster_url: item.posterUrl,
        release_year: item.release_year,
        metadata: { tmdb_id: item.id },
      }),
    onSuccess: (newBm) => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Added to your list", description: newBm.title });
    },
    onError: () => {
      toast({ title: "Couldn't add to list", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleStartEdit = () => {
    if (bookmark) {
      setEditTitle(bookmark.title);
      setEditNotes(bookmark.notes || "");
      setEditStatus(bookmark.status);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({ title: editTitle, notes: editNotes || null, status: editStatus });
  };

  const handleStatusChange = (status: Bookmark["status"]) => {
    updateMutation.mutate({ status });
  };

  const rawTmdbId = bookmark?.metadata?.tmdb_id ?? bookmark?.metadata?.tmdbId;
  const tmdbId = (typeof rawTmdbId === "string" || typeof rawTmdbId === "number") ? rawTmdbId : undefined;
  const storedOverview = bookmark?.metadata?.overview as string | undefined;
  const { data: resolvedTmdbId } = useTmdbSearch(
    !tmdbId ? bookmark?.title : null,
    bookmark?.type || "movie",
    storedOverview,
  );
  const effectiveTmdbId = tmdbId ?? resolvedTmdbId ?? undefined;

  const preferredRegion = getPreferredRegionFromBrowser() ?? DEFAULT_WATCH_REGION;
  const cachedAvailability = getAvailabilityFromBookmark(bookmark);
  const hasFreshCache = isAvailabilityFresh(cachedAvailability, preferredRegion);
  const shouldRefreshProviders = Boolean(effectiveTmdbId) && !hasFreshCache;
  const { data: watchProviders } = useWatchProviders(
    shouldRefreshProviders ? effectiveTmdbId : undefined,
    bookmark?.type || "movie",
    preferredRegion,
  );
  const [watchSessionAvailability, setWatchSessionAvailability] = useState<BookmarkAvailability | null>(null);
  useEffect(() => { setWatchSessionAvailability(null); }, [bookmark?.id]);

  const currentAvailability = watchSessionAvailability
    ?? (watchProviders && bookmark
      ? buildAvailabilityFromWatchProviders(
          { title: bookmark.title, type: bookmark.type, provider: bookmark.provider, metadata: bookmark.metadata },
          watchProviders,
          preferredRegion,
          typeof effectiveTmdbId === "number" ? effectiveTmdbId : null,
        )
      : null)
    ?? cachedAvailability;

  const { data: similarTitles = [] } = useSimilarTitles(effectiveTmdbId, bookmark?.type || "movie");
  const { data: tmdbDetails } = useTmdbDetails(effectiveTmdbId, bookmark?.type || "movie");

  const { data: allBookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
    staleTime: 60 * 1000,
  });
  const ownedTmdbIds = new Set(
    allBookmarks
      .map((b) => {
        const bid = b.metadata?.tmdb_id ?? b.metadata?.tmdbId;
        return typeof bid === "string" ? parseInt(bid, 10) : bid;
      })
      .filter((bid) => typeof bid === "number" && !isNaN(bid))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !bookmark) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto">
            <ArrowLeft className="w-8 h-8 text-white/40" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-white">Title not found</p>
            <p className="text-sm text-white/50">This bookmark may have been removed or doesn't exist.</p>
          </div>
          <Button onClick={() => navigate("/dashboard")} className="bg-white text-black hover:bg-white/90">
            Back to My List
          </Button>
        </div>
      </div>
    );
  }

  const imageUrl = bookmark.backdrop_url
    || (bookmark.metadata?.backdrop_url as string | undefined)
    || bookmark.poster_url;
  const voteAverage = bookmark.metadata?.vote_average as number | undefined;
  const overview = bookmark.metadata?.overview as string | undefined;
  const trailerUrl = bookmark.metadata?.trailer_url as string | undefined;
  const totalSeasons = typeof bookmark.metadata?.total_seasons === "number" ? bookmark.metadata.total_seasons : null;
  const totalEpisodes = typeof bookmark.metadata?.total_episodes === "number" ? bookmark.metadata.total_episodes : null;
  const resolutionCandidates = parseMatchCandidates(bookmark.metadata?.match_candidates);
  const needsResolution =
    bookmark.metadata?.resolution_status === "needs_selection" ||
    (bookmark.metadata?.resolution_requires_selection === true && !bookmark.canonical_entity);

  const availableNowProviders = currentAvailability?.providers.filter((p) => p.type === "subscription") ?? [];
  const rentOrBuyProviders = currentAvailability?.providers.filter((p) => p.type !== "subscription") ?? [];
  const fallbackSearch = buildFallbackSearchUrls(bookmark.title);
  const noTmdbMatch = currentAvailability?.status === "no_tmdb_match" || (!effectiveTmdbId && resolvedTmdbId === null);

  const openSafeLink = (url: string) => {
    if (!isSafeUrl(url)) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const mobileDeepLink = buildBookmarkDeepLink(bookmark.id);

  const openInApp = () => {
    window.location.href = mobileDeepLink;
    toast({ title: "Opening mobile app", description: "If the app is installed, this bookmark will open there." });
  };

  const copyAppLink = async () => {
    try {
      await navigator.clipboard.writeText(mobileDeepLink);
      toast({ title: "Mobile link copied", description: mobileDeepLink });
    } catch {
      toast({
        title: "Couldn't copy mobile link",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const persistAvailability = async (availability: BookmarkAvailability, resolvedId?: number | null) => {
    const nextMetadata = {
      ...(bookmark.metadata || {}),
      availability,
      ...(resolvedId && !bookmark.metadata?.tmdb_id && !bookmark.metadata?.tmdbId ? { tmdb_id: resolvedId } : {}),
    };
    try {
      await bookmarkService.updateBookmark(bookmark.id, { metadata: nextMetadata, availability });
      queryClient.invalidateQueries({ queryKey: ["bookmark", id] });
    } catch (error) {
      console.error("Failed to persist availability metadata", { bookmarkId: bookmark.id, availability, error });
      // non-blocking cache write - don't block user flow
    }
  };

  const openWatchFlow = async () => {
    setIsOpeningWatch(true);
    try {
      let availability = currentAvailability;
      if (!availability || !isAvailabilityFresh(availability, preferredRegion)) {
        const resolved = await resolveAndFetchAvailability(
          { title: bookmark.title, type: bookmark.type, provider: bookmark.provider, metadata: bookmark.metadata },
          preferredRegion,
        );
        availability = resolved.availability;
        setWatchSessionAvailability(availability);
        await persistAvailability(availability, resolved.tmdbId);
      }
      if (availability && availability.providers.length === 1) {
        openSafeLink(availability.providers[0].url);
        return;
      }
      setWatchDialogOpen(true);
    } catch {
      toast({ title: "Could not load watch options", description: "Use Search elsewhere while we retry provider data.", variant: "destructive" });
      setWatchDialogOpen(true);
    } finally {
      setIsOpeningWatch(false);
    }
  };

  return (
    <div className="bg-[#0f0f0f] min-h-screen text-white">

      {/* ── HERO ── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "16/7", maxHeight: "40vh", minHeight: "200px" }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={bookmark.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
            <span className="text-6xl font-bold text-white/15">{bookmark.title.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f]/55 via-transparent to-transparent" />

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-5">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight drop-shadow-lg max-w-3xl">
            {bookmark.title}
          </h1>
          {(bookmark.release_year || bookmark.type) && (
            <p className="text-sm text-white/55 mt-1.5 flex items-center gap-2">
              {bookmark.release_year && <span>{bookmark.release_year}</span>}
              {bookmark.type && <span className="capitalize">{bookmark.type}</span>}
              {bookmark.runtime_minutes && bookmark.type !== "series" && (
                <span>{formatRuntime(bookmark.runtime_minutes)}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ── ACTION ROW ── */}
      <div className="px-4 md:px-8 py-4 flex items-center gap-2.5 border-b border-white/[0.06]">
        {/* Primary CTA — Von Restorff: only white-filled element in the row */}
        <button
          type="button"
          onClick={openWatchFlow}
          disabled={isOpeningWatch}
          className="flex items-center gap-2 bg-white text-black font-bold h-10 px-5 rounded-sm hover:bg-white/90 active:bg-white/80 transition-colors disabled:opacity-60 mr-1 shrink-0"
        >
          {isOpeningWatch
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Play className="w-4 h-4 fill-black" />
          }
          <span className="text-sm whitespace-nowrap">{isOpeningWatch ? "Loading…" : "Watch Now"}</span>
        </button>

        {/* Mark as watched — filled ring when active for immediate feedback */}
        {needsResolution && resolutionCandidates.length > 0 && (
          <button
            type="button"
            onClick={() => setResolutionPickerOpen(true)}
            className="h-10 px-3 rounded-sm border border-amber-400/60 text-amber-200 text-sm font-semibold hover:bg-amber-400/10 transition-colors shrink-0"
          >
            Match needed
          </button>
        )}

        <button
          type="button"
          onClick={() => handleStatusChange(bookmark.status === "done" ? "backlog" : "done")}
          title={bookmark.status === "done" ? "Mark as unwatched" : "Mark as watched"}
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
            bookmark.status === "done"
              ? "border-[#46d369] text-[#46d369]"
              : "border-white/40 text-white/70 hover:border-white hover:text-white"
          }`}
        >
          <Check className="w-4 h-4" />
        </button>

        {/* Love it — maps to 5-star rating */}
        <button
          type="button"
          onClick={() => rateMutation.mutate({ rating: bookmark.user_rating === 5 ? null : 5 })}
          title={bookmark.user_rating === 5 ? "Remove rating" : "Love it"}
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
            bookmark.user_rating === 5
              ? "border-primary text-primary"
              : "border-white/40 text-white/70 hover:border-white hover:text-white"
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
        </button>

        {/* Not for me — maps to dropped status */}
        <button
          type="button"
          onClick={() => handleStatusChange(bookmark.status === "dropped" ? "backlog" : "dropped")}
          title={bookmark.status === "dropped" ? "Undo" : "Not for me"}
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
            bookmark.status === "dropped"
              ? "border-red-400 text-red-400"
              : "border-white/40 text-white/70 hover:border-white hover:text-white"
          }`}
        >
          <ThumbsDown className="w-4 h-4" />
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={() => {
            if (bookmark.is_public && bookmark.share_token) {
              navigator.clipboard.writeText(`${window.location.origin}/share/${bookmark.share_token}`).catch(() => {});
              toast({ title: "Link copied!" });
            } else {
              makePublicMutation.mutate();
            }
          }}
          title={bookmark.is_public ? "Copy share link" : "Share publicly"}
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
            bookmark.is_public
              ? "border-blue-400 text-blue-400"
              : "border-white/40 text-white/70 hover:border-white hover:text-white"
          }`}
        >
          {makePublicMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Share2 className="w-4 h-4" />
          }
        </button>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-10 h-10 rounded-full border-2 border-white/40 text-white/70 flex items-center justify-center hover:border-white hover:text-white transition-colors shrink-0"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 bg-[#1c1c1c] border-white/10">
            <DropdownMenuItem onClick={handleStartEdit} className="text-white/85 focus:text-white focus:bg-white/10">
              <Edit2 className="w-4 h-4 mr-2" />Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => vaultMutation.mutate(!bookmark.is_vaulted)}
              className="text-white/85 focus:text-white focus:bg-white/10"
            >
              {bookmark.is_vaulted ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              {bookmark.is_vaulted ? "Remove from Vault" : "Move to Vault"}
            </DropdownMenuItem>
            {trailerUrl && isSafeUrl(trailerUrl) && (
              <DropdownMenuItem onClick={() => openSafeLink(trailerUrl)} className="text-white/85 focus:text-white focus:bg-white/10">
                <Play className="w-4 h-4 mr-2" />Watch Trailer
              </DropdownMenuItem>
            )}
            {bookmark.source_url && isSafeUrl(bookmark.source_url) && (
              <DropdownMenuItem onClick={() => openSafeLink(bookmark.source_url!)} className="text-white/85 focus:text-white focus:bg-white/10">
                <ExternalLink className="w-4 h-4 mr-2" />Open Source
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={openInApp} className="text-white/85 focus:text-white focus:bg-white/10">
              <ExternalLink className="w-4 h-4 mr-2" />Open in mobile app
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { void copyAppLink(); }} className="text-white/85 focus:text-white focus:bg-white/10">
              <Copy className="w-4 h-4 mr-2" />Copy mobile link
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-400 focus:text-red-400 focus:bg-white/10">
              <Trash2 className="w-4 h-4 mr-2" />Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex items-center border-b border-white/[0.08] px-4 md:px-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-4 text-sm font-medium transition-colors relative ${
              activeTab === tab.id ? "text-white" : "text-white/45 hover:text-white/75"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full" />
            )}
          </button>
        ))}
        {bookmark.status === "done" && bookmark.watched_at && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-[#46d369] py-3 pr-1">
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Watched {format(new Date(bookmark.watched_at), "MMM d, yyyy")}</span>
          </div>
        )}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="px-4 md:px-8 py-6">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && !isEditing && (
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">

            {/* Left column — editorial content */}
            <div className="flex-1 min-w-0 space-y-3">

              {/* Content info card — mirrors Prime Video's bordered info box */}
              <div className="border border-white/[0.10] rounded-sm bg-[#141414] p-4 md:p-5">
                <h2 className="text-[15px] font-bold text-white mb-2">{bookmark.title}</h2>

                {/* Genre chip + mood descriptors */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-sm">
                  {tmdbDetails?.genres && tmdbDetails.genres.length > 0 && (
                    <span className="text-[#54b3d6] underline cursor-default">
                      {tmdbDetails.genres[0].name}
                    </span>
                  )}
                  {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                    <>
                      {tmdbDetails?.genres && tmdbDetails.genres.length > 0 && (
                        <span className="text-white/25">•</span>
                      )}
                      <span className="text-white/65">
                        {bookmark.mood_tags.slice(0, 2).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" • ")}
                      </span>
                    </>
                  )}
                </div>

                {/* Rating / year / seasons strip */}
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-4">
                  {voteAverage != null && voteAverage > 0 && (
                    <span className="text-sm text-white/65">
                      <span className="text-white font-semibold">IMDb {voteAverage.toFixed(1)}</span>/10
                    </span>
                  )}
                  {bookmark.release_year && (
                    <span className="text-sm text-white/55">{bookmark.release_year}</span>
                  )}
                  {bookmark.type === "series" && totalSeasons && (
                    <span className="text-sm text-white/55">{totalSeasons} season{totalSeasons !== 1 ? "s" : ""}</span>
                  )}
                  {bookmark.type === "series" && totalEpisodes && (
                    <span className="text-sm text-white/55">{totalEpisodes} ep</span>
                  )}
                  {bookmark.runtime_minutes && bookmark.type !== "series" && (
                    <span className="text-sm text-white/55">{formatRuntime(bookmark.runtime_minutes)}</span>
                  )}
                  {tmdbDetails?.genres && tmdbDetails.genres.slice(1, 3).map((g) => (
                    <span key={g.id} className="text-xs bg-white/[0.07] text-white/60 rounded-full px-2.5 py-0.5">
                      {g.name}
                    </span>
                  ))}
                </div>

                {/* Synopsis */}
                {overview && (
                  <div>
                    <p className={`text-sm text-white/60 leading-relaxed ${synopsisExpanded ? "" : "line-clamp-4"}`}>
                      {overview}
                    </p>
                    {overview.length > 250 && (
                      <button
                        type="button"
                        onClick={() => setSynopsisExpanded((p) => !p)}
                        className="mt-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        {synopsisExpanded ? "Show less" : "More"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Creators and Cast card */}
              {(tmdbDetails?.director || (tmdbDetails?.cast && tmdbDetails.cast.length > 0)) && (
                <div className="border border-white/[0.10] rounded-sm bg-[#141414] p-4 md:p-5">
                  <h3 className="font-bold text-white mb-4">Creators and Cast</h3>
                  <div className="space-y-3">
                    {tmdbDetails?.director && (
                      <div className="flex gap-4">
                        <span className="text-sm text-white/45 w-24 shrink-0">Director</span>
                        <span className="text-sm text-white/85">{tmdbDetails.director}</span>
                      </div>
                    )}
                    {tmdbDetails?.cast && tmdbDetails.cast.length > 0 && (
                      <div className="flex gap-4">
                        <span className="text-sm text-white/45 w-24 shrink-0 pt-0.5">Cast</span>
                        <p className="text-sm text-white/85 leading-relaxed">
                          {tmdbDetails.cast.slice(0, 5).map((a, i) => (
                            <span key={a.name}>
                              {a.name}
                              {i < Math.min(tmdbDetails.cast.length - 1, 4) && (
                                <span className="text-white/35">, </span>
                              )}
                            </span>
                          ))}
                          {tmdbDetails.cast.length > 5 && (
                            <>
                              <span className="text-white/35">, </span>
                              <button
                                type="button"
                                onClick={() => setActiveTab("details")}
                                className="text-white/40 hover:text-white/65 transition-colors underline"
                              >
                                more
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — utility cards */}
            <div className="w-full md:w-[290px] lg:w-[310px] shrink-0 space-y-3">

              {/* Where to Watch */}
              <div className="border border-white/[0.10] rounded-sm bg-[#141414] p-4">
                <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Where to Watch{currentAvailability?.region ? ` (${currentAvailability.region})` : ""}
                </h4>
                {availableNowProviders.length > 0 ? (
                  <div className="space-y-2">
                    {availableNowProviders.slice(0, 4).map((provider) => (
                      <div
                        key={`${provider.providerId}-${provider.type}`}
                        className="flex items-center justify-between bg-white/[0.04] rounded-sm px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {provider.logoUrl && (
                            <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm shrink-0" />
                          )}
                          <span className="text-sm text-white/85 truncate">{provider.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openSafeLink(provider.url)}
                          className="text-xs text-white/40 hover:text-white ml-2 shrink-0 flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Watch
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/35">Not available on subscription right now.</p>
                )}
                {rentOrBuyProviders.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-white/30 uppercase tracking-wider font-semibold">Rent or Buy</p>
                    {rentOrBuyProviders.slice(0, 3).map((provider) => (
                      <div
                        key={`${provider.providerId}-${provider.type}`}
                        className="flex items-center justify-between bg-white/[0.04] rounded-sm px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {provider.logoUrl && (
                            <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm shrink-0" />
                          )}
                          <span className="text-sm text-white/85 truncate">{provider.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openSafeLink(provider.url)}
                          className="text-xs text-white/40 hover:text-white ml-2 shrink-0 transition-colors"
                        >
                          {provider.type === "rent" ? "Rent" : "Buy"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-3">
                  <button type="button" onClick={() => openSafeLink(fallbackSearch.google)} className="text-xs text-white/35 hover:text-white/65 transition-colors">Google</button>
                  <span className="text-white/15 text-xs">·</span>
                  <button type="button" onClick={() => openSafeLink(fallbackSearch.youtube)} className="text-xs text-white/35 hover:text-white/65 transition-colors">YouTube</button>
                  <span className="text-white/15 text-xs">·</span>
                  <button type="button" onClick={() => openSafeLink(fallbackSearch.web)} className="text-xs text-white/35 hover:text-white/65 transition-colors">Web</button>
                </div>
              </div>

              {/* Content Advisory — mood tags + notes as editorial signal */}
              {(bookmark.mood_tags?.length > 0 || bookmark.tags?.length > 0 || bookmark.notes) && (
                <div className="border border-white/[0.10] rounded-sm bg-[#141414] p-4 space-y-3">
                  {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Mood</h4>
                      <p className="text-sm text-white/65">
                        {bookmark.mood_tags.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ")}
                      </p>
                    </div>
                  )}
                  {bookmark.tags && bookmark.tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Tags</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {bookmark.tags.map((tag) => (
                          <span key={tag} className="text-xs bg-white/[0.07] text-white/60 rounded-full px-2.5 py-0.5">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {bookmark.notes && (
                    <div>
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">My Notes</h4>
                      <p className="text-sm text-white/60 leading-relaxed line-clamp-3">{bookmark.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sharing */}
              <div className="border border-white/[0.10] rounded-sm bg-[#141414] p-4">
                <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Sharing</h4>
                {bookmark.is_public && bookmark.share_token ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-blue-400">
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span>Anyone with the link can view</span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/share/${bookmark.share_token}`).catch(() => {});
                          toast({ title: "Link copied!" });
                        }}
                        className="text-xs text-white/45 hover:text-white transition-colors flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() => makePrivateMutation.mutate()}
                        disabled={makePrivateMutation.isPending}
                        className="text-xs text-white/30 hover:text-white/50 transition-colors flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" />Make private
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => makePublicMutation.mutate()}
                    disabled={makePublicMutation.isPending}
                    className="text-sm text-white/45 hover:text-white transition-colors flex items-center gap-2"
                  >
                    {makePublicMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    Share & copy link
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── OVERVIEW / EDIT FORM ── */}
        {activeTab === "overview" && isEditing && (
          <div className="max-w-lg space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold">Edit</h2>
              <button type="button" onClick={() => setIsEditing(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title" className="text-white/60">Title</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status" className="text-white/60">Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as Bookmark["status"])}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1c1c1c] border-white/10">
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-white focus:text-white focus:bg-white/10">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-white/60">My Notes</Label>
              <Textarea id="edit-notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} className="bg-white/5 border-white/10 text-white resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} className="bg-white text-black hover:bg-white/90">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
              <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-white/60 hover:text-white">
                <X className="w-4 h-4 mr-1" />Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── DETAILS TAB ── */}
        {activeTab === "details" && (
          <div className="max-w-2xl space-y-8">

            {/* My Rating */}
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">My Rating</p>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => rateMutation.mutate({ rating: bookmark.user_rating === star ? null : star })}
                    className="p-0.5 hover:scale-110 transition-transform"
                    aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        (bookmark.user_rating || 0) >= star
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-white/20 hover:text-yellow-400/50"
                      }`}
                    />
                  </button>
                ))}
                {bookmark.user_rating && (
                  <span className="text-sm text-white/40 ml-2">{bookmark.user_rating}/5</span>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Status</p>
              <Select value={bookmark.status} onValueChange={handleStatusChange}>
                <SelectTrigger className={`w-[200px] bg-white/5 border-white/10 text-white border-l-4 pl-3 ${STATUS_CONFIG[bookmark.status].borderClass}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_CONFIG[bookmark.status].dotClass}`} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-[#1c1c1c] border-white/10">
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-white focus:text-white focus:bg-white/10">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[opt.value].dotClass}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Full synopsis */}
            {overview && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Synopsis</p>
                <p className="text-sm text-white/60 leading-relaxed">{overview}</p>
              </div>
            )}

            {/* Full cast — portrait scroll */}
            {tmdbDetails?.cast && tmdbDetails.cast.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Cast</p>
                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                  {tmdbDetails.cast.slice(0, 10).map((actor) => (
                    <div key={actor.name} className="shrink-0 w-[88px]">
                      <div className="aspect-[2/3] rounded-md overflow-hidden bg-[#1a1a1a] mb-2 ring-1 ring-white/10">
                        {actor.profileUrl ? (
                          <img src={actor.profileUrl} alt={actor.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white/25">
                            {actor.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-white/85 leading-tight truncate">{actor.name}</p>
                      <p className="text-[10px] text-white/35 leading-tight truncate">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mood + Tags */}
            {(bookmark.mood_tags?.length > 0 || bookmark.tags?.length > 0) && (
              <div className="space-y-4">
                {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Mood</p>
                    <div className="flex flex-wrap gap-2">
                      {bookmark.mood_tags.map((mood) => (
                        <Badge key={mood} variant="outline" className="border-white/20 text-white/65">
                          {getMoodEmoji(mood)} {mood}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {bookmark.tags && bookmark.tags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {bookmark.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="bg-white/10 text-white/65 border-0">
                          <Tag className="w-3 h-3 mr-1" />{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {bookmark.notes && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">My Notes</p>
                <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">{bookmark.notes}</p>
              </div>
            )}

            {/* User review */}
            {bookmark.user_review && (
              <blockquote className="border-l-2 border-white/20 pl-4">
                <p className="text-sm text-white/55 italic leading-relaxed">{bookmark.user_review}</p>
              </blockquote>
            )}

            {/* Source */}
            {bookmark.source_url && (
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Source</p>
                {isSafeUrl(bookmark.source_url) ? (
                  <a href={bookmark.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{bookmark.source_url}</span>
                  </a>
                ) : (
                  <span className="text-sm text-white/25 flex items-center gap-1.5 cursor-not-allowed" aria-disabled="true">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />{bookmark.source_url}
                  </span>
                )}
              </div>
            )}

            {/* Files */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Files{attachments.length > 0 ? ` (${attachments.length})` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => attachFileRef.current?.click()}
                  className="text-xs text-white/35 hover:text-white transition-colors flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />Add
                </button>
                <input ref={attachFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleAttachFile} />
              </div>
              {attachments.length === 0 ? (
                <button
                  type="button"
                  onClick={() => attachFileRef.current?.click()}
                  className="w-full border border-dashed border-white/10 rounded-md p-4 text-center text-sm text-white/25 hover:border-white/20 transition-colors"
                >
                  No files yet — click to upload
                </button>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-md border border-white/[0.06]">
                      {att.file_type?.startsWith("image/") ? (
                        <img src={att.file_url} alt={att.file_name} className="w-10 h-10 object-cover rounded shrink-0" />
                      ) : (
                        <FileText className="w-8 h-8 text-white/25 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/85 truncate">{att.file_name}</p>
                        {att.size && <p className="text-xs text-white/35">{(att.size / 1024).toFixed(1)} KB</p>}
                      </div>
                      {isSafeUrl(att.file_url) ? (
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Download">
                          <Download className="w-4 h-4 text-white/40" />
                        </a>
                      ) : (
                        <span className="p-1.5 text-white/15 cursor-not-allowed" aria-disabled="true">
                          <Download className="w-4 h-4" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => { setDeletingAttachmentId(att.id); deleteAttachmentMutation.mutate(att.id); }}
                        disabled={deletingAttachmentId === att.id}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors text-white/35 hover:text-red-400"
                      >
                        {deletingAttachmentId === att.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SIMILAR TAB ── */}
        {activeTab === "similar" && (
          <div>
            {similarTitles.length === 0 ? (
              <div className="text-center py-16 text-white/25">
                <p className="text-sm">No similar titles found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {similarTitles.map((item) => {
                  const alreadyOwned = ownedTmdbIds.has(item.id);
                  return (
                    <div key={item.id} className="group">
                      <div className="relative aspect-[2/3] rounded-sm overflow-hidden bg-[#1a1a1a] mb-2">
                        {item.posterUrl ? (
                          <img
                            src={item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xl font-bold text-white/25">{item.title.charAt(0)}</span>
                          </div>
                        )}
                        {!alreadyOwned ? (
                          <button
                            type="button"
                            onClick={() => addSimilarMutation.mutate(item)}
                            disabled={addSimilarMutation.isPending}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            aria-label={`Add ${item.title} to your list`}
                          >
                            <Plus className="w-7 h-7 text-white" />
                          </button>
                        ) : (
                          <div className="absolute top-1.5 right-1.5 bg-[#46d369] rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5 text-black" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-white/75 truncate font-medium">{item.title}</p>
                      {item.release_year && <p className="text-[10px] text-white/35">{item.release_year}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── WATCH DIALOG ── */}
      <TmdbCandidatePicker
        open={resolutionPickerOpen}
        onOpenChange={setResolutionPickerOpen}
        candidates={resolutionCandidates}
        extractedTitle={
          typeof bookmark.metadata?.raw_title === "string" ? bookmark.metadata.raw_title : bookmark.title
        }
        onSelect={(candidate) => selectResolutionMutation.mutate(candidate)}
        onSkip={() => {
          bookmarkService.skipResolutionSelection(bookmark.id).catch(() => undefined);
          setResolutionPickerOpen(false);
        }}
      />

      <Dialog open={watchDialogOpen} onOpenChange={setWatchDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[#1c1c1c] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{bookmark.title}</DialogTitle>
            <DialogDescription className="text-white/45">
              Where you can watch{currentAvailability?.region ? ` (${currentAvailability.region})` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {noTmdbMatch ? (
              <div className="rounded-md bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white/55">
                We couldn't match this title automatically. Try searching below.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/35 uppercase tracking-wider">Available now</p>
                {availableNowProviders.length > 0 ? (
                  availableNowProviders.map((provider) => (
                    <div key={`${provider.providerId}-${provider.type}`} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {provider.logoUrl && <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm" />}
                        <span className="text-sm text-white/85 truncate">{provider.name}</span>
                      </div>
                      <Button size="sm" onClick={() => openSafeLink(provider.url)} className="bg-white text-black hover:bg-white/90 shrink-0">Watch</Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/45">Not available on streaming right now.</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/35 uppercase tracking-wider">Search elsewhere</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.google)} className="border-white/15 text-white/60 hover:text-white hover:bg-white/10">Google</Button>
                <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.youtube)} className="border-white/15 text-white/60 hover:text-white hover:bg-white/10">YouTube</Button>
                <Button variant="outline" size="sm" onClick={() => openSafeLink(fallbackSearch.web)} className="border-white/15 text-white/60 hover:text-white hover:bg-white/10">Web</Button>
              </div>
            </div>
            {rentOrBuyProviders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/35 uppercase tracking-wider">Rent or buy</p>
                {rentOrBuyProviders.map((provider) => (
                  <div key={`${provider.providerId}-${provider.type}`} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {provider.logoUrl && <img src={provider.logoUrl} alt={provider.name} className="w-5 h-5 rounded-sm" />}
                      <span className="text-sm text-white/85 truncate">{provider.name}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openSafeLink(provider.url)} className="border-white/15 text-white/60 hover:text-white hover:bg-white/10 shrink-0">
                      {provider.type === "rent" ? "Rent" : "Buy"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DELETE DIALOG ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#1c1c1c] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove from your list?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              "{bookmark.title}" will be permanently removed. You can always add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 text-white/65 hover:text-white bg-transparent hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 text-white hover:bg-red-700 border-0"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BookmarkDetail;
