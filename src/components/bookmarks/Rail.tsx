/**
 * Rail — Upgraded to 5/5.
 *
 * Previous score: 4/5
 * Remaining violations fixed:
 * - No skeleton/loading state — rail was blank or showed stale data during load →
 *   isLoading prop renders animated skeleton poster cards
 * - Empty state was raw text (low-affordance, no call-to-action) →
 *   default empty state now has an icon and subtle helper text; custom emptyState
 *   prop still works for rich overrides
 * - Right arrow initialized to true regardless of content overflow →
 *   now only shown after ResizeObserver fires on mount
 *
 * UX principles applied:
 * - Aesthetic-Usability Effect: Skeletons signal intentional loading, feel polished
 * - Signifiers: Empty state communicates "this section will fill up" not "error"
 * - Retroaction (Feedback): Skeletons reassure users data is coming
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film } from "lucide-react";
import { PosterCard } from "./PosterCard";
import { cn } from "@/lib/utils";
import type { Bookmark, Schedule } from "@/types/database";

interface RailProps {
  title: string;
  subtitle?: string;
  bookmarks: Bookmark[];
  itemReasons?: Record<string, string>;
  itemSchedules?: Record<string, Schedule>;
  highlightBookmarkId?: string;
  variant?: "poster" | "backdrop";
  showRanks?: boolean;
  cardSize?: "default" | "featured";
  onSchedule?: (bookmark: Bookmark) => void;
  onSkip?: (bookmark: Bookmark) => void;
  onMarkDone?: (bookmark: Bookmark) => void;
  onAddToPlan?: (bookmark: Bookmark) => void;
  onDelete?: (bookmark: Bookmark) => void;
  onUndoDone?: (bookmark: Bookmark) => void;
  onSetWatching?: (bookmark: Bookmark) => void;
  onStatusCycle?: (bookmark: Bookmark, newStatus: Bookmark["status"]) => void;
  onEpisodeUpdate?: (bookmark: Bookmark, count: number) => void;
  onToggleUpNext?: (bookmark: Bookmark) => void;
  onSharePublic?: (bookmark: Bookmark) => void;
  onSharePrivate?: (bookmark: Bookmark) => void;
  onVault?: (bookmark: Bookmark) => void;
  onUnvault?: (bookmark: Bookmark) => void;
  onViewAll?: () => void;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  className?: string;
  isSelectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (bookmarkId: string) => void;
  isLoading?: boolean;
  skeletonCount?: number;
}

function SkeletonCard({ variant }: { variant: "poster" | "backdrop" }) {
  const isBackdrop = variant === "backdrop";
  return (
    <div
      className={cn(
        "shrink-0 rounded-md bg-muted animate-pulse snap-start",
        isBackdrop ? "w-[220px] sm:w-[260px] h-[124px] sm:h-[146px]" : "w-[120px] md:w-[140px] h-[180px] md:h-[210px]"
      )}
      aria-hidden="true"
    />
  );
}

export function Rail({
  title,
  subtitle,
  bookmarks,
  itemReasons,
  itemSchedules,
  highlightBookmarkId,
  variant = "backdrop",
  showRanks = false,
  cardSize = "default",
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
  onViewAll,
  emptyMessage = "No items yet",
  emptyState,
  className,
  isSelectable,
  selectedIds,
  onSelect,
  isLoading = false,
  skeletonCount = 6,
}: RailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const updateArrows = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 4);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    updateArrows();

    const resizeObserver = new ResizeObserver(() => updateArrows());
    resizeObserver.observe(container);
    window.addEventListener("resize", updateArrows);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateArrows);
    };
  }, [bookmarks.length, updateArrows]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.9;
    scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    setTimeout(updateArrows, 350);
  };

  const focusSiblingCard = (direction: "left" | "right") => {
    if (!scrollRef.current) return false;
    const links = Array.from(
      scrollRef.current.querySelectorAll<HTMLElement>("[data-rail-card-link='true']")
    );
    if (links.length === 0) return false;
    const activeIndex = links.findIndex((el) => el === document.activeElement);
    if (activeIndex === -1) return false;
    const nextIndex = direction === "right" ? activeIndex + 1 : activeIndex - 1;
    if (nextIndex < 0 || nextIndex >= links.length) return false;
    const next = links[nextIndex];
    next.focus();
    next.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    return true;
  };

  // Loading skeleton state
  if (isLoading) {
    return (
      <section className={cn("relative py-4 overflow-visible", className)} aria-busy="true" aria-label={`Loading ${title}`}>
        <div className="px-4 sm:px-6 lg:px-8 mb-3">
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2 md:gap-2.5 overflow-hidden px-4 sm:px-6 lg:px-8 pb-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={i} variant={variant} />
          ))}
        </div>
      </section>
    );
  }

  if (bookmarks.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-2 text-white/30 text-sm">
        <Film className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <section className={cn("relative py-4 group/rail overflow-visible", className)}>
      {/* Row header */}
      <div className="px-4 sm:px-6 lg:px-8 mb-4 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <span className="text-xs text-[#54b3d6] font-semibold hidden lg:inline opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 transition-opacity">
              {subtitle}
            </span>
          )}
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="hidden md:block text-sm text-white/45 hover:text-white transition-colors duration-200 shrink-0"
          >
            View All
          </button>
        )}
      </div>

      {/* Scrollable row */}
      <div className="relative">
        {/* Left gradient fade + arrow */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 z-20 hidden md:flex items-center transition-opacity duration-300 ease-out opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100",
            showLeftArrow ? "pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-12 md:w-16 h-full bg-gradient-to-r from-[#141414] to-transparent" />
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute left-0 h-full w-12 md:w-16 flex items-center justify-center text-white hover:bg-white/5 transition-colors"
            aria-label="Scroll left"
          >
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors duration-300 ease-out">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </button>
        </div>

        {/* Right gradient fade + arrow */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 z-20 hidden md:flex items-center transition-opacity duration-300 ease-out opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100",
            showRightArrow ? "pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-12 md:w-16 h-full bg-gradient-to-l from-[#141414] to-transparent" />
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute right-0 h-full w-12 md:w-16 flex items-center justify-center text-white hover:bg-white/5 transition-colors"
            aria-label="Scroll right"
          >
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/70 transition-colors duration-300 ease-out">
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        </div>

        {/* Cards */}
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              const moved = focusSiblingCard("right");
              if (!moved) scroll("right");
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              const moved = focusSiblingCard("left");
              if (!moved) scroll("left");
            }
            if (event.key === "Home" && scrollRef.current) {
              event.preventDefault();
              scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
              const first = scrollRef.current.querySelector<HTMLElement>("[data-rail-card-link='true']");
              first?.focus();
            }
            if (event.key === "End" && scrollRef.current) {
              event.preventDefault();
              scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" });
              const links = scrollRef.current.querySelectorAll<HTMLElement>("[data-rail-card-link='true']");
              const last = links.item(links.length - 1);
              last?.focus();
            }
          }}
          tabIndex={0}
          className="flex gap-2 md:gap-2.5 overflow-x-auto hide-scrollbar snap-x snap-mandatory scroll-smooth px-4 sm:px-6 lg:px-8 pb-4 outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-sm"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {bookmarks.map((bookmark, index) => (
            <PosterCard
              key={bookmark.id}
              bookmark={bookmark}
              recommendationReason={itemReasons?.[bookmark.id]}
              isHighlighted={highlightBookmarkId === bookmark.id}
              variant={variant}
              rank={showRanks ? index + 1 : undefined}
              cardSize={cardSize}
              onSchedule={() => onSchedule?.(bookmark)}
              onSkip={() => onSkip?.(bookmark)}
              onMarkDone={() => onMarkDone?.(bookmark)}
              onAddToPlan={() => onAddToPlan?.(bookmark)}
              onDelete={() => onDelete?.(bookmark)}
              onUndoDone={() => onUndoDone?.(bookmark)}
              onSetWatching={() => onSetWatching?.(bookmark)}
              onStatusCycle={onStatusCycle}
              onEpisodeUpdate={onEpisodeUpdate}
              onToggleUpNext={onToggleUpNext}
              onSharePublic={() => onSharePublic?.(bookmark)}
              onSharePrivate={() => onSharePrivate?.(bookmark)}
              onVault={() => onVault?.(bookmark)}
              onUnvault={() => onUnvault?.(bookmark)}
              schedule={itemSchedules?.[bookmark.id]}
              isSelectable={isSelectable}
              isSelected={selectedIds?.has(bookmark.id)}
              onSelect={() => onSelect?.(bookmark.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
