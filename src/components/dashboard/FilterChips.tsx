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
}

export function FilterChips({
  activeType,
  activeStatus,
  onTypeChange,
  onStatusChange,
  counts,
  className,
}: FilterChipsProps) {
  const typeFilters = [
    { value: "all" as const, label: "All" },
    { value: "movie" as const, label: "Movies", count: counts.movie },
    { value: "series" as const, label: "Series", count: counts.series },
    { value: "video" as const, label: "Videos", count: counts.video },
    { value: "doc" as const, label: "Docs", count: counts.doc },
  ];

  const statusFilters = [
    { value: "all" as const, label: "All" },
    { value: "backlog" as const, label: "Want to Watch", count: counts.backlog },
    { value: "watching" as const, label: "Watching", count: counts.watching },
    { value: "done" as const, label: "Watched", count: counts.done },
  ];

  return (
    <div
      className={cn("flex items-center gap-1 overflow-x-auto", className)}
      style={{ scrollbarWidth: "none" }}
      role="toolbar"
      aria-label="Filter bookmarks"
    >
      {/* Type filters */}
      {typeFilters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onTypeChange(filter.value)}
          aria-pressed={activeType === filter.value}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeType === filter.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground hover:bg-white/10"
          )}
        >
          {filter.label}
          {filter.count !== undefined && filter.count > 0 && (
            <span className="ml-1 opacity-60 text-xs">{filter.count}</span>
          )}
        </button>
      ))}

      <span className="w-px h-4 bg-border/60 mx-1 shrink-0" aria-hidden="true" />

      {/* Status filters */}
      {statusFilters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onStatusChange(filter.value)}
          aria-pressed={activeStatus === filter.value}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeStatus === filter.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-white/10"
          )}
        >
          {filter.label}
          {filter.count !== undefined && filter.count > 0 && (
            <span className="ml-1 opacity-60 text-xs">{filter.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
