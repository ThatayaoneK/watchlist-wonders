import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBookmarkEnrichment } from "@/hooks/useBookmarkEnrichment";
import { useAuth } from "@/contexts/AuthContext";
import {
  Play, Plus, Check, CalendarPlus, MoreHorizontal, ExternalLink,
  Trash2, Undo2, Eye, BookMarked, Minus, Info, Film, Star, SkipForward,
  Lock, Unlock, Globe, Share2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn, extractYouTubeVideoId, openSafe } from "@/lib/utils";
import { motionDuration, motionEasing, hoverOpenDelayMs, hoverCloseDelayMs } from "@/lib/motion";
import { getNextStatus } from "@/engine/lifecycle";
import { fetchTrailerEmbedUrlViaProxy } from "@/services/tmdbProxy";
import { QuickScheduleSheet } from "@/components/schedules/QuickScheduleSheet";
import { WatchModal } from "@/components/bookmarks/WatchModal";
import { getProviderMeta } from "@/constants/providers";
import type { Bookmark, Schedule } from "@/types/database";

interface PosterCardProps {
  bookmark: Bookmark;
  rank?: number;
  cardSize?: "default" | "featured";
  recommendationReason?: string;
  isHighlighted?: boolean;
  onPlay?: () => void;
  onSchedule?: () => void;
  onSkip?: () => void;
  onMarkDone?: () => void;
  onAddToPlan?: () => void;
  onDelete?: () => void;
  onUndoDone?: () => void;
  onSetWatching?: () => void;
  onStatusCycle?: (bookmark: Bookmark, newStatus: Bookmark["status"]) => void;
  onEpisodeUpdate?: (bookmark: Bookmark, count: number) => void;
  variant?: "poster" | "backdrop";
  className?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggleUpNext?: (bookmark: Bookmark) => void;
  onSharePublic?: () => void;
  onSharePrivate?: () => void;
  onVault?: () => void;
  onUnvault?: () => void;
  schedule?: Schedule;
}

/** Small provider logo badge — shows favicon logo with color-dot fallback */
function ProviderBadge({ provider, className }: { provider: string; className?: string }) {
  const meta = getProviderMeta(provider);
  const [imgError, setImgError] = useState(false);

  if (meta.logoUrl && !imgError) {
    return (
      <div
        className={cn(
          "w-4 h-4 rounded-sm overflow-hidden bg-white/10 border border-black/20 flex items-center justify-center",
          className,
        )}
        title={meta.label}
      >
        <img
          src={meta.logoUrl}
          alt={meta.label}
          className="w-3.5 h-3.5 object-contain"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={cn("w-4 h-4 rounded-sm border border-black/20 flex items-center justify-center", meta.color, className)}
      title={meta.label}
    >
      <span className="text-[8px] font-bold text-white leading-none">
        {meta.label.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function formatRuntime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatScheduleBadge(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `Today ${format(date, 'h a')}`;
  }
  const tomorrow = new Date(now.getTime() + 86400000);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return format(date, 'EEE MMM d');
}

function isNewBookmark(createdAt: string) {
  const created = new Date(createdAt);
  const now = new Date();
  return now.getTime() - created.getTime() < 24 * 60 * 60 * 1000;
}

class LruCache<K, V> {
  private readonly max: number;
  private readonly map = new Map<K, V>();
  constructor(max: number) { this.max = max; }
  has(key: K) { return this.map.has(key); }
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }
  set(key: K, val: V) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value!);
    this.map.set(key, val);
  }
}

const trailerUrlCache = new LruCache<string, string | null>(100);

function getMetadataNumber(metadata: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function toYouTubeEmbedUrl(videoId: string, autoplay = true): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: "1",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    loop: "1",
    playlist: videoId,
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function toYouTubeWatchUrl(rawUrl: string): string | null {
  const parsedId = extractYouTubeVideoId(rawUrl);
  if (parsedId) {
    return `https://www.youtube.com/watch?v=${parsedId}`;
  }

  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (!hostname.includes("youtube.com")) return null;

    const embedId = segments[0] === "embed" ? segments[1] : null;
    const shortsId = segments[0] === "shorts" ? segments[1] : null;
    const videoId = embedId ?? shortsId;
    if (!videoId) return null;

    const watchUrl = new URL("https://www.youtube.com/watch");
    watchUrl.searchParams.set("v", videoId);
    const list = parsed.searchParams.get("list");
    const start = parsed.searchParams.get("start") ?? parsed.searchParams.get("t");
    if (list) watchUrl.searchParams.set("list", list);
    if (start) watchUrl.searchParams.set("t", start);
    return watchUrl.toString();
  } catch {
    return null;
  }
}

function toTrailerEmbedUrl(rawUrl: string): string | null {
  const youtubeId = extractYouTubeVideoId(rawUrl);
  if (youtubeId) return toYouTubeEmbedUrl(youtubeId);
  return null;
}

function getBookmarkTrailerUrl(bookmark: Bookmark): string | null {
  const metadata = bookmark.metadata || {};
  const fromMetadata = getMetadataString(metadata, [
    "trailer_url", "trailerUrl", "youtube_trailer_url", "youtubeTrailerUrl", "video_url", "videoUrl",
  ]);
  if (fromMetadata) {
    const embedded = toTrailerEmbedUrl(fromMetadata);
    if (embedded) return embedded;
  }
  if (bookmark.source_url) {
    const embedded = toTrailerEmbedUrl(bookmark.source_url);
    if (embedded) return embedded;
  }
  return null;
}

async function fetchTmdbTrailerUrl(bookmark: Bookmark): Promise<string | null> {
  const tmdbId = getMetadataNumber(bookmark.metadata || {}, ["tmdb_id", "tmdbId"]);
  if (!tmdbId) return null;
  const mediaType = bookmark.type === "series" ? "tv" : "movie";
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (trailerUrlCache.has(cacheKey)) return trailerUrlCache.get(cacheKey) ?? null;
  try {
    const trailerUrl = await fetchTrailerEmbedUrlViaProxy(tmdbId, mediaType);
    trailerUrlCache.set(cacheKey, trailerUrl);
    return trailerUrl;
  } catch {
    trailerUrlCache.set(cacheKey, null);
    return null;
  }
}

export function PosterCard({
  bookmark,
  rank,
  cardSize = "default",
  recommendationReason,
  isHighlighted = false,
  onPlay,
  onSchedule,
  onSkip,
  onMarkDone,
  onAddToPlan,
  onDelete,
  onUndoDone,
  onSetWatching,
  onStatusCycle,
  onEpisodeUpdate,
  variant = "poster",
  className,
  isSelectable,
  isSelected,
  onSelect,
  onToggleUpNext,
  onSharePublic,
  onSharePrivate,
  onVault,
  onUnvault,
  schedule,
}: PosterCardProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const enrichmentState = useBookmarkEnrichment(bookmark.id, user?.uid);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [watchModalOpen, setWatchModalOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(() => getBookmarkTrailerUrl(bookmark));
  const [isLoadingTrailer, setIsLoadingTrailer] = useState(false);
  const [episodePopoverOpen, setEpisodePopoverOpen] = useState(false);
  const [localEpisodeCount, setLocalEpisodeCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const trailerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpenRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const imageUrl =
    variant === "poster"
      ? bookmark.poster_url || bookmark.backdrop_url
      : bookmark.backdrop_url || bookmark.poster_url;
  const aspectRatio = variant === "poster" ? "aspect-[2/3]" : "aspect-video";

  const isPreviewActive = !isMobile && !isSelectable && (isHovered || isTouched);
  const showTrailerPreview = isPreviewActive && Boolean(trailerUrl);

  // Episode tracking
  const episodesWatched = typeof bookmark.metadata?.episodes_watched === "number" ? bookmark.metadata.episodes_watched : 0;
  const totalEpisodes = typeof bookmark.metadata?.total_episodes === "number" ? bookmark.metadata.total_episodes : null;
  const showEpisodeBar = bookmark.type === "series" && bookmark.status === "watching";
  const episodeProgress = totalEpisodes ? (episodesWatched / totalEpisodes) * 100 : 0;

  const isNew = isNewBookmark(bookmark.created_at);
  const needsResolution =
    bookmark.metadata?.resolution_status === "needs_selection" ||
    (bookmark.metadata?.resolution_requires_selection === true && !bookmark.canonical_entity);

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPlay) { onPlay(); return; }

    const providers = bookmark.availability?.providers ?? [];
    if (providers.length === 1) {
      const url = providers[0].url;
      try {
        const { protocol } = new URL(url);
        if (protocol === "https:" || protocol === "http:") {
          window.open(url, "_blank", "noopener");
          return;
        }
      } catch { /* fall through */ }
    }
    if (providers.length > 1) {
      setWatchModalOpen(true);
      return;
    }

    if (bookmark.source_url) {
      openSafe(bookmark.source_url);
      return;
    }
    const trailerWatchUrl = trailerUrl ? toYouTubeWatchUrl(trailerUrl) ?? trailerUrl : null;
    if (trailerWatchUrl) {
      openSafe(trailerWatchUrl);
      return;
    }
    setIsHovered(true);
    setIsTouched(true);
  };

  const handleOpenSource = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openSafe(bookmark.source_url);
  };

  const handleScheduleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickScheduleOpen(true);
    onSchedule?.();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectable) { e.preventDefault(); onSelect?.(); return; }
    if (isMobile) {
      if (!isTouched) {
        e.preventDefault();
        setIsTouched(true);
      } else {
        setIsTouched(false);
      }
    }
  };

  const handleStatusPillClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onStatusCycle) return;
    const next = getNextStatus(bookmark.status);
    onStatusCycle(bookmark, next);
  };

  const handleEpisodeUpdate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEpisodeUpdate?.(bookmark, localEpisodeCount);
    setEpisodePopoverOpen(false);
  };

  const clearHoverOpenTimer = () => {
    if (hoverOpenRef.current) {
      clearTimeout(hoverOpenRef.current);
      hoverOpenRef.current = null;
    }
  };

  const clearHoverCloseTimer = () => {
    if (hoverCloseRef.current) {
      clearTimeout(hoverCloseRef.current);
      hoverCloseRef.current = null;
    }
  };

  const scheduleHoverOpen = () => {
    clearHoverCloseTimer();
    clearHoverOpenTimer();
    hoverOpenRef.current = setTimeout(() => {
      setIsHovered(true);
    }, hoverOpenDelayMs);
  };

  const scheduleHoverClose = () => {
    clearHoverOpenTimer();
    clearHoverCloseTimer();
    hoverCloseRef.current = setTimeout(() => {
      setIsHovered(false);
      setIsTouched(false);
    }, hoverCloseDelayMs);
  };

  useEffect(() => {
    setTrailerUrl(getBookmarkTrailerUrl(bookmark));
  }, [bookmark.id, bookmark.source_url, bookmark.metadata]);

  useEffect(() => {
    setLocalEpisodeCount(episodesWatched);
  }, [episodesWatched]);

  useEffect(() => {
    if (!isPreviewActive || trailerUrl) {
      if (trailerDebounceRef.current) clearTimeout(trailerDebounceRef.current);
      return;
    }
    let cancelled = false;
    setIsLoadingTrailer(true);
    trailerDebounceRef.current = setTimeout(() => {
      fetchTmdbTrailerUrl(bookmark).then((url) => {
        if (!cancelled) {
          if (url) setTrailerUrl(url);
          setIsLoadingTrailer(false);
        }
      });
    }, 400);
    return () => {
      cancelled = true;
      if (trailerDebounceRef.current) clearTimeout(trailerDebounceRef.current);
      setIsLoadingTrailer(false);
    };
  }, [isPreviewActive, trailerUrl, bookmark]);

  // Clear isTouched on outside click (mobile)
  useEffect(() => {
    if (!isTouched) return;
    const handleOutside = (e: Event) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsTouched(false);
        setIsHovered(false);
      }
    };
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("click", handleOutside);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("click", handleOutside);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [isTouched]);

  useEffect(() => {
    return () => {
      if (hoverOpenRef.current) {
        clearTimeout(hoverOpenRef.current);
        hoverOpenRef.current = null;
      }
      if (hoverCloseRef.current) {
        clearTimeout(hoverCloseRef.current);
        hoverCloseRef.current = null;
      }
    };
  }, []);

  const showExpanded = (isHovered || isTouched) && !isSelectable;
  const shouldElevate = showExpanded && !isMobile;
  const elevatedTransform =
    variant === "poster" ? "translateY(-2px) scale(1.04)" : "scale(1.04)";

  return (
    <>
      {/* Wrapper Ã¢â‚¬â€ expands on hover (Netflix-style scale + info panel) */}
      <div
        ref={cardRef}
        className={cn(
          "group relative flex-shrink-0 snap-start transition-[transform,box-shadow] ease-out will-change-transform",
          variant === "poster"
            ? cardSize === "featured"
              ? "w-44 sm:w-48 md:w-52 lg:w-56"
              : "w-36 sm:w-40 md:w-44 lg:w-48"
            : cardSize === "featured"
            ? "w-72 sm:w-80 md:w-[22rem]"
            : "w-56 sm:w-64 md:w-72 lg:w-80",
          rank && "ml-6",
          showExpanded && "z-30",
          isHighlighted && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background rounded-md motion-safe:animate-[pulse_2.2s_ease-in-out_infinite] motion-reduce:animate-none",
          isSelected && "ring-2 ring-primary rounded-md",
          className
        )}
        style={{
          transform: shouldElevate ? elevatedTransform : "translateY(0) scale(1)",
          transformOrigin: variant === "poster" ? "bottom center" : "center",
          transitionDuration: `${motionDuration.card}ms`,
          transitionTimingFunction: "var(--wm-ease-fluid, cubic-bezier(0.16, 1, 0.3, 1))",
        }}
        onMouseEnter={() => !isMobile && scheduleHoverOpen()}
        onMouseLeave={() => !isMobile && scheduleHoverClose()}
        onFocusCapture={() => {
          if (isMobile) return;
          clearHoverCloseTimer();
          setIsHovered(true);
        }}
        onBlurCapture={(event) => {
          if (cardRef.current && !cardRef.current.contains(event.relatedTarget as Node)) {
            scheduleHoverClose();
          }
        }}
      >
        {rank && (
          <span
            aria-hidden="true"
            className="absolute -left-7 bottom-[-2px] z-0 text-[5.2rem] font-black leading-none text-[#151515] pointer-events-none select-none"
            style={{ WebkitTextStroke: "2px rgba(255,255,255,0.45)" }}
          >
            {rank}
          </span>
        )}

        <Link
          to={`/b/${bookmark.id}`}
          className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          data-rail-card-link="true"
          onClick={handleCardClick}
        >
          {/* Image container */}
          <div
            className={cn(
              "relative overflow-hidden rounded-sm transition-[transform,box-shadow] ease-out",
              aspectRatio,
              showExpanded && variant === "poster" && "rounded-t-sm rounded-b-none shadow-[0_20px_40px_rgba(0,0,0,0.4)]",
              showExpanded && variant === "backdrop" && "shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
            )}
            style={{ transitionDuration: `${motionDuration.card}ms`, transitionTimingFunction: motionEasing }}
          >
            {imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={bookmark.title}
                className={cn(
                  "w-full h-full object-cover transition-transform duration-300 ease-out",
                  showExpanded && "scale-[1.02]"
                )}
                onError={() => setImageError(true)}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-2">
                <Film className="w-8 h-8 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground/60 text-center px-2 leading-tight truncate max-w-full">
                  {bookmark.title}
                </span>
              </div>
            )}

            {/* Trailer preview loading skeleton */}
            {isPreviewActive && isLoadingTrailer && !trailerUrl && (
              <div className="absolute inset-0 z-[1] bg-black flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {/* Trailer preview */}
            {showTrailerPreview && trailerUrl && (
              <div className="absolute inset-0 z-[1] bg-black">
                <iframe
                  src={trailerUrl}
                  title={`${bookmark.title} trailer`}
                  className="w-full h-full pointer-events-none"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  loading="lazy"
                />
              </div>
            )}

            {/* Provider logo badge */}
            <div className={cn("absolute left-1.5", rank ? "top-7" : "top-1.5")}>
              <ProviderBadge provider={bookmark.provider} />
            </div>

            {/* New badge */}
            {isNew && !isSelectable && (
              <div className="absolute top-1.5 right-1.5">
                <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  New
                </span>
              </div>
            )}

            {/* Enrichment pending indicator */}
            {needsResolution && !isSelectable && !isNew && (
              <div className="absolute top-1.5 right-1.5 z-10">
                <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-500/95 text-black px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  <Sparkles className="w-2.5 h-2.5" />
                  Match needed
                </span>
              </div>
            )}

            {/* Enrichment pending indicator */}
            {enrichmentState.status === "pending" && !needsResolution && !isSelectable && !isNew && (
              <div className="absolute top-1.5 right-1.5 z-10">
                <span className="flex items-center gap-1 text-[9px] font-bold bg-purple-600/90 text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide animate-pulse">
                  <Sparkles className="w-2.5 h-2.5" />
                  Enriching
                </span>
              </div>
            )}

            {/* Schedule badge */}
            {schedule && bookmark.queue_status !== "up_next" && !isNew && !isSelectable && (
              <div className="absolute top-1.5 right-1.5">
                <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  {formatScheduleBadge(schedule.scheduled_for)}
                </span>
              </div>
            )}

            {/* Up Next badge */}
            {bookmark.queue_status === "up_next" && !isSelectable && !isNew && (
              <div className="absolute top-1.5 right-1.5">
                <span className="flex items-center gap-0.5 text-[9px] font-bold bg-wm-gold text-background px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  <Star className="w-2 h-2 fill-current" />
                  Up Next
                </span>
              </div>
            )}

            {bookmark.is_public && !isSelectable && (
              <div className="absolute bottom-2 right-2 z-20">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-semibold text-white/95 backdrop-blur-sm">
                  <Globe className="w-2.5 h-2.5" />
                  Public
                </span>
              </div>
            )}

            {/* Leaving soon badge */}
            {!isSelectable && (() => {
              const providers = bookmark.availability?.providers ?? [];
              const now = Date.now();
              const soonest = providers
                .filter((p) => p.leaving_date)
                .map((p) => ({ name: p.name, ms: new Date(p.leaving_date!).getTime() - now }))
                .filter((p) => p.ms > 0 && p.ms <= 14 * 24 * 60 * 60 * 1000)
                .sort((a, b) => a.ms - b.ms)[0];
              if (!soonest) return null;
              const dayMs = 24 * 60 * 60 * 1000;
              const days = Math.floor(soonest.ms / dayMs);
              let label: string;
              if (days === 0) {
                label = "today";
              } else if (days === 1) {
                label = "tomorrow";
              } else {
                label = `in ${days}d`;
              }
              return (
                <div className="absolute top-1.5 left-6 z-10">
                  <span className="text-[9px] font-bold bg-orange-600 text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                    Leaving {label}
                  </span>
                </div>
              );
            })()}


            {/* Watch progress bar */}
            {(bookmark.progress_percent ?? 0) > 0 && !isSelectable && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(bookmark.progress_percent ?? 0, 100)}%` }}
                />
              </div>
            )}

            {rank && (
              <div className="absolute top-1.5 left-1.5">
                <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                  Top 10
                </span>
              </div>
            )}

            {/* Select checkbox */}
            {isSelectable && (
              <div className="absolute top-2 right-2 z-20">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelect?.()}
                  className="bg-black/60 backdrop-blur-sm data-[state=checked]:bg-primary"
                />
              </div>
            )}

            {/* Status badge Ã¢â‚¬â€ watching */}
            {!isSelectable && !onStatusCycle && bookmark.status === "watching" && !isNew && (
              <div className="absolute top-1.5 right-1.5">
                <span className="flex items-center gap-1 text-[9px] font-bold bg-primary/90 text-white px-1.5 py-0.5 rounded-sm">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Watching
                </span>
              </div>
            )}

            {/* Episode progress bar */}
            {showEpisodeBar && !isSelectable && (
              <Popover open={episodePopoverOpen} onOpenChange={setEpisodePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEpisodePopoverOpen(true); }}
                    className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20 cursor-pointer hover:h-1.5 transition-all"
                    aria-label="Episode progress"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(episodeProgress, 100)}%`, minWidth: episodesWatched > 0 ? "4px" : "0" }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-48 p-3 bg-card border-white/10" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium mb-2 text-white">Episodes watched</p>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLocalEpisodeCount((c) => Math.max(0, c - 1)); }}
                      className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="flex-1 text-center font-semibold text-sm text-white">
                      {localEpisodeCount}{totalEpisodes ? `/${totalEpisodes}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLocalEpisodeCount((c) => c + 1); }}
                      className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <Button size="sm" className="w-full text-xs" onClick={handleEpisodeUpdate}>Update</Button>
                </PopoverContent>
              </Popover>
            )}

            {/* One-tap status pill */}
            {onStatusCycle && !isSelectable && (
              <button
                type="button"
                onClick={handleStatusPillClick}
                className={cn(
                  "absolute bottom-2 left-2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold transition-opacity",
                  bookmark.status === "watching"
                    ? "bg-primary/90 text-white"
                    : bookmark.status === "done"
                    ? "bg-[#46d369]/90 text-black"
                    : "bg-black/70 text-white/80 backdrop-blur-sm"
                )}
                aria-label={`Status: ${bookmark.status}. Click to advance.`}
              >
                {bookmark.status === "watching" && (
                  <><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Watching</>
                )}
                {bookmark.status === "done" && (
                  <><Check className="w-2.5 h-2.5" />Done</>
                )}
                {(bookmark.status === "backlog" || bookmark.status === "scheduled" || bookmark.status === "dropped") && (
                  <><BookMarked className="w-2.5 h-2.5" />
                  {bookmark.status === "backlog" ? "Saved" : bookmark.status === "scheduled" ? "Scheduled" : "Dropped"}</>
                )}
              </button>
            )}

            {/* Mobile dropdown */}
            {isMobile && !isSelectable && (
              <div className="absolute bottom-10 right-1.5 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-11 w-11 rounded-full bg-black/70 backdrop-blur-sm border-white/10"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      aria-label="More options"
                    >
                      <MoreHorizontal className="w-4 h-4 text-white" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card border-white/10">
                    {bookmark.status !== "watching" && (
                      <DropdownMenuItem onClick={onSetWatching} className="text-white/90">
                        <Eye className="w-4 h-4 mr-2" />Set as Watching
                      </DropdownMenuItem>
                    )}
                    {bookmark.status === "done" ? (
                      <DropdownMenuItem onClick={onUndoDone} className="text-white/90">
                        <Undo2 className="w-4 h-4 mr-2" />Add Back to List
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onMarkDone} className="text-white/90">
                        <Check className="w-4 h-4 mr-2" />Mark as Watched
                      </DropdownMenuItem>
                    )}
                    {onToggleUpNext && bookmark.status !== "done" && (
                      <DropdownMenuItem
                        onClick={() => onToggleUpNext(bookmark)}
                        className={bookmark.queue_status === "up_next" ? "text-wm-gold" : "text-white/90"}
                      >
                        <Star className={cn("w-4 h-4 mr-2", bookmark.queue_status === "up_next" && "fill-current")} />
                        {bookmark.queue_status === "up_next" ? "Remove from Up Next" : "Add to Up Next"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={onAddToPlan} className="text-white/90">
                      <Plus className="w-4 h-4 mr-2" />Add to Plan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleScheduleClick} className="text-white/90">
                      <CalendarPlus className="w-4 h-4 mr-2" />Quick Schedule
                    </DropdownMenuItem>
                    {bookmark.status !== "done" && (
                      <DropdownMenuItem onClick={onSkip} className="text-white/90">
                        <SkipForward className="w-4 h-4 mr-2" />Skip for now
                      </DropdownMenuItem>
                    )}
                    {bookmark.is_public ? (
                      <DropdownMenuItem onClick={onSharePrivate} className="text-white/90">
                        <Globe className="w-4 h-4 mr-2" />Make private
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onSharePublic} className="text-white/90">
                        <Share2 className="w-4 h-4 mr-2" />Share publicly
                      </DropdownMenuItem>
                    )}
                    {bookmark.is_vaulted ? (
                      <DropdownMenuItem onClick={onUnvault} className="text-white/90">
                        <Unlock className="w-4 h-4 mr-2" />Remove from Vault
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onVault} className="text-white/90">
                        <Lock className="w-4 h-4 mr-2" />Move to Vault
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={handleOpenSource} className="text-white/90">
                      <ExternalLink className="w-4 h-4 mr-2" />Open Source
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Gradient blending image into expanded panel — poster only */}
            {showExpanded && variant === "poster" && (
              <div
                className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-[2]"
                style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--card)))" }}
              />
            )}

            {/* Backdrop: persistent bottom gradient + title overlay */}
            {variant === "backdrop" && !isSelectable && (
              <div className="absolute bottom-0 left-0 right-0 z-[3] pointer-events-none">
                <div className="h-16 bg-gradient-to-t from-black/75 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
                  <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 drop-shadow-sm max-w-[78%]">
                    {bookmark.title}
                  </p>
                  {recommendationReason && (
                    <p className="text-[9px] text-[#54b3d6]/90 truncate mt-0.5">{recommendationReason}</p>
                  )}
                </div>
              </div>
            )}

            {/* Backdrop: in-card hover action overlay — desktop only */}
            {variant === "backdrop" && !isSelectable && !isMobile && (
              <>
                <div
                  className="absolute inset-0 bg-black/35 z-[4] pointer-events-none transition-opacity duration-200"
                  style={{ opacity: showExpanded ? 1 : 0 }}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 z-[25] transition-opacity duration-200"
                  style={{
                    opacity: showExpanded ? 1 : 0,
                    pointerEvents: showExpanded ? "auto" : "none",
                  }}
                >
                  <div className="px-2.5 pb-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePlay}
                      className="flex items-center justify-center gap-1 bg-white text-black text-[11px] font-bold h-7 px-2.5 rounded-sm hover:bg-white/90 transition-colors flex-shrink-0"
                      aria-label={`Play ${bookmark.title}`}
                    >
                      <Play className="w-3 h-3 fill-black" />
                      <span>Play</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleScheduleClick}
                      className="w-7 h-7 rounded-full border border-white/60 flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors flex-shrink-0"
                      aria-label="Schedule"
                    >
                      <CalendarPlus className="w-3 h-3" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          className="w-7 h-7 rounded-full border border-white/60 flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors flex-shrink-0"
                          aria-label="More options"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-white/10">
                        {bookmark.status !== "watching" && (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetWatching?.(); }} className="text-white/90">
                            <Eye className="w-4 h-4 mr-2" />Set as Watching
                          </DropdownMenuItem>
                        )}
                        {bookmark.status !== "done" && (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSkip?.(); }} className="text-white/90">
                            <SkipForward className="w-4 h-4 mr-2" />Skip for now
                          </DropdownMenuItem>
                        )}
                        {bookmark.status === "done" ? (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUndoDone?.(); }} className="text-white/90">
                            <Undo2 className="w-4 h-4 mr-2" />Add Back to List
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkDone?.(); }} className="text-white/90">
                            <Check className="w-4 h-4 mr-2" />Mark as Watched
                          </DropdownMenuItem>
                        )}
                        {onToggleUpNext && bookmark.status !== "done" && (
                          <DropdownMenuItem
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleUpNext(bookmark); }}
                            className={bookmark.queue_status === "up_next" ? "text-wm-gold" : "text-white/90"}
                          >
                            <Star className={cn("w-4 h-4 mr-2", bookmark.queue_status === "up_next" && "fill-current")} />
                            {bookmark.queue_status === "up_next" ? "Remove from Up Next" : "Add to Up Next"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToPlan?.(); }} className="text-white/90">
                          <Plus className="w-4 h-4 mr-2" />Add to Plan
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        {bookmark.is_public ? (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSharePrivate?.(); }} className="text-white/90">
                            <Globe className="w-4 h-4 mr-2" />Make private
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSharePublic?.(); }} className="text-white/90">
                            <Share2 className="w-4 h-4 mr-2" />Share publicly
                          </DropdownMenuItem>
                        )}
                        {bookmark.is_vaulted ? (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnvault?.(); }} className="text-white/90">
                            <Unlock className="w-4 h-4 mr-2" />Remove from Vault
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onVault?.(); }} className="text-white/90">
                            <Lock className="w-4 h-4 mr-2" />Move to Vault
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={handleOpenSource} className="text-white/90">
                          <ExternalLink className="w-4 h-4 mr-2" />Open Source
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(); }} className="text-destructive focus:text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </>
            )}
          </div>
        </Link>

        {/* Expanded info panel — appears below on hover (poster variant only) */}
        {!isSelectable && variant === "poster" && (
          <div
            aria-hidden={!showExpanded}
            className="absolute left-0 right-0 bg-[#141414] rounded-b-sm shadow-[0_24px_48px_rgba(0,0,0,0.7)] overflow-hidden"
            style={{
              top: "100%",
              zIndex: 30,
              opacity: showExpanded ? 1 : 0,
              transform: showExpanded ? "translateY(0)" : "translateY(-4px)",
              pointerEvents: showExpanded ? "auto" : "none",
              transitionProperty: "opacity, transform",
              transitionDuration: `${motionDuration.card}ms`,
              transitionTimingFunction: "var(--wm-ease-fluid, cubic-bezier(0.16, 1, 0.3, 1))",
            }}
          >
            {/* Backdrop image — poster variant only; primes desire before the CTA */}
            {variant === "poster" && (
              <div className="relative w-full aspect-video overflow-hidden">
                {(bookmark.backdrop_url || bookmark.poster_url) ? (
                  <img
                    src={bookmark.backdrop_url || bookmark.poster_url || ""}
                    alt={bookmark.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                    <Film className="w-8 h-8 text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/20 to-transparent" />
              </div>
            )}

            <div className="px-3 pt-2 pb-3">
              {/* Title */}
              <p className="text-sm font-bold text-white leading-tight mb-1.5 line-clamp-2">
                {bookmark.title}
              </p>

              {/* Availability / status badge */}
              <div className="flex items-center gap-1 mb-3">
                {(bookmark.availability?.providers?.length ?? 0) > 0 ? (
                  <>
                    <Check className="w-3 h-3 text-[#46d369] flex-shrink-0" />
                    <span className="text-[10px] text-[#46d369] font-semibold truncate">
                      Available on {bookmark.availability!.providers[0].name}
                    </span>
                  </>
                ) : bookmark.status === "watching" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#00a8e1] animate-pulse flex-shrink-0" />
                    <span className="text-[10px] text-[#00a8e1] font-semibold">Currently Watching</span>
                  </>
                ) : bookmark.status === "done" ? (
                  <>
                    <Check className="w-3 h-3 text-[#46d369] flex-shrink-0" />
                    <span className="text-[10px] text-[#46d369] font-semibold">Watched</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 text-[#00a8e1] flex-shrink-0" />
                    <span className="text-[10px] text-[#00a8e1] font-semibold">In your watchlist</span>
                  </>
                )}
              </div>

              {/* Action row — Play (primary, flex-1) + Schedule (circle) + More (circle dropdown) */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={handlePlay}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-white text-black text-xs font-bold h-8 rounded-md hover:bg-white/90 transition-colors min-w-0"
                  aria-label={`Play ${bookmark.title}`}
                >
                  <Play className="w-3.5 h-3.5 fill-black flex-shrink-0" />
                  <span className="truncate">
                    {bookmark.type === "series" && bookmark.status === "watching" && episodesWatched > 0
                      ? `S1 E${episodesWatched + 1}`
                      : "Play"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleScheduleClick}
                  className="w-8 h-8 rounded-full border-2 border-white/50 flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors flex-shrink-0"
                  aria-label="Schedule"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className="w-8 h-8 rounded-full border-2 border-white/50 flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors flex-shrink-0"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card border-white/10">
                    {bookmark.status !== "watching" && (
                      <DropdownMenuItem onClick={onSetWatching} className="text-white/90">
                        <Eye className="w-4 h-4 mr-2" />Set as Watching
                      </DropdownMenuItem>
                    )}
                    {bookmark.status !== "done" && (
                      <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSkip?.(); }} className="text-white/90">
                        <SkipForward className="w-4 h-4 mr-2" />Skip for now
                      </DropdownMenuItem>
                    )}
                    {bookmark.status === "done" ? (
                      <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUndoDone?.(); }} className="text-white/90">
                        <Undo2 className="w-4 h-4 mr-2" />Add Back to List
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkDone?.(); }} className="text-white/90">
                        <Check className="w-4 h-4 mr-2" />Mark as Watched
                      </DropdownMenuItem>
                    )}
                    {onToggleUpNext && bookmark.status !== "done" && (
                      <DropdownMenuItem
                        onClick={() => onToggleUpNext(bookmark)}
                        className={bookmark.queue_status === "up_next" ? "text-wm-gold" : "text-white/90"}
                      >
                        <Star className={cn("w-4 h-4 mr-2", bookmark.queue_status === "up_next" && "fill-current")} />
                        {bookmark.queue_status === "up_next" ? "Remove from Up Next" : "Add to Up Next"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToPlan?.(); }} className="text-white/90">
                      <Plus className="w-4 h-4 mr-2" />Add to Plan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    {bookmark.is_public ? (
                      <DropdownMenuItem onClick={onSharePrivate} className="text-white/90">
                        <Globe className="w-4 h-4 mr-2" />Make private
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onSharePublic} className="text-white/90">
                        <Share2 className="w-4 h-4 mr-2" />Share publicly
                      </DropdownMenuItem>
                    )}
                    {bookmark.is_vaulted ? (
                      <DropdownMenuItem onClick={onUnvault} className="text-white/90">
                        <Unlock className="w-4 h-4 mr-2" />Remove from Vault
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={onVault} className="text-white/90">
                        <Lock className="w-4 h-4 mr-2" />Move to Vault
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={handleOpenSource} className="text-white/90">
                      <ExternalLink className="w-4 h-4 mr-2" />Open Source
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Metadata row — year • episodes/runtime • rating */}
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                {bookmark.release_year && (
                  <span className="text-[10px] text-white/70">{bookmark.release_year}</span>
                )}
                {bookmark.type === "series" && totalEpisodes && (
                  <>
                    <span className="text-white/25 text-[10px]">•</span>
                    <span className="text-[10px] text-white/70">{totalEpisodes} ep</span>
                  </>
                )}
                {bookmark.type !== "series" && bookmark.runtime_minutes && (
                  <>
                    <span className="text-white/25 text-[10px]">•</span>
                    <span className="text-[10px] text-white/70">{formatRuntime(bookmark.runtime_minutes)}</span>
                  </>
                )}
                {bookmark.tmdb?.rating && (
                  <>
                    <span className="text-white/25 text-[10px]">•</span>
                    <span className="text-[10px] text-white/70">&#9733; {bookmark.tmdb.rating.toFixed(1)}</span>
                  </>
                )}
                {!bookmark.tmdb?.rating && bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                  <>
                    <span className="text-white/25 text-[10px]">•</span>
                    <span className="text-[10px] text-white/50 truncate max-w-[80px]">{bookmark.mood_tags[0]}</span>
                  </>
                )}
              </div>

              {/* Watch trailer — only shown when a trailer URL is resolved */}
              {trailerUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openSafe(toYouTubeWatchUrl(trailerUrl) ?? trailerUrl);
                  }}
                  className="mb-2.5 flex items-center gap-1.5 border border-white/35 text-white/85 text-[10px] font-semibold px-3 py-[5px] rounded-full hover:border-white hover:text-white transition-colors"
                  aria-label="Watch trailer"
                >
                  <Play className="w-2.5 h-2.5" />
                  Watch trailer
                </button>
              )}

              {/* Overview / description */}
              {(bookmark.tmdb?.overview || bookmark.notes) && (
                <p className="text-[10px] text-white/50 leading-relaxed line-clamp-3">
                  {bookmark.tmdb?.overview || bookmark.notes}
                </p>
              )}

              {/* Recommendation reason */}
              {recommendationReason && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#54b3d6]">
                  <Info className="h-3 w-3 shrink-0" />
                  <p className="truncate">Why this? {recommendationReason}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Title below card — poster only; backdrop shows title as image overlay */}
        {!showExpanded && variant === "poster" && (
          <div className="pt-1.5 px-0.5">
            <p className="text-xs font-medium text-white/90 truncate leading-tight">
              {bookmark.title}
            </p>
            {recommendationReason && (
              <p className="text-[10px] text-[#54b3d6]/90 truncate leading-tight mt-0.5">
                Why this? {recommendationReason}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quick Schedule Sheet */}
      <QuickScheduleSheet
        bookmark={bookmark}
        open={quickScheduleOpen}
        onOpenChange={setQuickScheduleOpen}
      />

      <WatchModal
        bookmark={bookmark}
        open={watchModalOpen}
        onClose={() => setWatchModalOpen(false)}
      />
    </>
  );
}
