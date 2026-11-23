import * as React from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EnrichmentMatchCandidate } from "@/lib/enrichmentSmartFill";

type Props = {
  candidates: EnrichmentMatchCandidate[];
  selectedKey: string | null;
  onSelect: (candidate: EnrichmentMatchCandidate) => void;
};

function typeLabel(candidate: EnrichmentMatchCandidate): string {
  switch (candidate.contentType) {
    case "episode": return "Episode";
    case "series": return "Series";
    case "movie": return "Movie";
    default: return candidate.mediaType === "tv" ? "Series" : "Movie";
  }
}

export function CandidateGrid({ candidates, selectedKey, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {candidates.slice(0, 5).map((candidate, index) => {
        const isActive = selectedKey === `${candidate.tmdbId}-${candidate.mediaType}`;
        return (
          <button
            key={`${candidate.tmdbId}-${candidate.mediaType}`}
            type="button"
            onClick={() => onSelect(candidate)}
            aria-pressed={isActive}
            className={cn(
              "flex flex-col rounded-lg border overflow-hidden text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-primary/50"
            )}
          >
            {/* Poster — 2:3 aspect ratio */}
            <div className="aspect-[2/3] w-full bg-muted relative overflow-hidden">
              {candidate.posterUrl ? (
                <img
                  src={candidate.posterUrl}
                  alt={candidate.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground/20">
                  {candidate.title.charAt(0).toUpperCase()}
                </div>
              )}
              {isActive && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-white drop-shadow" />
                </div>
              )}
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  Best match
                </span>
              )}
            </div>

            {/* Meta */}
            <div className="p-2 space-y-1">
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-medium">
                {typeLabel(candidate)}
              </Badge>
              <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
                {candidate.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {candidate.releaseYear ?? ""}
                {candidate.runtimeMinutes ? ` · ${candidate.runtimeMinutes}m` : ""}
              </p>
              {candidate.description && (
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                  {candidate.description}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
