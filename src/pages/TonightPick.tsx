import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, RefreshCw, Play, Calendar, Check, X, Clock, Shuffle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatRuntime, getMoodEmoji } from "@/lib/utils";
import { bookmarkService } from "@/services/bookmarks";
import { useToast } from "@/hooks/use-toast";
import type { Bookmark } from "@/types/database";

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const TonightPick = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [picks, setPicks] = useState<Bookmark[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch backlog items under 90 minutes
  const { data: candidates = [], isLoading, error } = useQuery({
    queryKey: ['tonight-candidates'],
    queryFn: () => bookmarkService.getTonightCandidates(),
  });

  // Initialize picks when data loads
  if (candidates.length > 0 && !hasInitialized) {
    setPicks(shuffleArray(candidates).slice(0, 3));
    setHasInitialized(true);
  }

  // Mark as done mutation
  const markDoneMutation = useMutation({
    mutationFn: (id: string) => bookmarkService.updateStatus(id, 'done'),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['tonight-candidates'] });
      setPicks(prev => prev.filter((p) => p.id !== id));
      toast({
        title: "Marked as done!",
        description: "Moved to your watched list.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark as done. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRerollAll = () => {
    setPicks(shuffleArray(candidates).slice(0, 3));
  };

  const handleSwapOne = (index: number) => {
    const currentIds = new Set(picks.map((p) => p.id));
    const available = candidates.filter((b) => !currentIds.has(b.id));
    if (available.length === 0) return;
    
    const newPick = shuffleArray(available)[0];
    const newPicks = [...picks];
    newPicks[index] = newPick;
    setPicks(newPicks);
  };

  const handleWatch = (bookmark: Bookmark) => {
    if (bookmark.source_url) {
      window.open(bookmark.source_url, "_blank");
    }
  };

  const handleMarkDone = (bookmark: Bookmark) => {
    markDoneMutation.mutate(bookmark.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Finding your picks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading picks</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Sparkles className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">No Quick Picks Available</h1>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Add some bookmarks under 90 minutes to your backlog to get personalized tonight picks!
        </p>
        <div className="flex gap-4">
          <Button onClick={() => navigate("/new")}>Add Bookmark</Button>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <X className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="container mx-auto px-4 lg:px-8 py-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tonight Picks</h1>
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          Quick decisions for busy nights. Under 90 minutes, perfectly curated.
        </p>
      </div>

      {/* Cards */}
      <div className="flex-1 container mx-auto px-4 lg:px-8 py-6">
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {picks.map((bookmark, index) => (
            <div
              key={bookmark.id}
              className="relative bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:border-primary/50"
            >
              {/* Poster/Image */}
              <div className="aspect-video bg-secondary relative">
                {bookmark.poster_url ? (
                  <img
                    src={bookmark.poster_url}
                    alt={bookmark.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl font-bold text-muted-foreground">
                      {(bookmark.title?.trim()?.charAt(0) || '–')}
                    </span>
                  </div>
                )}
                {/* Swap / Not feeling it button */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2 h-8 bg-background/80 backdrop-blur gap-1 text-xs"
                  onClick={() => handleSwapOne(index)}
                  title="Not feeling it"
                >
                  <Shuffle className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Not feeling it</span>
                </Button>
                {/* Runtime */}
                {bookmark.runtime_minutes && (
                  <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-sm font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRuntime(bookmark.runtime_minutes)}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-2">
                <div>
                  <h3 className="font-semibold text-foreground line-clamp-2">{bookmark.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span className="capitalize">{bookmark.type}</span>
                    <span>•</span>
                    <span className="capitalize">{bookmark.provider}</span>
                    {bookmark.release_year && (
                      <>
                        <span>•</span>
                        <span>{bookmark.release_year}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Runtime fit label */}
                {bookmark.runtime_minutes && (
                  <Badge variant="outline" className="text-xs border-dashed text-muted-foreground gap-1 w-fit">
                    <Clock className="w-3 h-3" />
                    {bookmark.runtime_minutes < 30
                      ? "Quick watch (< 30min)"
                      : "Standard watch (30–90min)"}
                  </Badge>
                )}

                {/* Mood tags + match hint */}
                {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      Matches your <span className="capitalize">{bookmark.mood_tags[0]}</span> mood
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {bookmark.mood_tags.slice(0, 3).map((mood) => (
                        <Badge key={mood} variant="outline" className="text-xs">
                          {getMoodEmoji(mood)} {mood}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {bookmark.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {bookmark.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleWatch(bookmark)}
                    disabled={!bookmark.source_url}
                  >
                    <Play className="w-4 h-4 mr-1 fill-current" />
                    Watch
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleMarkDone(bookmark)}
                    disabled={markDoneMutation.isPending}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reroll Button */}
        <div className="text-center mt-6">
          <Button variant="outline" size="lg" onClick={handleRerollAll}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reroll All
          </Button>
        </div>
      </div>

      {/* Back link */}
      <div className="container mx-auto px-4 lg:px-8 py-6 text-center">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          <X className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default TonightPick;
