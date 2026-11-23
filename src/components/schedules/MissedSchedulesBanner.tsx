import { formatDistanceToNow, isValid } from "date-fns";
import { X, Play, CalendarClock, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Bookmark } from "@/types/database";

interface MissedEntry {
  id: string;
  bookmark_id: string;
  scheduled_for: string;
  bookmarks: Bookmark | null;
}

interface MissedSchedulesBannerProps {
  missed: MissedEntry[];
  onWatch: (bookmark: Bookmark) => void;
  onReschedule: (bookmark: Bookmark) => void;
  onSkip: (scheduleId: string) => void;
  onDismiss: () => void;
}

export function MissedSchedulesBanner({
  missed,
  onWatch,
  onReschedule,
  onSkip,
  onDismiss,
}: MissedSchedulesBannerProps) {
  const visible = missed.filter((s) => s.bookmarks !== null);
  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-amber-400">
          You missed {visible.length} scheduled item{visible.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={onDismiss}
          className="-m-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((entry) => {
          const bm = entry.bookmarks!;
          const scheduledDate = new Date(entry.scheduled_for);
          const ago = isValid(scheduledDate)
            ? formatDistanceToNow(scheduledDate, { addSuffix: true })
            : "an unknown time ago";

          return (
            <div key={entry.id} className="flex items-center gap-3">
              {/* Thumbnail */}
              <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden bg-muted">
                {bm.poster_url || bm.backdrop_url ? (
                  <img
                    src={bm.poster_url || bm.backdrop_url || ""}
                    alt={bm.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-lg font-bold text-muted-foreground">{bm.title.charAt(0)}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{bm.title}</p>
                <p className="text-xs text-muted-foreground">Missed · {ago}</p>
              </div>

              {/* Actions — min 44px touch targets per Fitts's Law */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="h-9 px-3 text-xs gap-1"
                  onClick={() => onWatch(bm)}
                >
                  <Play className="w-3 h-3" />
                  Watch
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 text-xs gap-1"
                  onClick={() => onReschedule(bm)}
                >
                  <CalendarClock className="w-3 h-3" />
                  Reschedule
                </Button>
                <button
                  type="button"
                  className="-m-1 p-2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => onSkip(entry.id)}
                  aria-label="Skip"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
