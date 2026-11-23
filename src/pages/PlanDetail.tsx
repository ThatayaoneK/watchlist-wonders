import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableBookmarkRow } from "@/components/plans/SortableBookmarkRow";
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { watchPlanService } from "@/services/watchPlans";
import { bookmarkService } from "@/services/bookmarks";
import { cn, getMoodEmoji } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [removingBookmarkId, setRemovingBookmarkId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["plan", id],
    queryFn: () => watchPlanService.getWatchPlan(id!),
    enabled: !!id,
  });

  const { data: planBookmarks = [], isLoading: booksLoading } = useQuery({
    queryKey: ["plan-bookmarks", id],
    queryFn: () => watchPlanService.getPlanBookmarks(id!),
    enabled: !!id,
  });

  const { data: allBookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  // Bookmarks not yet in this plan
  const planBookmarkIds = useMemo(
    () => new Set(planBookmarks.map((pb) => pb.bookmark_id)),
    [planBookmarks]
  );

  const availableBookmarks = useMemo(
    () =>
      allBookmarks.filter(
        (b) =>
          !planBookmarkIds.has(b.id) &&
          (search.trim() === "" ||
            b.title.toLowerCase().includes(search.toLowerCase()))
      ),
    [allBookmarks, planBookmarkIds, search]
  );

  const removeMutation = useMutation({
    mutationFn: (bookmarkId: string) =>
      watchPlanService.removeBookmarkFromPlan(id!, bookmarkId),
    onSuccess: () => {
      setRemovingBookmarkId(null);
      queryClient.invalidateQueries({ queryKey: ["plan-bookmarks", id] });
      toast({ title: "Removed from plan" });
    },
    onError: () => {
      setRemovingBookmarkId(null);
      toast({ title: "Failed to remove bookmark", variant: "destructive" });
    },
  });

  const addMutation = useMutation({
    mutationFn: (bookmarkId: string) =>
      watchPlanService.addBookmarkToPlan(id!, bookmarkId, planBookmarks.length),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-bookmarks", id] });
      setAddOpen(false);
      setSearch("");
      toast({ title: "Added to plan!" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (newIds: string[]) =>
      watchPlanService.reorderPlanBookmarks(id!, newIds),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-bookmarks", id] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = [...planBookmarks];
    const oldIndex = items.findIndex((pb) => pb.bookmark_id === active.id);
    const newIndex = items.findIndex((pb) => pb.bookmark_id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    queryClient.setQueryData(["plan-bookmarks", id], reordered);
    reorderMutation.mutate(reordered.map((pb) => pb.bookmark_id));
  };

  if (planLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center pt-32">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Plan not found</p>
            <p className="text-sm text-muted-foreground">This plan may have been removed or doesn't exist.</p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/plans">Back to Plans</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 pt-32 pb-16 max-w-3xl">
        {/* Back link */}
        <Link
          to="/plans"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Plans
        </Link>

        {/* Plan Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {plan.name}
          </h1>
          {plan.description && (
            <p className="text-muted-foreground mb-4">{plan.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {/* Preferred Days */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
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
            {plan.time_windows?.length > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>
                  {plan.time_windows.map((tw) => `${tw.start}–${tw.end}`).join(", ")}
                </span>
              </div>
            )}

            {/* Max runtime */}
            {plan.max_runtime_minutes && (
              <span>Max {plan.max_runtime_minutes} min</span>
            )}
          </div>

          {/* Mood Tags */}
          {plan.mood_tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {plan.mood_tags.map((mood) => (
                <Badge key={mood} variant="outline" className="text-xs">
                  {getMoodEmoji(mood)} {mood}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Bookmarks List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Bookmarks{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({planBookmarks.length})
              </span>
            </h2>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Bookmark
            </Button>
          </div>

          {booksLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : planBookmarks.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground mb-3">No bookmarks in this plan yet</p>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add your first bookmark
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={planBookmarks.map((pb) => pb.bookmark_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {planBookmarks.map((pb, index) => (
                    <SortableBookmarkRow
                      key={pb.bookmark_id}
                      bookmarkId={pb.bookmark_id}
                      position={index + 1}
                      title={pb.bookmarks?.title}
                      posterUrl={pb.bookmarks?.poster_url}
                      type={pb.bookmarks?.type}
                      runtimeMinutes={pb.bookmarks?.runtime_minutes}
                      status={pb.bookmarks?.status}
                      onRemove={() => { setRemovingBookmarkId(pb.bookmark_id); removeMutation.mutate(pb.bookmark_id); }}
                      isRemoving={removingBookmarkId === pb.bookmark_id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Add Bookmark Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Bookmark to Plan</DialogTitle>
            <DialogDescription>
              Search and select a bookmark to add to "{plan.name}".
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search bookmarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="overflow-y-auto flex-1 mt-3 space-y-1">
            {availableBookmarks.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                {search ? "No matching bookmarks" : "All bookmarks are already in this plan"}
              </p>
            ) : (
              availableBookmarks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary text-left transition-colors"
                  onClick={() => addMutation.mutate(b.id)}
                  disabled={addMutation.isPending}
                >
                  {b.poster_url ? (
                    <img src={b.poster_url} alt={b.title} className="w-8 h-12 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-8 h-12 bg-secondary rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{b.type} · {b.status}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
