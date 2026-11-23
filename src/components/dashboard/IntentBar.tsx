import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type IntentType = "quick" | "deep" | "random" | "continue";

interface IntentBarProps {
  activeIntent: IntentType | null;
  onChange: (intent: IntentType | null) => void;
  label?: string;
}

const INTENTS: { id: IntentType; icon: string; label: string }[] = [
  { id: "quick",    icon: "⚡", label: "Quick"    },
  { id: "deep",     icon: "🎬", label: "Deep"     },
  { id: "random",   icon: "🎲", label: "Random"   },
  { id: "continue", icon: "▶",  label: "Continue" },
];

export function IntentBar({ activeIntent, onChange, label = "What do you feel like?" }: IntentBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 py-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      {INTENTS.map((intent) => (
        <button
          key={intent.id}
          type="button"
          onClick={() => onChange(activeIntent === intent.id ? null : intent.id)}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
            activeIntent === intent.id
              ? "bg-primary/20 text-primary border border-primary/50 shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
              : "bg-wm-surface text-muted-foreground border border-transparent hover:border-border"
          )}
        >
          <span aria-hidden="true">{intent.icon}</span>
          {intent.label}
        </button>
      ))}
      {activeIntent && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground ml-1 shrink-0"
          aria-label="Clear intent"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
