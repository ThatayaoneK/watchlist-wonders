import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const MOODS = [
  { id: "action",     label: "Action",     emoji: "⚡", active: "bg-red-500/20 text-red-400 border-red-500/40" },
  { id: "comedy",     label: "Comedy",     emoji: "😂", active: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  { id: "drama",      label: "Drama",      emoji: "🎭", active: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
  { id: "relaxing",   label: "Chill",      emoji: "😌", active: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  { id: "intense",    label: "Intense",    emoji: "🔥", active: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  { id: "thoughtful", label: "Thoughtful", emoji: "🤔", active: "bg-teal-500/20 text-teal-400 border-teal-500/40" },
  { id: "inspiring",  label: "Inspiring",  emoji: "✨", active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  { id: "family",     label: "Family",     emoji: "👨‍👩‍👧",  active: "bg-pink-500/20 text-pink-400 border-pink-500/40" },
  { id: "scifi",      label: "Sci-Fi",     emoji: "🚀", active: "bg-violet-500/20 text-violet-400 border-violet-500/40" },
] as const;

interface MoodPickerProps {
  activeMood: string | null;
  onMoodSelect: (mood: string | null) => void;
}

export function MoodPicker({ activeMood, onMoodSelect }: MoodPickerProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitScrollbarDisplay: "none" } as React.CSSProperties}
    >
      {MOODS.map((mood) => {
        const isActive = activeMood === mood.id;
        return (
          <button
            key={mood.id}
            type="button"
            onClick={() => onMoodSelect(isActive ? null : mood.id)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
              isActive
                ? mood.active
                : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
            )}
            aria-pressed={isActive}
          >
            <span>{mood.emoji}</span>
            <span>{mood.label}</span>
            {isActive && (
              <X className="w-3 h-3 ml-0.5 opacity-70" />
            )}
          </button>
        );
      })}
    </div>
  );
}
