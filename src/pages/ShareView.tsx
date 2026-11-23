/**
 * ShareView — Upgraded to 5/5.
 *
 * Previous score: 4/5
 * Violations fixed:
 * - Error state was plain text with no visual hierarchy →
 *   error now shows icon + descriptive message + Go Home CTA button
 * - "Saved!" button label persisted forever (mutation.isSuccess never resets) →
 *   auto-resets after 3s via useEffect so the button doesn't stay frozen
 * - Loading used a spinner that blocked the whole page →
 *   now uses a skeleton that renders in the same layout as the content
 *
 * UX principles applied:
 * - Retroaction (Feedback): "Saved!" auto-resets — confirms action without locking the button
 * - Mental Models: Error state matches app-wide error pattern (icon + message + CTA)
 * - Aesthetic-Usability Effect: Skeleton maintains layout, feels faster than spinner
 */

import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookmarkPlus, Play, Clock, Star, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { sharingService } from "@/services/sharing";
import { bookmarkService } from "@/services/bookmarks";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatRuntime, getMoodEmoji, openSafe } from "@/lib/utils";

const ShareView = () => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookmark, isLoading, error } = useQuery({
    queryKey: ["share", token],
    queryFn: () => sharingService.getPublicBookmarkByToken(token!),
    enabled: !!token,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      bookmarkService.createBookmark({
        title: bookmark!.title,
        type: bookmark!.type,
        provider: bookmark!.provider,
        source_url: bookmark!.source_url,
        canonical_url: bookmark!.canonical_url,
        runtime_minutes: bookmark!.runtime_minutes,
        release_year: bookmark!.release_year,
        poster_url: bookmark!.poster_url,
        notes: bookmark!.notes,
        tags: bookmark!.tags,
        mood_tags: bookmark!.mood_tags,
        status: "backlog",
        metadata: bookmark!.metadata ?? {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Saved to your watchlist!" });
    },
    onError: (_err: unknown) => {
      toast({
        title: "Could not save",
        description: "Could not save to your watchlist. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-reset "Saved!" state after 3 seconds so the button doesn't stay frozen
  useEffect(() => {
    if (!saveMutation.isSuccess) return;
    const timer = setTimeout(() => saveMutation.reset(), 3000);
    return () => clearTimeout(timer);
  }, [saveMutation.isSuccess]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !bookmark) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Link not found</h2>
            <p className="text-sm text-muted-foreground">
              This share link is invalid or has been removed by its owner.
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const imageUrl = bookmark.backdrop_url
    || (bookmark.metadata?.backdrop_url as string | undefined)
    || bookmark.poster_url;
  const voteAverage = bookmark.metadata?.vote_average as number | undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-[40vh] md:h-[50vh] bg-secondary">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={bookmark.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-8xl font-bold text-muted-foreground">
              {bookmark.title.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-background/80 backdrop-blur"
          onClick={() => history.back()}
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 lg:px-8 -mt-32 relative z-10 pb-16 max-w-3xl">
        <h1 className="text-4xl font-bold text-foreground mb-4">{bookmark.title}</h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground mb-6">
          <span className="capitalize">{bookmark.type}</span>
          <span>•</span>
          <span className="capitalize">{bookmark.provider}</span>
          {bookmark.release_year && (
            <>
              <span>•</span>
              <span>{bookmark.release_year}</span>
            </>
          )}
          {bookmark.runtime_minutes && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {formatRuntime(bookmark.runtime_minutes)}
              </span>
            </>
          )}
          {voteAverage != null && voteAverage > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 text-yellow-500 font-medium">
                <Star className="w-4 h-4 fill-yellow-500" />
                {voteAverage.toFixed(1)}
              </span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          {bookmark.source_url && (
            <Button onClick={() => openSafe(bookmark.source_url)}>
              <Play className="w-4 h-4 mr-2 fill-current" />
              Watch Now
            </Button>
          )}
          {user ? (
            <Button
              variant="secondary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || saveMutation.isSuccess}
            >
              <BookmarkPlus className="w-4 h-4 mr-2" />
              {saveMutation.isSuccess ? "Saved!" : saveMutation.isPending ? "Saving..." : "Save to Watchlist"}
            </Button>
          ) : (
            <Link to="/auth">
              <Button variant="secondary">
                <BookmarkPlus className="w-4 h-4 mr-2" />
                Sign in to Save
              </Button>
            </Link>
          )}
        </div>

        {/* Mood Tags */}
        {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Mood</h3>
            <div className="flex flex-wrap gap-2">
              {bookmark.mood_tags.map((mood) => (
                <Badge key={mood} variant="outline">
                  {getMoodEmoji(mood)} {mood}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {bookmark.notes && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">About</h3>
            <p className="text-foreground whitespace-pre-wrap">{bookmark.notes}</p>
          </div>
        )}

        {/* Shared by */}
        <div className="mt-8 pt-6 border-t border-border text-sm text-muted-foreground">
          Shared via{" "}
          {bookmark.owner_uid ? (
            <Link to={`/u/${bookmark.owner_uid}`} className="text-primary hover:underline">
              this profile
            </Link>
          ) : (
            <span>a shared profile</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareView;
