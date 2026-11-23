import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Clock, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getMoodEmoji } from "@/lib/utils";
import { watchPlanService } from "@/services/watchPlans";
import { bookmarkService } from "@/services/bookmarks";
import { useToast } from "@/hooks/use-toast";
import { WatchPlanComposer } from "@/components/plans/WatchPlanComposer";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const Plans = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["watch-plans"],
    queryFn: () => watchPlanService.getWatchPlans(),
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => watchPlanService.deleteWatchPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watch-plans"] });
      toast({ title: "Plan deleted" });
    },
    onError: () => {
      toast({ title: "Error deleting plan", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-[68px]">
      <div className="container mx-auto px-4 lg:px-8 pt-6 pb-24 md:pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Watch Plans</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Compose your next watch session
            </p>
          </div>
          <Button onClick={() => setComposerOpen(true)} size="sm" className="hidden sm:flex">
            <Plus className="w-4 h-4 mr-2" />
            New Plan
          </Button>
          <Button onClick={() => setComposerOpen(true)} size="icon" className="sm:hidden">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎬</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No plans yet</h2>
            <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
              Compose your first watch session — we'll build it from your saved list.
            </p>
            <Button onClick={() => setComposerOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Compose a session
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
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground/40 hover:text-destructive transition-colors"
                    aria-label={`Delete ${plan.name}`}
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
                    {plan.time_windows?.map((tw: { start: string; end: string }) => `${tw.start}–${tw.end}`).join(", ") || "Any time"}
                  </span>
                </div>

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

      <WatchPlanComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        allBookmarks={bookmarks}
      />
    </div>
  );
};

export default Plans;
