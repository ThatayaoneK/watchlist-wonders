import { useState } from "react";
import { HelpCircle, Link2, Layers, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Link2,
    color: "text-primary bg-primary/10",
    title: "Paste a link",
    detail:
      "Copy any link from TikTok, YouTube, IMDb, or anywhere. If the share sheet misses WatchMarks, copy first and open the app.",
  },
  {
    icon: Layers,
    color: "text-emerald-400 bg-emerald-400/10",
    title: "It saves to your list",
    detail:
      "Your list is organized into rows — what you're watching, what you haven't started, and picks by mood.",
  },
  {
    icon: Sparkles,
    color: "text-wm-gold bg-wm-gold/10",
    title: "We tell you what to watch",
    detail:
      "Hit 'Pick for me' and we suggest the best thing from your list based on your time and mood.",
  },
];

export function HowItWorksButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Floating trigger — kept outside <DialogTrigger> so it can be positioned freely. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 md:bottom-6 z-40",
          "flex items-center gap-1.5 px-3 py-2 rounded-full",
          "bg-wm-surface border border-border shadow-lg",
          "text-xs text-muted-foreground hover:text-foreground transition-colors",
        )}
        aria-label="How this works"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">How this works</span>
      </button>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>How WatchMarks works</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {STEPS.map(({ icon: Icon, color, title, detail }) => (
            <div key={title} className="flex gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  color,
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
