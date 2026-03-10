import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Clock, ChevronRight, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopNav } from "@/components/layout/TopNav";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { cn, getMoodEmoji } from "@/lib/utils";
import { watchPlanService } from "@/services/watchPlans";
import { bookmarkService } from "@/services/bookmarks";
import { useToast } from "@/hooks/use-toast";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MOOD_OPTIONS = [
  "action", "comedy", "drama", "horror", "romance", "thriller",
  "documentary", "scifi", "fantasy", "relaxing", "inspiring", 
  "intense", "thoughtful", "uplifting", "dark", "fun", "educational"
];

const Plans = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSearchOpen, openSearch, closeSearch } = useSearchShortcut();
  const [createOpen, setCreateOpen] = useState(false);
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDays, setPreferredDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("23:00");
  const [maxRuntime, setMaxRuntime] = useState<string>("");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ['watch-plans'],
    queryFn: () => watchPlanService.getWatchPlans(),
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const createMutation = useMutation({
    mutationFn: () => watchPlanService.createWatchPlan({
      name,
      description: description || null,
      preferred_days: preferredDays,
      time_windows: [{ start: startTime, end: endTime }],
      max_runtime_minutes: maxRuntime ? parseInt(maxRuntime) : null,
      mood_tags: selectedMoods,
      platforms_allowed: [],
      auto_suggest: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watch-plans'] });
      setCreateOpen(false);
      resetForm();
      toast({
        title: "Plan created!",
        description: `"${name}" has been added to your watch plans.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating plan",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => watchPlanService.deleteWatchPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watch-plans'] });
      toast({
        title: "Plan deleted",
        description: "Watch plan has been removed.",
      });
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setPreferredDays([]);
    setStartTime("19:00");
    setEndTime("23:00");
    setMaxRuntime("");
    setSelectedMoods([]);
  };

  const toggleDay = (dayIndex: number) => {
    setPreferredDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const toggleMood = (mood: string) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this watch plan.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav onSearchClick={openSearch} />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <SearchOverlay isOpen={isSearchOpen} onClose={closeSearch} bookmarks={[]} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav onSearchClick={openSearch} />

      <div className="container mx-auto px-4 lg:px-8 pt-20 pb-24 md:pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Watch Plans</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Create custom viewing schedules tailored to your preferences
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="hidden sm:flex">
            <Plus className="w-4 h-4 mr-2" />
            New Plan
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="icon" className="sm:hidden">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No plans yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first watch plan to get personalized suggestions
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Plan
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Link
                to={`/plans/${plan.id}`}
                key={plan.id}
                className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors block"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {plan.name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault();
                      deleteMutation.mutate(plan.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {plan.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {plan.description}
                  </p>
                )}

                {/* Preferred Days */}
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div className="flex gap-1">
                    {DAYS.map((day, i) => (
                      <span
                        key={day}
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          plan.preferred_days?.includes(i)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {day.charAt(0)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Time Windows */}
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {plan.time_windows?.map((tw: any) => `${tw.start}-${tw.end}`).join(", ") || "Any time"}
                  </span>
                </div>

                {/* Runtime Limit */}
                {plan.max_runtime_minutes && (
                  <div className="text-sm text-muted-foreground mb-3">
                    Max {plan.max_runtime_minutes} min
                  </div>
                )}

                {/* Mood Tags */}
                {plan.mood_tags && plan.mood_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {plan.mood_tags.slice(0, 4).map((mood) => (
                      <Badge key={mood} variant="outline" className="text-xs">
                        {getMoodEmoji(mood)} {mood}
                      </Badge>
                    ))}
                    {plan.mood_tags.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{plan.mood_tags.length - 4}
                      </Badge>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Plan Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Watch Plan</DialogTitle>
            <DialogDescription>
              Set up a custom viewing schedule for specific days and moods.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="plan-name">Plan Name *</Label>
              <Input
                id="plan-name"
                placeholder="e.g., Weekend Binge, Lunch Break..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="plan-desc">Description</Label>
              <Textarea
                id="plan-desc"
                placeholder="What's this plan for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Preferred Days */}
            <div className="space-y-2">
              <Label>Preferred Days</Label>
              <div className="flex gap-2">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "flex-1 py-2 rounded-md text-sm font-medium transition-colors",
                      preferredDays.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Window */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Max Runtime */}
            <div className="space-y-2">
              <Label htmlFor="max-runtime">Max Runtime (minutes)</Label>
              <Input
                id="max-runtime"
                type="number"
                placeholder="Leave empty for no limit"
                value={maxRuntime}
                onChange={(e) => setMaxRuntime(e.target.value)}
              />
            </div>

            {/* Mood Tags */}
            <div className="space-y-2">
              <Label>Mood Tags</Label>
              <div className="flex flex-wrap gap-2">
                {MOOD_OPTIONS.map((mood) => (
                  <Badge
                    key={mood}
                    variant={selectedMoods.includes(mood) ? "default" : "outline"}
                    className="cursor-pointer select-none transition-colors"
                    onClick={() => toggleMood(mood)}
                  >
                    {getMoodEmoji(mood)} {mood}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Plan"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        bookmarks={bookmarks}
      />
    </div>
  );
};

export default Plans;
