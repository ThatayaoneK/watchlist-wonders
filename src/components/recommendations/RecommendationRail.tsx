import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SimilarTitle } from "@/hooks/useSimilarTitles";

interface RecommendationRailProps {
  title?: string;
  subtitle?: string;
  items: SimilarTitle[];
  onSave: (item: SimilarTitle) => void;
  savingItemId?: string | null;
  className?: string;
}

function toTmdbUrl(item: SimilarTitle): string {
  const media = item.media_type === "tv" ? "tv" : "movie";
  return `https://www.themoviedb.org/${media}/${item.id}`;
}

export function RecommendationRail({
  title = "You might also like",
  subtitle = "External picks based on your saved items",
  items,
  onSave,
  savingItemId = null,
  className,
}: RecommendationRailProps) {
  if (items.length === 0) return null;

  return (
    <section
      className={cn("rounded-xl border border-sky-500/30 bg-sky-500/5 p-4", className)}
      aria-label={title}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => (
          <article
            key={`${item.media_type}-${item.id}`}
            className="w-[150px] shrink-0 rounded-lg border border-border bg-card p-2.5"
          >
            <a href={toTmdbUrl(item)} target="_blank" rel="noopener noreferrer" className="block">
              <div className="mb-2 aspect-[2/3] overflow-hidden rounded-md bg-muted">
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No poster
                  </div>
                )}
              </div>
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.media_type === "tv" ? "Series" : "Movie"}
                {item.release_year ? ` · ${item.release_year}` : ""}
              </p>
            </a>

            <div className="mt-2 flex gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-7 flex-1 gap-1 text-xs"
                disabled={savingItemId === `${item.media_type}-${item.id}`}
                onClick={() => onSave(item)}
              >
                <Plus className="h-3 w-3" />
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                asChild
              >
                <a href={toTmdbUrl(item)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title} details`}>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
