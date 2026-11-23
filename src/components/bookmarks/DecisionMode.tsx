import { useState, useEffect, useMemo } from "react";
import { X, Play, Shuffle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { bookmarkService } from "@/services/bookmarks";
import {
  buildDecisionCandidates,
  deriveDecisionSeedFromIntent,
  getNextDecisionIndex,
  type DecisionIntent,
  type DecisionMood,
  type DecisionTime,
} from "@/lib/decisionMode";
import { cn, formatRuntime } from "@/lib/utils";
import type { Bookmark } from "@/types/database";

interface DecisionModeProps {
  open: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  initialIntent?: DecisionIntent;
  initialMood?: DecisionMood;
  initialTime?: DecisionTime;
}

const MOOD_OPTIONS: { id: Exclude<DecisionMood, null>; label: string }[] = [
  { id: "action", label: "Action" },
  { id: "chill", label: "Chill" },
  { id: "intense", label: "Intense" },
];

const TIME_OPTIONS: { id: Exclude<DecisionTime, null>; label: string }[] = [
  { id: "quick", label: "Quick" },
  { id: "deep", label: "Deep" },
];

export function DecisionMode({
  open,
  onClose,
  bookmarks,
  initialIntent = null,
  initialMood,
  initialTime,
}: DecisionModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedMood, setSelectedMood] = useState<DecisionMood>(null);
  const [selectedTime, setSelectedTime] = useState<DecisionTime>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const candidates = useMemo(() => {
    return buildDecisionCandidates(bookmarks, {
      intent: initialIntent,
      mood: selectedMood,
      time: selectedTime,
    });
  }, [bookmarks, initialIntent, selectedMood, selectedTime]);

  useEffect(() => {
    if (!open) return;
    const seed = deriveDecisionSeedFromIntent(initialIntent);
    setSelectedMood(initialMood ?? seed.mood);
    setSelectedTime(initialTime ?? seed.time);
    setCurrentIndex(0);
  }, [open, initialIntent, initialMood, initialTime]);

  const setWatchingMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, "watching"),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      const prev = queryClient.getQueryData<Bookmark[]>(["bookmarks"]);
      queryClient.setQueryData<Bookmark[]>(["bookmarks"], (old = []) =>
        old.map((b) => (b.id === id ? { ...b, status: "watching" } : b)),
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["bookmarks"], ctx?.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const handlePlay = () => {
    const item = candidates[currentIndex];
    if (!item) return;
    if (item.source_url?.startsWith("http")) {
      window.open(item.source_url, "_blank", "noopener,noreferrer");
    }
    setWatchingMutation.mutate(item.id);
    onClose();
  };

  const handleSwap = () => {
    if (candidates.length <= 1) return;
    const next = getNextDecisionIndex(currentIndex, candidates.length);
    if (next === 0 && currentIndex === candidates.length - 1) {
      toast({ description: "Back to the top" });
    }
    setCurrentIndex(next);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        handlePlay();
      } else if (e.key === "ArrowRight" || e.key === "n") {
        handleSwap();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, candidates, currentIndex]);

  const item = candidates[currentIndex];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="fixed inset-0 z-50 max-w-none w-screen h-screen m-0 p-0 rounded-none border-0 bg-background/95 backdrop-blur-sm flex flex-col translate-x-0 translate-y-0 top-0 left-0">
        <div className="flex items-center justify-between p-4 shrink-0">
          <span className="text-sm text-muted-foreground">
            {candidates.length === 0
              ? "Pick for me"
              : `Pick for me - ${currentIndex + 1} of ${candidates.length}`}
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9" aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-6 pb-3 space-y-3">
          <p className="text-sm font-medium text-foreground">What do you feel like?</p>
          <div className="flex flex-wrap items-center gap-2">
            {MOOD_OPTIONS.map((mood) => (
              <button
                key={mood.id}
                type="button"
                onClick={() => {
                  setCurrentIndex(0);
                  setSelectedMood((prev) => (prev === mood.id ? null : mood.id));
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedMood === mood.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={selectedMood === mood.id}
              >
                {mood.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {TIME_OPTIONS.map((time) => (
              <button
                key={time.id}
                type="button"
                onClick={() => {
                  setCurrentIndex(0);
                  setSelectedTime((prev) => (prev === time.id ? null : time.id));
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedTime === time.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={selectedTime === time.id}
              >
                {time.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
          {candidates.length === 0 ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">No matches right now. Try changing mood or time.</p>
              <Button asChild onClick={onClose}>
                <Link to="/new">Add something to watch</Link>
              </Button>
            </div>
          ) : (
            <div className="w-full max-w-sm space-y-6 animate-fade-in" key={item?.id}>
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-wm-surface shadow-2xl mx-auto max-h-[45vh]">
                {item?.poster_url || item?.backdrop_url ? (
                  <img
                    src={item?.poster_url || item?.backdrop_url || ""}
                    alt={item?.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl font-bold text-muted-foreground">
                      {item?.title?.trim().charAt(0) || "?"}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1 text-center">
                <h2 className="text-xl font-bold">{item?.title}</h2>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="capitalize">{item?.type}</Badge>
                  {item?.runtime_minutes && <span>{formatRuntime(item.runtime_minutes)}</span>}
                  {item?.release_year && <span>{item.release_year}</span>}
                </div>
                {(item?.mood_tags || []).length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 pt-1">
                    {(item?.mood_tags || []).slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs capitalize">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {candidates.length > 0 && (
          <div className="p-6 flex flex-col gap-3 max-w-sm mx-auto w-full shrink-0">
            <Button size="lg" className="w-full h-14 text-base" onClick={handlePlay}>
              <Play className="mr-2 w-5 h-5 fill-current" />
              Play
            </Button>
            {candidates.length > 1 && (
              <Button variant="outline" size="lg" className="w-full h-12" onClick={handleSwap}>
                <Shuffle className="mr-2 w-4 h-4" />
                Try another
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
