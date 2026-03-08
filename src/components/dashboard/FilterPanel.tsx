import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, getMoodEmoji } from "@/lib/utils";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

const PROVIDERS = ["youtube", "imdb", "netflix", "instagram", "facebook", "x", "generic"] as const;

const MOOD_OPTIONS = [
  "action", "comedy", "drama", "horror", "romance", "thriller",
  "documentary", "scifi", "fantasy", "animation", "family",
  "relaxing", "inspiring", "intense", "thoughtful", "nostalgic",
  "uplifting", "dark", "quirky", "epic", "emotional", "fun", "educational",
];

export interface AdvancedFilters {
  providers: string[];
  moods: string[];
  runtimeMin: number | null;
  runtimeMax: number | null;
}

interface FilterPanelProps {
  onApply: (filters: AdvancedFilters) => void;
  onReset: () => void;
  className?: string;
}

export function FilterPanel({ onApply, onReset, className }: FilterPanelProps) {
  const [providers, setProviders] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [runtimeMin, setRuntimeMin] = useState("");
  const [runtimeMax, setRuntimeMax] = useState("");

  const toggleProvider = (p: string) =>
    setProviders((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const toggleMood = (m: string) =>
    setMoods((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const handleApply = () => {
    const parsedMin = runtimeMin.trim() ? parseInt(runtimeMin.trim(), 10) : null;
    const parsedMax = runtimeMax.trim() ? parseInt(runtimeMax.trim(), 10) : null;
    let finalMin = parsedMin !== null && Number.isFinite(parsedMin) && parsedMin >= 0 ? parsedMin : null;
    let finalMax = parsedMax !== null && Number.isFinite(parsedMax) && parsedMax >= 0 ? parsedMax : null;
    if (finalMin !== null && finalMax !== null && finalMin > finalMax) {
      [finalMin, finalMax] = [finalMax, finalMin];
    }
    onApply({ providers, moods, runtimeMin: finalMin, runtimeMax: finalMax });
  };

  const handleReset = () => {
    setProviders([]);
    setMoods([]);
    setRuntimeMin("");
    setRuntimeMax("");
    onReset();
  };

  const activeCount = providers.length + moods.length + (runtimeMin ? 1 : 0) + (runtimeMax ? 1 : 0);

  return (
    <div className={cn("container mx-auto px-4 lg:px-8", className)}>
      <div className="bg-card border border-border rounded-xl p-5 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SlidersHorizontal className="w-4 h-4" />
            Advanced Filters
            {activeCount > 0 && (
              <Badge variant="default" className="text-xs">
                {activeCount} active
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground h-7 gap-1">
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        </div>

        {/* Provider */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Provider</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <label
                key={p}
                className={cn(
                  "flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-md text-sm border transition-colors select-none",
                  providers.includes(p)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Checkbox
                  checked={providers.includes(p)}
                  onCheckedChange={() => toggleProvider(p)}
                  className="sr-only"
                />
                <span className="capitalize">{p}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Mood */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Mood</Label>
          <div className="flex flex-wrap gap-1.5">
            {MOOD_OPTIONS.map((mood) => (
              <Badge
                key={mood}
                variant={moods.includes(mood) ? "default" : "outline"}
                className="cursor-pointer select-none text-xs"
                onClick={() => toggleMood(mood)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleMood(mood);
                  }
                }}
              >
                {getMoodEmoji(mood)} {mood}
              </Badge>
            ))}
          </div>
        </div>

        {/* Runtime Range */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Runtime (minutes)</Label>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="rt-min" className="text-xs">Min</Label>
              <Input
                id="rt-min"
                type="number"
                placeholder="e.g. 20"
                value={runtimeMin}
                onChange={(e) => setRuntimeMin(e.target.value)}
                min={0}
              />
            </div>
            <span className="text-muted-foreground mt-5">–</span>
            <div className="flex-1 space-y-1">
              <Label htmlFor="rt-max" className="text-xs">Max</Label>
              <Input
                id="rt-max"
                type="number"
                placeholder="e.g. 120"
                value={runtimeMax}
                onChange={(e) => setRuntimeMax(e.target.value)}
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={handleApply}>Apply Filters</Button>
        </div>
      </div>
    </div>
  );
}
