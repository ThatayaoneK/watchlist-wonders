import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { Star } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/database";

interface CompletionSheetProps {
  bookmark: Bookmark | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRate: (id: string, rating: number | undefined, review?: string, watchedWith?: string | null) => void;
  onSkip: () => void;
}

const WATCHED_WITH_OPTIONS = ["Solo", "Partner", "Friends", "Family"] as const;

export function CompletionSheet({ bookmark, open, onOpenChange, onRate, onSkip }: CompletionSheetProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [watchedWith, setWatchedWith] = useState<string | null>(null);

  // Reset state when a new bookmark comes in
  useEffect(() => {
    if (open) {
      setRating(null);
      setHoveredRating(null);
      setReview("");
      setWatchedWith(null);
    }
  }, [open, bookmark?.id]);

  // Fire confetti when sheet opens
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.9 },
        colors: ["#FFD700", "#FFA500", "#FF6347", "#7B68EE", "#00CED1"],
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [open]);

  const handleSave = () => {
    if (!bookmark) return;
    onRate(bookmark.id, rating ?? undefined, review.trim() || undefined, watchedWith);
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const displayRating = hoveredRating ?? rating ?? 0;

  if (!bookmark) return null;

  const posterUrl = bookmark.poster_url || bookmark.backdrop_url;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe pb-8 max-h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-lg">
            🎉 Nice one!
          </SheetTitle>
        </SheetHeader>

        {/* Bookmark identity */}
        <div className="flex items-center gap-3 mb-6">
          {posterUrl && (
            <img
              src={posterUrl}
              alt={bookmark.title}
              className="w-10 h-14 object-cover rounded-md shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{bookmark.title}</p>
            {bookmark.release_year && (
              <p className="text-xs text-muted-foreground">{bookmark.release_year}</p>
            )}
          </div>
        </div>

        {/* Star rating */}
        <div className="space-y-2 mb-5">
          <p className="text-sm font-medium">How was it?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 transition-transform hover:scale-110 focus-visible:ring focus-visible:ring-offset-0 focus-visible:ring-yellow-400 focus-visible:rounded"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(null)}
                aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
              >
                <Star
                  className={cn(
                    "w-8 h-8 transition-colors",
                    star <= displayRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  )}
                />
              </button>
            ))}
          </div>
          {rating !== null && (
            <p className="text-xs text-muted-foreground">
              {["", "Didn't enjoy it", "It was okay", "Pretty good!", "Really liked it", "Absolutely loved it"][rating]}
            </p>
          )}
        </div>

        {/* Watched with */}
        <div className="space-y-2 mb-5">
          <p className="text-sm font-medium text-muted-foreground">Who did you watch this with?</p>
          <div className="flex gap-2 flex-wrap">
            {WATCHED_WITH_OPTIONS.map((option) => (
              <Button
                key={option}
                variant={watchedWith === option ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setWatchedWith((prev) => (prev === option ? null : option))}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        {/* Review */}
        <div className="space-y-2 mb-6">
          <p className="text-sm font-medium text-muted-foreground">Quick thoughts? <span className="text-xs">(optional)</span></p>
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="What did you think..."
            className="resize-none text-sm"
            rows={2}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={handleSkip}>
            Skip
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={rating === null && !review.trim() && !watchedWith}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
