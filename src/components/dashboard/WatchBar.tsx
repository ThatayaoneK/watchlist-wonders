/**
 * WatchBar — JustWatch-inspired persistent filter strip.
 *
 * A compact horizontal bar always visible above the dashboard rails with:
 * - Row 1: Scrollable provider logo pills (tap to toggle filter)
 * - Row 2: Active filter chips (runtime preset, extra mood tags) with × to remove
 * - Row 3: Quick preset buttons (Quick Watch, Movie Night, Series)
 *
 * Syncs its state directly with AdvancedFilters in Dashboard via onApply.
 */

import { useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProviderMeta } from "@/constants/providers";
import type { AdvancedFilters } from "@/components/dashboard/FilterPanel";

// Providers shown in the WatchBar (most common ones)
const WATCHBAR_PROVIDERS = [
  "youtube", "netflix", "imdb", "disneyplus", "primevideo",
  "hbomax", "appletv", "peacock", "tiktok", "instagram",
];

const RUNTIME_QUICK_PRESETS = [
  { label: "Quick Watch", min: null, max: 30 },
  { label: "Movie Night", min: 90, max: null },
  { label: "Series", min: null, max: null, type: "series" as const },
] as const;

interface WatchBarProps {
  filters: AdvancedFilters;
  onApply: (filters: AdvancedFilters) => void;
}

function ProviderPill({
  provider,
  active,
  onClick,
}: {
  provider: string;
  active: boolean;
  onClick: () => void;
}) {
  const meta = getProviderMeta(provider);
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={meta.label}
      className={cn(
        "flex-shrink-0 flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-xs font-medium transition-colors",
        active
          ? "bg-primary/10 border-primary text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card"
      )}
    >
      {meta.logoUrl && !imgError ? (
        <img
          src={meta.logoUrl}
          alt={meta.label}
          className="w-3.5 h-3.5 object-contain"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <span className={cn("w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-bold text-white", meta.color)}>
          {meta.label.charAt(0)}
        </span>
      )}
      <span>{meta.label}</span>
    </button>
  );
}

export function WatchBar({ filters, onApply }: WatchBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const { providers, moods, runtimeMin, runtimeMax } = filters;

  function toggleProvider(p: string) {
    const next = providers.includes(p)
      ? providers.filter((x) => x !== p)
      : [...providers, p];
    onApply({ ...filters, providers: next });
  }

  function removeRuntimeFilter() {
    onApply({ ...filters, runtimeMin: null, runtimeMax: null });
  }

  function removeMood(mood: string) {
    onApply({ ...filters, moods: moods.filter((m) => m !== mood) });
  }

  function applyQuickPreset(preset: typeof RUNTIME_QUICK_PRESETS[number]) {
    onApply({ ...filters, runtimeMin: preset.min ?? null, runtimeMax: preset.max ?? null });
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }

  function scrollBy(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  }

  const hasRuntimeFilter = runtimeMin !== null || runtimeMax !== null;
  const runtimeLabel = hasRuntimeFilter
    ? runtimeMin === null && runtimeMax === 30
      ? "< 30m"
      : runtimeMin === 30 && runtimeMax === 90
      ? "30–90m"
      : runtimeMin === 90 && runtimeMax === null
      ? "90m+"
      : "Custom"
    : null;

  const hasActiveChips = hasRuntimeFilter || moods.length > 0;

  return (
    <div className="space-y-2">
      {/* Provider pills row with scroll fade + arrows */}
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy("left")}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-0.5 pr-2 bg-gradient-to-r from-background to-transparent"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy("right")}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-0.5 pl-2 bg-gradient-to-l from-background to-transparent"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-1.5 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {WATCHBAR_PROVIDERS.map((p) => (
            <ProviderPill
              key={p}
              provider={p}
              active={providers.includes(p)}
              onClick={() => toggleProvider(p)}
            />
          ))}
        </div>
      </div>

      {/* Quick runtime presets */}
      <div className="flex gap-1.5 px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {RUNTIME_QUICK_PRESETS.map((preset) => {
          const isActive =
            filters.runtimeMin === (preset.min ?? null) &&
            filters.runtimeMax === (preset.max ?? null);
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => isActive ? removeRuntimeFilter() : applyQuickPreset(preset)}
              aria-pressed={isActive}
              className={cn(
                "flex-shrink-0 px-3 h-7 rounded-full border text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 bg-card"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Active filter chips */}
      {hasActiveChips && (
        <div className="flex flex-wrap gap-1.5 px-4 sm:px-6 lg:px-8">
          {runtimeLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-medium">
              {runtimeLabel}
              <button
                type="button"
                onClick={removeRuntimeFilter}
                aria-label={`Remove ${runtimeLabel} filter`}
                className="hover:text-primary/60 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {moods.map((mood) => (
            <span
              key={mood}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-medium capitalize"
            >
              {mood}
              <button
                type="button"
                onClick={() => removeMood(mood)}
                aria-label={`Remove ${mood} filter`}
                className="hover:text-violet-300 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
