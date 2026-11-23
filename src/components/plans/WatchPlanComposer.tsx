import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Shuffle, Clock, Loader2, Search, ChevronLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { watchPlanService } from "@/services/watchPlans";
import { useToast } from "@/hooks/use-toast";
import { getSafeErrorMessage } from "@/lib/errorMessage";
import { useWatchPlanBuilder, type VibeType, type BuilderItem } from "@/hooks/useWatchPlanBuilder";
import type { Bookmark } from "@/types/database";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes === 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatRuntime(minutes: number | null): string {
  if (!minutes) return "";
  return formatDuration(minutes);
}

function startTimeLabel(t: string): string {
  if (t === "now") {
    const now = new Date();
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
  return t;
}

function timeToHHMM(t: string): string {
  if (t === "now") {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
  return t;
}

// ─── vibes config ────────────────────────────────────────────────────────────

const VIBES: { id: VibeType; emoji: string; label: string; desc: string }[] = [
  { id: "movie-night", emoji: "🎬", label: "Movie Night", desc: "2–3 films from your list" },
  { id: "binge-series", emoji: "📺", label: "Binge Series", desc: "Series episodes in a row" },
  { id: "quick-watch", emoji: "⚡", label: "Quick Watch", desc: "Short clips under an hour" },
  { id: "surprise-me", emoji: "🎲", label: "Surprise Me", desc: "Random picks from backlog" },
  { id: "custom", emoji: "✨", label: "Custom", desc: "Build from scratch" },
];

const START_TIMES = [
  { label: "Now", value: "now" },
  { label: "8 PM", value: "20:00" },
  { label: "9 PM", value: "21:00" },
  { label: "10 PM", value: "22:00" },
];

// ─── sub-components ──────────────────────────────────────────────────────────

function VibeCard({
  vibe,
  onClick,
}: {
  vibe: (typeof VIBES)[number];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-1.5 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-primary/5 transition-all text-left active:scale-[0.98]"
    >
      <span className="text-2xl">{vibe.emoji}</span>
      <p className="font-semibold text-sm text-foreground">{vibe.label}</p>
      <p className="text-xs text-muted-foreground leading-snug">{vibe.desc}</p>
    </button>
  );
}

function PlanItem({
  item,
  index,
  onRemove,
}: {
  item: BuilderItem;
  index: number;
  onRemove: () => void;
}) {
  const runtime = formatRuntime(item.runtime_minutes);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
      <span className="text-xs text-muted-foreground w-4 text-center shrink-0">{index + 1}</span>

      {item.poster_url ? (
        <img
          src={item.poster_url}
          alt={item.title}
          className="w-8 h-12 object-cover rounded shrink-0"
        />
      ) : (
        <div className="w-8 h-12 bg-secondary rounded shrink-0 flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">
          {item.type.charAt(0)}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {item.type}
          {runtime && ` · ${runtime}`}
        </p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 rounded shrink-0"
        aria-label={`Remove ${item.title}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── main composer ────────────────────────────────────────────────────────────

interface WatchPlanComposerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allBookmarks: Bookmark[];
}

export function WatchPlanComposer({ open, onOpenChange, allBookmarks }: WatchPlanComposerProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [vibe, setVibe] = useState<VibeType>("movie-night");
  const [selectedTime, setSelectedTime] = useState("20:00");
  const [customTimeInput, setCustomTimeInput] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const builder = useWatchPlanBuilder(allBookmarks);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Bookmarks not yet in builder
  const usedIds = useMemo(() => new Set(builder.items.map((i) => i.id)), [builder.items]);
  const availableToAdd = useMemo(
    () =>
      allBookmarks.filter(
        (b) =>
          !usedIds.has(b.id) &&
          (addSearch.trim() === "" || b.title.toLowerCase().includes(addSearch.toLowerCase()))
      ),
    [allBookmarks, usedIds, addSearch]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const plan = await watchPlanService.createWatchPlan({
        name: builder.name,
        description: null,
        preferred_days: [],
        time_windows: [{ start: timeToHHMM(selectedTime), end: "23:59" }],
        max_runtime_minutes: null,
        mood_tags: [],
        platforms_allowed: [],
        auto_suggest: true,
      });
      // Add items in order
      try {
        for (let i = 0; i < builder.items.length; i++) {
          await watchPlanService.addBookmarkToPlan(plan.id, builder.items[i].id, i);
        }
      } catch (error) {
        // Rollback: delete the plan if adding items fails
        try {
          await watchPlanService.deleteWatchPlan(plan.id);
        } catch (deleteError) {
          console.error('[WatchPlanComposer] Failed to rollback plan deletion', deleteError);
        }
        throw error;
      }
      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watch-plans"] });
      toast({ title: "Plan saved!", description: `"${builder.name}" is ready.` });
      handleClose();
    },
    onError: (err: unknown) => {
      toast({
        title: "Error saving plan",
        description: getSafeErrorMessage(err, "Something went wrong."),
        variant: "destructive",
      });
    },
  });

  function handleClose() {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep(0);
      setAddOpen(false);
      setAddSearch("");
      setSelectedTime("20:00");
      setCustomTimeInput(false);
      builder.reset();
    }, 300);
  }

  function handleVibeSelect(v: VibeType) {
    setVibe(v);
    builder.load(v);
    setStep(1);
  }

  // ── step 0: vibe picker ──────────────────────────────────────────────────
  const vibeStep = (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <DialogTitle className="text-xl font-bold text-foreground">What's the vibe?</DialogTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a session type — we'll build it instantly from your saved list.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-2 gap-3">
          {VIBES.map((v) => (
            <VibeCard key={v.id} vibe={v} onClick={() => handleVibeSelect(v.id)} />
          ))}
        </div>
      </div>
    </div>
  );

  // ── step 1: builder ──────────────────────────────────────────────────────
  const builderStep = (
    <div className="flex flex-col h-full">
      {/* Header: back + live stats */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(0)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary"
          aria-label="Back to vibe picker"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <DialogTitle className="text-base font-semibold text-foreground truncate">
            {builder.name}
          </DialogTitle>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Total</p>
          <p
            className={cn(
              "text-sm font-semibold tabular-nums transition-colors",
              builder.totalMinutes > 240 ? "text-amber-500" : "text-foreground"
            )}
          >
            {formatDuration(builder.totalMinutes)}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {builder.items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {vibe === "custom"
              ? "Start adding items below."
              : "No matching items in your backlog. Add something or shuffle."}
          </div>
        )}

        {builder.items.map((item, i) => (
          <PlanItem
            key={item.id}
            item={item}
            index={i}
            onRemove={() => builder.removeItem(item.id)}
          />
        ))}

        {/* Add item row */}
        {addOpen ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="relative p-2 border-b border-border">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search your list..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-8 h-8 text-sm border-0 bg-transparent focus-visible:ring-0"
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {availableToAdd.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {addSearch ? "No matches" : "All items already added"}
                </p>
              ) : (
                availableToAdd.slice(0, 15).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      builder.addItem(b);
                      setAddOpen(false);
                      setAddSearch("");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-secondary text-left transition-colors"
                  >
                    {b.poster_url ? (
                      <img
                        src={b.poster_url}
                        alt={b.title}
                        className="w-6 h-9 object-cover rounded shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-9 bg-secondary rounded shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {b.type}
                        {b.runtime_minutes ? ` · ${formatRuntime(b.runtime_minutes)}` : ""}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-2 border-t border-border">
              <button
                type="button"
                onClick={() => { setAddOpen(false); setAddSearch(""); }}
                className="text-xs text-muted-foreground hover:text-foreground w-full text-center py-1 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full border border-dashed border-border rounded-xl p-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add something
          </button>
        )}

        {/* Long session warning */}
        {builder.totalMinutes > 240 && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-600">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>This is a long session. Consider removing something.</span>
          </div>
        )}
      </div>

      {/* Controls: start time + actions */}
      <div className="px-4 py-4 border-t border-border space-y-3">
        {/* Start time */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Start time</p>
          {customTimeInput ? (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="flex-1 h-8 text-sm"
              />
              <button
                type="button"
                onClick={() => setCustomTimeInput(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              {START_TIMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setSelectedTime(t.value);
                    setCustomTimeInput(false);
                  }}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    selectedTime === t.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
              {(() => {
                const isCustomSelected = !START_TIMES.some((p) => p.value === selectedTime);
                return (
                  <button
                    type="button"
                    onClick={() => setCustomTimeInput(true)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      customTimeInput || isCustomSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Custom
                  </button>
                );
              })()}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {vibe !== "custom" && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => builder.shuffle(vibe)}
            >
              <Shuffle className="w-4 h-4 mr-1.5" />
              Shuffle
            </Button>
          )}
          <Button
            type="button"
            className="flex-1"
            disabled={builder.items.length === 0}
            onClick={() => setStep(2)}
          >
            Looks good
          </Button>
        </div>
      </div>
    </div>
  );

  // ── step 2: confirm ──────────────────────────────────────────────────────
  const itemTypeLabel = () => {
    const movies = builder.items.filter((i) => i.type === "movie").length;
    const series = builder.items.filter((i) => i.type === "series" || i.type === "episode").length;
    const total = builder.items.length;
    if (movies === total) return `${total} movie${total !== 1 ? "s" : ""}`;
    if (series === total) return `${total} episode${total !== 1 ? "s" : ""}`;
    return `${total} item${total !== 1 ? "s" : ""}`;
  };

  const confirmStep = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary"
          aria-label="Back to builder"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <DialogTitle className="text-base font-semibold text-foreground">
          Confirm plan
        </DialogTitle>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center text-center">
        <p className="text-5xl mb-4">🍿</p>
        <h2 className="text-xl font-bold text-foreground mb-1">You're all set</h2>
        <p className="text-sm text-muted-foreground mb-8">
          {itemTypeLabel()} · {formatDuration(builder.totalMinutes)} · Starts{" "}
          {startTimeLabel(selectedTime)}
        </p>

        {/* Editable name */}
        <div className="w-full max-w-xs mb-8">
          <Input
            value={builder.name}
            onChange={(e) => builder.setName(e.target.value)}
            className="text-center text-base font-semibold bg-transparent border-0 border-b rounded-none focus-visible:ring-0 focus-visible:border-primary"
            placeholder="Plan name"
            aria-label="Plan name"
          />
          <p className="text-xs text-muted-foreground mt-1">Tap to rename</p>
        </div>

        {/* Item preview strip */}
        <div className="w-full space-y-1.5 mb-8 text-left">
          {builder.items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 py-1">
              <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
              {item.poster_url ? (
                <img
                  src={item.poster_url}
                  alt={item.title}
                  className="w-6 h-9 object-cover rounded shrink-0"
                />
              ) : (
                <div className="w-6 h-9 bg-secondary rounded shrink-0" />
              )}
              <p className="text-sm text-foreground truncate flex-1">{item.title}</p>
              {item.runtime_minutes && (
                <p className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {formatRuntime(item.runtime_minutes)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border space-y-2">
        <Button
          className="w-full"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save plan
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => setStep(1)}
        >
          Keep editing
        </Button>
      </div>
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden h-[85vh] max-h-[680px] flex flex-col [&>button:last-child]:hidden">
        {step === 0 && vibeStep}
        {step === 1 && builderStep}
        {step === 2 && confirmStep}
      </DialogContent>
    </Dialog>
  );
}
