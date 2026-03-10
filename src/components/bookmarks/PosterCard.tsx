import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Play, Plus, Check, CalendarPlus, MoreHorizontal, ExternalLink, Trash2, Undo2, Eye, BookMarked, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { QuickScheduleSheet } from "@/components/schedules/QuickScheduleSheet";
import type { Bookmark } from "@/types/database";

interface PosterCardProps {
  bookmark: Bookmark;
  onPlay?: () => void;
  onSchedule?: () => void;
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
}

const PROVIDER_COLOR: Record<string, string> = {
  youtube:       "bg-red-600",
  netflix:       "bg-red-700",
  imdb:          "bg-yellow-500",
  instagram:     "bg-pink-500",
  facebook:      "bg-blue-600",
  x:             "bg-neutral-400",
  letterboxd:    "bg-green-600",
  tiktok:        "bg-neutral-900",
  reddit:        "bg-orange-500",
  rottentomatoes:"bg-red-500",
  generic:       "bg-muted-foreground",
};

const PROVIDER_LABEL: Record<string, string> = {
  youtube:       "YouTube",
  netflix:       "Netflix",
  imdb:          "IMDB",
  instagram:     "Instagram",
  facebook:      "Facebook",
  x:             "X",
  letterboxd:    "Letterboxd",
  tiktok:        "TikTok",
  reddit:        "Reddit",
  rottentomatoes:"Rotten Tomatoes",
  generic:       "Web",
};

const MOOD_COLOR: Record<string, string> = {
  chill:     "bg-chart-4/20 text-chart-4",
  intense:   "bg-destructive/20 text-destructive",
  funny:     "bg-chart-2/20 text-chart-2",
  romantic:  "bg-pink-500/20 text-pink-400",
  inspiring: "bg-chart-3/20 text-chart-3",
  dark:      "bg-chart-5/20 text-chart-5",
};

function formatRuntime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isNewBookmark(createdAt: string) {
  const created = new Date(createdAt);
  const now = new Date();
  return now.getTime() - created.getTime() < 24 * 60 * 60 * 1000;
}

const STATUS_CYCLE: Record<string, Bookmark["status"]> = {
  backlog: "watching",
  watching: "done",
  done: "backlog",
  scheduled: "watching",
  dropped: "backlog",
};

const trailerUrlCache = new Map<string, string | null>();

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

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    // Ignore invalid URLs
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

function toTrailerEmbedUrl(rawUrl: string): string | null {
  const youtubeId = extractYouTubeVideoId(rawUrl);
  if (youtubeId) return toYouTubeEmbedUrl(youtubeId);
  return null;
}

function getBookmarkTrailerUrl(bookmark: Bookmark): string | null {
  const metadata = bookmark.metadata || {};
  const fromMetadata = getMetadataString(metadata, [
    "trailer_url",
    "trailerUrl",
    "youtube_trailer_url",
    "youtubeTrailerUrl",
    "video_url",
    "videoUrl",
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
  const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY;
  if (!tmdbApiKey) return null;

  const tmdbId = getMetadataNumber(bookmark.metadata || {}, ["tmdb_id", "tmdbId"]);
  if (!tmdbId) return null;

  const mediaType = bookmark.type === "series" ? "tv" : "movie";
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (trailerUrlCache.has(cacheKey)) return trailerUrlCache.get(cacheKey) ?? null;

  try {
    const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/videos?api_key=${tmdbApiKey}`);
    if (!res.ok) {
      trailerUrlCache.set(cacheKey, null);
      return null;
    }

    const data = (await res.json()) as { results?: Array<{ site?: string; type?: string; official?: boolean; key?: string }> };
    const videos = data.results || [];
    const selected =
      videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official && v.key) ||
      videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.key) ||
      videos.find((v) => v.site === "YouTube" && (v.type === "Teaser" || v.type === "Clip") && v.key);

    const trailerUrl = selected?.key ? toYouTubeEmbedUrl(selected.key) : null;
    trailerUrlCache.set(cacheKey, trailerUrl);
    return trailerUrl;
  } catch {
    trailerUrlCache.set(cacheKey, null);
    return null;
  }
}

export function PosterCard({
  bookmark,
  onPlay,
  onSchedule,
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
}: PosterCardProps) {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [quickScheduleOpen, setQuickScheduleOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(() => getBookmarkTrailerUrl(bookmark));
  const [episodePopoverOpen, setEpisodePopoverOpen] = useState(false);
  const [localEpisodeCount, setLocalEpisodeCount] = useState(0);
  const cardRef = useRef<HTMLAnchorElement>(null);

  const imageUrl =
    variant === "poster"
      ? bookmark.poster_url || bookmark.backdrop_url
      : bookmark.backdrop_url || bookmark.poster_url;
  const aspectRatio = variant === "poster" ? "aspect-[2/3]" : "aspect-video";

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPlay) {
      onPlay();
      return;
    }
    if (!trailerUrl && bookmark.source_url) {
      window.open(bookmark.source_url, "_blank", "noopener");
      return;
    }
    setIsHovered(true);
    setIsTouched(true);
  };

  const handleOpenSource = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmark.source_url) window.open(bookmark.source_url, "_blank");
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

  const moodColor = (mood: string) =>
    MOOD_COLOR[mood.toLowerCase()] || "bg-muted text-muted-foreground";

  const isNew = isNewBookmark(bookmark.created_at);

  // Episode tracking (series in watching status)
  const episodesWatched = typeof bookmark.metadata?.episodes_watched === "number" ? bookmark.metadata.episodes_watched : 0;
  const totalEpisodes = typeof bookmark.metadata?.total_episodes === "number" ? bookmark.metadata.total_episodes : null;
  const showEpisodeBar = bookmark.type === "series" && bookmark.status === "watching";
  const episodeProgress = totalEpisodes ? (episodesWatched / totalEpisodes) * 100 : 0;

  const handleStatusPillClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onStatusCycle) return;
    const next = STATUS_CYCLE[bookmark.status] ?? "backlog";
    onStatusCycle(bookmark, next);
  };

  const handleEpisodeUpdate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEpisodeUpdate?.(bookmark, localEpisodeCount);
    setEpisodePopoverOpen(false);
  };
  const isPreviewActive =
    !isMobile &&
    !isSelectable &&
    (isHovered || isTouched);
  const showTrailerPreview = isPreviewActive && Boolean(trailerUrl);

  useEffect(() => {
    setTrailerUrl(getBookmarkTrailerUrl(bookmark));
  }, [bookmark.id, bookmark.source_url, bookmark.metadata]);

  useEffect(() => {
    setLocalEpisodeCount(episodesWatched);
  }, [episodesWatched]);

  useEffect(() => {
    if (!isPreviewActive || trailerUrl) return;

    let cancelled = false;
    fetchTmdbTrailerUrl(bookmark).then((url) => {
      if (!cancelled && url) setTrailerUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [isPreviewActive, trailerUrl, bookmark]);

  // Add document-level listener to clear isTouched for touch-only devices
  useEffect(() => {
    if (!isTouched) return;

    const handleOutsideTouch = (e: Event) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsTouched(false);
        setIsHovered(false);
      }
    };

    // Listen for touchstart, click, and pointerdown events on the document
    document.addEventListener("touchstart", handleOutsideTouch);
    document.addEventListener("click", handleOutsideTouch);
    document.addEventListener("pointerdown", handleOutsideTouch);

    return () => {
      document.removeEventListener("touchstart", handleOutsideTouch);
      document.removeEventListener("click", handleOutsideTouch);
      document.removeEventListener("pointerdown", handleOutsideTouch);
    };
  }, [isTouched]);

  return (
    <>
      <Link
        ref={cardRef}
        to={`/b/${bookmark.id}`}
        className={cn(
          "group relative block flex-shrink-0 rounded-xl overflow-hidden transition-all duration-300",
          variant === "poster" ? "w-32 sm:w-36 md:w-40 lg:w-44" : "w-60 sm:w-72 md:w-80",
          (isHovered || isTouched) && !isSelectable && "scale-105 z-10 shadow-2xl ring-2 ring-primary/50",
          isSelected && "ring-2 ring-primary",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setIsTouched(false); }}
        onClick={handleCardClick}
      >
        {/* Image Container */}
        <div className={cn("relative bg-wm-surface", aspectRatio)}>
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={bookmark.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-wm-surface">
              <span className="text-3xl font-bold text-muted-foreground/40">
                {bookmark.title.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {showTrailerPreview && trailerUrl && (
            <div className="absolute inset-0 z-[1] bg-black">
              <iframe
                src={trailerUrl}
                title={`${bookmark.title} trailer preview`}
                className="w-full h-full pointer-events-none"
                allow="autoplay; encrypted-media; picture-in-picture"
                loading="lazy"
              />
            </div>
          )}

          {/* Provider dot (top-left) */}
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <div
              title={PROVIDER_LABEL[bookmark.provider] || "Web"}
              className={cn("w-3 h-3 rounded-full border border-black/20", PROVIDER_COLOR[bookmark.provider] || "bg-muted-foreground")}
            />
          </div>

          {/* "New" badge */}
          {isNew && !isSelectable && (
            <div className="absolute top-2 right-2">
              <span className="text-[9px] font-bold bg-wm-gold text-background px-1.5 py-0.5 rounded uppercase tracking-wide">
                New
              </span>
            </div>
          )}

          {/* Select checkbox */}
          {isSelectable && (
            <div className="absolute top-2 right-2 z-20">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.()}
                className="bg-background/80 backdrop-blur-sm data-[state=checked]:bg-primary"
              />
            </div>
          )}

          {/* Status badge — Watching (only shown when no status pill is available) */}
          {!isSelectable && !onStatusCycle && bookmark.status === "watching" && !isNew && (
            <div className="absolute top-2 right-2">
              <span className="flex items-center gap-1 text-[9px] font-bold bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 bg-primary-foreground rounded-full animate-pulse" />
                Watching
              </span>
            </div>
          )}

          {/* Scheduled indicator (gold clock badge) */}
          {!isSelectable && bookmark.status === "scheduled" && !isNew && (
            <div className="absolute top-2 right-2">
              <span className="text-[9px] font-bold bg-wm-gold/90 text-background px-1.5 py-0.5 rounded">
                Scheduled
              </span>
            </div>
          )}

          {/* Runtime — always visible when card in rail */}
          {bookmark.runtime_minutes && (
            <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-medium px-1.5 py-0.5 rounded">
              {formatRuntime(bookmark.runtime_minutes)}
            </div>
          )}

          {/* One-tap status pill (bottom-left) — only when onStatusCycle provided and not in select mode */}
          {onStatusCycle && !isSelectable && (
            <button
              type="button"
              onClick={handleStatusPillClick}
              className={cn(
                "absolute bottom-2 left-2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-opacity",
                bookmark.status === "watching"
                  ? "bg-primary/90 text-primary-foreground"
                  : bookmark.status === "done"
                  ? "bg-emerald-600/90 text-white"
                  : "bg-background/80 text-muted-foreground backdrop-blur-sm"
              )}
              aria-label={`Status: ${bookmark.status}. Click to advance.`}
            >
              {bookmark.status === "watching" && (
                <>
                  <span className="w-1.5 h-1.5 bg-primary-foreground rounded-full animate-pulse" />
                  Watching
                </>
              )}
              {bookmark.status === "done" && (
                <>
                  <Check className="w-2.5 h-2.5" />
                  Done
                </>
              )}
              {(bookmark.status === "backlog" || bookmark.status === "scheduled" || bookmark.status === "dropped") && (
                <>
                  <BookMarked className="w-2.5 h-2.5" />
                  {bookmark.status === "backlog" ? "Backlog" : bookmark.status === "scheduled" ? "Scheduled" : "Dropped"}
                </>
              )}
            </button>
          )}

          {/* Episode progress bar (series in watching) */}
          {showEpisodeBar && !isSelectable && (
            <Popover open={episodePopoverOpen} onOpenChange={setEpisodePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEpisodePopoverOpen(true); }}
                  className="absolute bottom-0 left-0 right-0 h-1.5 bg-background/40 z-20 cursor-pointer hover:h-2 transition-all"
                  aria-label="Episode progress"
                >
                  <div
                    className="h-full bg-primary rounded-tr-full"
                    style={{ width: `${Math.min(episodeProgress, 100)}%`, minWidth: episodesWatched > 0 ? "4px" : "0" }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-48 p-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium mb-2">Episodes watched</p>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLocalEpisodeCount((c) => Math.max(0, c - 1)); }}
                    className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="flex-1 text-center font-semibold text-sm">
                    {localEpisodeCount}{totalEpisodes ? `/${totalEpisodes}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLocalEpisodeCount((c) => c + 1); }}
                    className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <Button size="sm" className="w-full text-xs" onClick={handleEpisodeUpdate}>
                  Update
                </Button>
              </PopoverContent>
            </Popover>
          )}

          {/* Hover overlay */}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-0 transition-opacity duration-300",
              (isHovered || isTouched) && "opacity-100"
            )}
          />

          {/* Mobile persistent action button — always visible, no hover required */}
          {isMobile && !isSelectable && (
            <div className="absolute bottom-10 right-1.5 z-20">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 rounded-full bg-background/80 backdrop-blur-sm"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    aria-label="More options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {bookmark.status !== "watching" && (
                    <DropdownMenuItem onClick={onSetWatching}>
                      <Eye className="w-4 h-4 mr-2" />
                      Set as Watching
                    </DropdownMenuItem>
                  )}
                  {bookmark.status === "done" ? (
                    <DropdownMenuItem onClick={onUndoDone}>
                      <Undo2 className="w-4 h-4 mr-2" />
                      Move to Backlog
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onMarkDone}>
                      <Check className="w-4 h-4 mr-2" />
                      Mark as Done
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onAddToPlan}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add to Plan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleScheduleClick}>
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    Quick Schedule
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleOpenSource}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Source
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Hover Actions */}
          {!isSelectable && (
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 p-3 transform translate-y-full transition-transform duration-300",
                (isHovered || isTouched) && "translate-y-0"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Play button */}
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full shrink-0"
                  onClick={handlePlay}
                  aria-label={`Play ${bookmark.title}`}
                >
                  <Play className="w-4 h-4 fill-current" />
                </Button>

                <div className="flex items-center gap-1">
                  {/* Quick Schedule button */}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={handleScheduleClick}
                    aria-label={`Schedule ${bookmark.title}`}
                  >
                    <CalendarPlus className="w-4 h-4" />
                  </Button>

                  {/* More options */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        aria-label="More options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {bookmark.status !== "watching" && (
                        <DropdownMenuItem onClick={onSetWatching}>
                          <Eye className="w-4 h-4 mr-2" />
                          Set as Watching
                        </DropdownMenuItem>
                      )}
                      {bookmark.status === "done" ? (
                        <DropdownMenuItem onClick={onUndoDone}>
                          <Undo2 className="w-4 h-4 mr-2" />
                          Move to Backlog
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={onMarkDone}>
                          <Check className="w-4 h-4 mr-2" />
                          Mark as Done
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={onAddToPlan}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add to Plan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleOpenSource}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Source
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Title + metadata */}
        <div className="p-2.5">
          <h3 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
            {bookmark.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {bookmark.release_year && (
              <span className="text-[10px] text-muted-foreground">{bookmark.release_year}</span>
            )}
            {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", moodColor(bookmark.mood_tags[0]))}>
                {bookmark.mood_tags[0]}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Quick Schedule Sheet */}
      <QuickScheduleSheet
        bookmark={bookmark}
        open={quickScheduleOpen}
        onOpenChange={setQuickScheduleOpen}
      />
    </>
  );
}
