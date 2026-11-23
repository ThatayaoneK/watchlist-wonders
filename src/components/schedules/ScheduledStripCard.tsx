import { useState } from "react";
import { format } from "date-fns";
import { Play, CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/database";

interface ScheduleEntry {
  id: string;
  bookmark_id: string;
  scheduled_for: string;
  bookmarks: Bookmark | null;
}

interface ScheduledStripCardProps {
  schedule: ScheduleEntry;
  onWatch: (bookmarkId: string) => void;
  onReschedule: (bookmark: Bookmark, scheduleId: string) => void;
  onRemove: (scheduleId: string) => void;
}

export function ScheduledStripCard({ schedule, onWatch, onReschedule, onRemove }: ScheduledStripCardProps) {
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = useState(false);
  const bm = schedule.bookmarks;

  if (!bm) return null;

  const rawDate = schedule.scheduled_for ? new Date(schedule.scheduled_for) : null;
  const scheduledDate = rawDate && isFinite(rawDate.getTime()) ? rawDate : null;
  const isToday = scheduledDate ? scheduledDate.toDateString() === new Date().toDateString() : false;
  const titleInitial = bm.title?.trim().charAt(0) || "?";

  const showActions = isMobile || isHovered;

  return (
    <div
      className="relative shrink-0 w-56 bg-wm-surface border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image area */}
      <div className="relative h-28 bg-muted overflow-hidden">
        {bm.backdrop_url || bm.poster_url ? (
          <img
            src={bm.backdrop_url || bm.poster_url || ""}
            alt={bm.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl font-bold text-muted-foreground">{titleInitial}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        {scheduledDate && (
          <div className={cn(
            "absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full",
            isToday ? "bg-primary text-primary-foreground" : "bg-wm-gold text-background"
          )}>
            {isToday ? `Today ${format(scheduledDate, "h:mm a")}` : format(scheduledDate, "EEE, MMM d")}
          </div>
        )}

        {/* Remove button — w-8 h-8 for 32px tap target */}
        <button
          className={cn(
            "absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center transition-opacity",
            showActions ? "opacity-100" : "opacity-0"
          )}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(schedule.id); }}
          aria-label="Remove schedule"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {bm.title}
        </p>
        {bm.runtime_minutes && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {bm.runtime_minutes < 60 ? `${bm.runtime_minutes}m` : `${Math.floor(bm.runtime_minutes / 60)}h${bm.runtime_minutes % 60 > 0 ? ` ${bm.runtime_minutes % 60}m` : ''}`}
          </p>
        )}
      </div>

      {/* Action buttons — h-9 meets 44px touch target on mobile */}
      <div className={cn(
        "px-3 pb-3 flex gap-1.5 transition-all",
        showActions ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <Button
          size="sm"
          className="flex-1 h-9 text-xs gap-1"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWatch(bm.id); }}
        >
          <Play className="w-3 h-3" />
          Watch
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-9 text-xs gap-1"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReschedule(bm, schedule.id); }}
        >
          <CalendarClock className="w-3 h-3" />
          Reschedule
        </Button>
      </div>
    </div>
  );
}

