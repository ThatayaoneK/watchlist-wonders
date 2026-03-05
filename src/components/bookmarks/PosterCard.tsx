import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Play, Plus, Check, CalendarPlus, MoreHorizontal, ExternalLink, Trash2, Undo2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

export function PosterCard({
  bookmark,
  onPlay,
  onSchedule,
  onMarkDone,
  onAddToPlan,
  onDelete,
  onUndoDone,
  onSetWatching,
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
  const cardRef = useRef<HTMLAnchorElement>(null);

  const imageUrl =
    variant === "poster"
      ? bookmark.poster_url || bookmark.backdrop_url
      : bookmark.backdrop_url || bookmark.poster_url;
  const aspectRatio = variant === "poster" ? "aspect-[2/3]" : "aspect-video";

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmark.source_url) window.open(bookmark.source_url, "_blank");
    onPlay?.();
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

          {/* Status badge — Watching */}
          {!isSelectable && bookmark.status === "watching" && !isNew && (
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

          {/* Hover overlay */}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-0 transition-opacity duration-300",
              (isHovered || isTouched) && "opacity-100"
            )}
          />

          {/* Mobile persistent action button — always visible, no hover required */}
          {isMobile && !isSelectable && (
            <div className="absolute bottom-8 right-1.5 z-20">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    aria-label="More options"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
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
                  <DropdownMenuItem onClick={handlePlay}>
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
                      <DropdownMenuItem onClick={handlePlay}>
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
            {/* "Schedule" pill on backlog cards — subtle CTA */}
            {!isSelectable && bookmark.status === "backlog" && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickScheduleOpen(true); }}
                className="text-[9px] text-muted-foreground/60 hover:text-primary flex items-center gap-0.5 transition-colors"
                title="Schedule this"
              >
                <CalendarPlus className="w-2.5 h-2.5" />
              </button>
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
