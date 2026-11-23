import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TmdbCandidatePicker } from "@/components/bookmarks/TmdbCandidatePicker";
import { bookmarkService } from "@/services/bookmarks";
import { parseMatchCandidates } from "@/lib/enrichmentSmartFill";
import { useToast } from "@/hooks/use-toast";
import type { EnrichmentMatchCandidate } from "@/lib/enrichmentSmartFill";

const PostCapture = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bookmarkId = searchParams.get("bookmarkId") ?? "";
  const [pickerOpen, setPickerOpen] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookmarkHref = bookmarkId ? `/b/${bookmarkId}` : "/dashboard";

  const { data: bookmark, isLoading } = useQuery({
    queryKey: ["bookmark", bookmarkId],
    queryFn: () => bookmarkService.getBookmark(bookmarkId),
    enabled: Boolean(bookmarkId),
  });

  const candidates: EnrichmentMatchCandidate[] = parseMatchCandidates(
    bookmark?.metadata?.match_candidates,
  );

  const extractedTitle = bookmark?.metadata?.raw_title ?? bookmark?.title ?? "";

  const handleSelect = async (
    candidate: EnrichmentMatchCandidate,
  ) => {
    if (!bookmarkId) return;
    setIsSelecting(true);
    setPickerOpen(false);
    try {
      await bookmarkService.selectResolutionCandidate(bookmarkId, candidate);
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      await queryClient.invalidateQueries({ queryKey: ["bookmark", bookmarkId] });
      toast({ title: "Matched", description: `Saved as "${candidate.title}".` });
      navigate(bookmarkHref, { replace: true });
    } catch {
      setError("Could not apply this match. Please try again.");
      setIsSelecting(false);
    }
  };

  const handleSkip = async () => {
    if (!bookmarkId) {
      navigate("/dashboard", { replace: true });
      return;
    }
    try {
      await bookmarkService.skipResolutionSelection(bookmarkId);
    } catch {
      // Non-fatal — still navigate
    }
    navigate(bookmarkHref, { replace: true });
  };

  if (!bookmarkId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <p className="text-muted-foreground">No capture data found.</p>
        <Button onClick={() => navigate("/dashboard", { replace: true })}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Could not apply match</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setError(null); setPickerOpen(true); }}>
            Try again
          </Button>
          <Button onClick={() => navigate(bookmarkHref, { replace: true })}>
            Review later
          </Button>
        </div>
      </div>
    );
  }

  if (!bookmark) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <p className="text-muted-foreground">Bookmark not found.</p>
        <Button onClick={() => navigate("/dashboard", { replace: true })}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
        {bookmark?.poster_url ? (
          <div className="w-16 h-16 rounded-2xl overflow-hidden">
            <img
              src={bookmark.poster_url}
              alt={bookmark.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-1 max-w-sm">
          <p className="text-lg font-semibold text-foreground">Choose the right title</p>
          <p className="text-sm text-muted-foreground">
            Select the matching title to finish enriching this capture.
          </p>
        </div>

        {candidates.length > 0 ? (
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button onClick={() => setPickerOpen(true)} disabled={isSelecting}>
              {isSelecting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Applying…</>
              ) : (
                "Select title"
              )}
            </Button>
            <Button variant="outline" onClick={handleSkip} disabled={isSelecting}>
              Review later
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <p className="text-sm text-muted-foreground">No candidates available for this capture.</p>
            <Button onClick={() => navigate(bookmarkHref, { replace: true })}>
              Open bookmark
            </Button>
          </div>
        )}
      </div>

      <TmdbCandidatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        candidates={candidates}
        extractedTitle={extractedTitle}
        onSelect={(candidate, _rejected) => { void handleSelect(candidate); }}
        onSkip={handleSkip}
      />
    </>
  );
};

export default PostCapture;
