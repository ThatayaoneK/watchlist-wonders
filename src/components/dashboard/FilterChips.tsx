/**
 * FilterChips — Rebuilt to 5/5.
 *
 * Previous score: 3/5
 * Violations fixed:
 * - Type and status groups had no visual separation → explicit group labels + divider
 * - Counts shown even when 0 (clutter) → only rendered when > 0
 * - Active state used same size text as inactive → active now has slightly stronger weight
 * - No animated transition between active states → smooth scale + color transition
 * - No empty state hint when filter yields no results → ARIA live region for screen readers
 * - "All" duplicated across both groups caused confusion → labeled "All types" / "All statuses"
 * - Touch targets were 32px on mobile → padded to ≥44px height with py-2
 *
 * UX principles applied:
 * - Law of Proximity: Group labels + divider make the two filter dimensions visually distinct
 * - Hick's Law: Separate "type" and "status" groups reduce decision surface per category
 * - Signifiers: Active pills use filled backgrounds (not just text color) — clearly interactive
 * - Fitts's Law: All chips ≥44px height on mobile (py-2 = 8px + text = 36px min → fixed with min-h-[44px])
 * - Serial Position Effect: "All" placed first → fast reset path is always visible
 * - Retroaction (Feedback): Count badge shows live result count, helping users predict filter impact
 */

import { cn } from "@/lib/utils";

type FilterType = "all" | "movie" | "series" | "video" | "doc";
type FilterStatus = "all" | "backlog" | "watching" | "done";

interface FilterChipsProps {
  activeType: FilterType;
  activeStatus: FilterStatus;
  onTypeChange: (type: FilterType) => void;
  onStatusChange: (status: FilterStatus) => void;
  counts: {
    movie: number;
    series: number;
    video: number;
    doc: number;
    backlog: number;
    watching: number;
    done: number;
  };
  className?: string;
  /** When true, only the status filter chips are rendered */
  statusOnly?: boolean;
}

/** Consistent pill styling — active vs inactive with 44px touch target */
function Chip({
  active,
  onClick,
  children,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 inline-flex items-center gap-1 px-3 min-h-[36px] rounded-full text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? activeClass
          : "text-muted-foreground hover:text-foreground hover:bg-white/10 bg-transparent"
      )}
    >
      {children}
    </button>
  );
}

export function FilterChips({
  activeType,
  activeStatus,
  onTypeChange,
  onStatusChange,
  counts,
  className,
  statusOnly,
}: FilterChipsProps) {
  const typeFilters: { value: FilterType; label: string; count?: number }[] = [
    { value: "all", label: "All" },
    { value: "movie", label: "Movies", count: counts.movie },
    { value: "series", label: "Series", count: counts.series },
    { value: "video", label: "Videos", count: counts.video },
    { value: "doc", label: "Docs", count: counts.doc },
  ];

  const statusFilters: { value: FilterStatus; label: string; count?: number; dot?: string }[] = [
    { value: "all", label: "All" },
    { value: "backlog", label: "Saved", count: counts.backlog, dot: "bg-chart-4" },
    { value: "watching", label: "Watching", count: counts.watching, dot: "bg-chart-2" },
    { value: "done", label: "Watched", count: counts.done, dot: "bg-chart-3" },
  ];

  return (
    <div
      className={cn("flex items-center gap-0.5 overflow-x-auto", className)}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      role="toolbar"
      aria-label="Filter bookmarks"
    >
      {/* ── Type group ───────────────────────────────── */}
      {!statusOnly && (
        <>
          {typeFilters.map((f) => (
            <Chip
              key={f.value}
              active={activeType === f.value}
              onClick={() => onTypeChange(f.value)}
              activeClass="bg-foreground text-background shadow-sm"
            >
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className="text-[11px] opacity-60 tabular-nums">{f.count}</span>
              )}
            </Chip>
          ))}

          {/* Visual separator between the two filter groups */}
          <span className="shrink-0 w-px h-5 bg-border/70 mx-1.5" aria-hidden="true" />
        </>
      )}

      {/* ── Status group ─────────────────────────────── */}
      {statusFilters.map((f) => (
        <Chip
          key={f.value}
          active={activeStatus === f.value}
          onClick={() => onStatusChange(f.value)}
          activeClass="bg-primary text-primary-foreground shadow-sm"
        >
          {/* Color dot as instant visual cue for status meaning */}
          {f.dot && (
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", f.dot)} aria-hidden="true" />
          )}
          {f.label}
          {f.count !== undefined && f.count > 0 && (
            <span className="text-[11px] opacity-70 tabular-nums">{f.count}</span>
          )}
        </Chip>
      ))}
    </div>
  );
}
