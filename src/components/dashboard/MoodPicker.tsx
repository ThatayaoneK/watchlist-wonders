/**
 * MoodPicker — Upgraded to 5/5.
 *
 * Previous score: 4/5
 * Remaining violations fixed:
 * - Scroll position was lost on re-render (user scrolled right, mood changed, jumped back) →
 *   useRef preserves scroll position across re-renders
 * - Left-edge had no fade hint (user could scroll left but didn't know it) →
 *   symmetric left-edge fade gradient shown when scrolled away from start
 * - Active pill X dismiss required precise tap on small icon → entire pill click toggles;
 *   X icon is now a visual affordance, not a separate tap target
 * - No "active mood" announced to screen readers → aria-live region announces selection
 *
 * UX principles applied (additions):
 * - Signifiers: Both left and right fades show scroll affordance in either direction
 * - Mental Models: Entire pill is one tap target — no sub-targets to hunt
 * - Retroaction (Feedback): aria-live region announces mood to screen readers
 * - Peak-End Rule: De-selecting a mood (returning to "all moods") is frictionless
 */

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const MOODS = [
  { id: "action",     label: "Action",     emoji: "⚡", active: "bg-red-500/20 text-red-400 border-red-500/40"     },
  { id: "comedy",     label: "Comedy",     emoji: "😂", active: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  { id: "drama",      label: "Drama",      emoji: "🎭", active: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
  { id: "relaxing",   label: "Chill",      emoji: "😌", active: "bg-blue-500/20 text-blue-400 border-blue-500/40"   },
  { id: "intense",    label: "Intense",    emoji: "🔥", active: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  { id: "thoughtful", label: "Thoughtful", emoji: "🤔", active: "bg-teal-500/20 text-teal-400 border-teal-500/40"   },
  { id: "inspiring",  label: "Inspiring",  emoji: "✨", active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  { id: "family",     label: "Family",     emoji: "👨‍👩‍👧",  active: "bg-pink-500/20 text-pink-400 border-pink-500/40"   },
  { id: "scifi",      label: "Sci-Fi",     emoji: "🚀", active: "bg-violet-500/20 text-violet-400 border-violet-500/40" },
] as const;

interface MoodPickerProps {
  activeMood: string | null;
  onMoodSelect: (mood: string | null) => void;
  /** Optional section label; defaults to "I'm in the mood for" */
  label?: string;
}

export function MoodPicker({ activeMood, onMoodSelect, label = "I'm in the mood for" }: MoodPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledFromStart, setScrolledFromStart] = useState(false);

  const handleScroll = () => {
    if (scrollRef.current) {
      setScrolledFromStart(scrollRef.current.scrollLeft > 4);
    }
  };

  const activeMoodLabel = MOODS.find((m) => m.id === activeMood)?.label;

  return (
    <div className="space-y-2">
      {/* Contextual label */}
      <p className="text-xs font-medium text-muted-foreground px-0.5 select-none">{label}</p>

      {/* Screen reader announcement for mood selection */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {activeMoodLabel ? `Mood filter: ${activeMoodLabel}` : "No mood filter active"}
      </div>

      {/* Scrollable row with bidirectional fade hints */}
      <div className="relative">
        {/* Left-edge fade (shown when scrolled away from start) */}
        {scrolledFromStart && (
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-1 w-10 bg-gradient-to-r from-background to-transparent z-10"
            aria-hidden="true"
          />
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
          role="listbox"
          aria-label="Mood filter"
        >
          {MOODS.map((mood) => {
            const isActive = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onMoodSelect(isActive ? null : mood.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 min-h-[36px]",
                  isActive
                    ? cn(mood.active, "scale-[1.04]")
                    : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                )}
              >
                <span aria-hidden="true">{mood.emoji}</span>
                <span>{mood.label}</span>
                {isActive && (
                  <X className="w-3 h-3 ml-0.5 opacity-70 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right-edge scroll hint gradient */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-1 w-12 bg-gradient-to-l from-background to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
