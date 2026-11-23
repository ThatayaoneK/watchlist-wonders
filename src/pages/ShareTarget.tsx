import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Link as LinkIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TmdbCandidatePicker } from "@/components/bookmarks/TmdbCandidatePicker";
import { detectProvider } from "@/lib/utils";
import { captureAndWait, confirmCaptureCandidate } from "@/services/captureShare";
import type { CaptureBookmarkResponse } from "@watchmarks/shared/capture";
import type { Bookmark } from "@/types/database";
import { storage } from "@/lib/storage";

const PROVIDER_LABELS: Record<Bookmark["provider"], string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X / Twitter",
  tiktok: "TikTok",
  reddit: "Reddit",
  letterboxd: "Letterboxd",
  rottentomatoes: "Rotten Tomatoes",
  netflix: "Netflix",
  imdb: "IMDb",
  generic: "the web",
};

const PROVIDER_MARKS: Record<Bookmark["provider"], string> = {
  youtube: "YT",
  instagram: "IG",
  facebook: "FB",
  x: "X",
  tiktok: "TT",
  reddit: "R",
  letterboxd: "LB",
  rottentomatoes: "RT",
  netflix: "N",
  imdb: "IMDB",
  generic: "WEB",
};

function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  if (!match?.[0]) return null;
  return match[0].replace(/[.,!?]+$/, "");
}

type ShareViewState = "capturing" | "needs_selection" | "saved" | "duplicate" | "unresolved" | "error";

const ShareTarget = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewState, setViewState] = useState<ShareViewState>("capturing");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [captureResult, setCaptureResult] = useState<CaptureBookmarkResponse | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const captureStartedRef = useRef(false);
  const requestIdRef = useRef(crypto.randomUUID());

  const sharedUrl = searchParams.get("url") ?? "";
  const sharedText = searchParams.get("text") ?? "";
  const sharedTitle = searchParams.get("title") ?? "";

  const targetUrl = useMemo(
    () => sharedUrl || extractUrlFromText(sharedText) || "",
    [sharedUrl, sharedText],
  );
  const hasSharePayload = Boolean(sharedUrl || sharedText || sharedTitle);
  const detectedProvider = useMemo<Bookmark["provider"]>(
    () => (targetUrl ? detectProvider(targetUrl) : "generic"),
    [targetUrl],
  );

  const bookmarkId = captureResult && "bookmarkId" in captureResult ? captureResult.bookmarkId : null;
  const bookmarkHref = bookmarkId ? `/b/${bookmarkId}` : "/library";

  const routeToBookmark = useCallback(() => {
    navigate(bookmarkHref, { replace: true });
  }, [bookmarkHref, navigate]);

  const persistPendingPayload = useCallback(() => {
    if (sharedUrl) storage.set("pendingShareUrl", sharedUrl, "session");
    if (sharedTitle) storage.set("pendingShareTitle", sharedTitle, "session");
    if (sharedText) storage.set("pendingShareText", sharedText, "session");
  }, [sharedText, sharedTitle, sharedUrl]);

  useEffect(() => {
    if (sharedUrl || sharedText || sharedTitle) return;

    const pendingUrl = storage.get<string | null>("pendingShareUrl", { fallback: null }, "session");
    const pendingTitle = storage.get<string | null>("pendingShareTitle", { fallback: null }, "session");
    const pendingText = storage.get<string | null>("pendingShareText", { fallback: null }, "session");
    if (!pendingUrl && !pendingTitle && !pendingText) return;

    const params = new URLSearchParams();
    if (pendingUrl) params.set("url", pendingUrl);
    if (pendingTitle) params.set("title", pendingTitle);
    if (pendingText) params.set("text", pendingText);
    navigate(`/share-target?${params.toString()}`, { replace: true });

    storage.remove("pendingShareUrl", "session");
    storage.remove("pendingShareTitle", "session");
    storage.remove("pendingShareText", "session");
  }, [navigate, sharedText, sharedTitle, sharedUrl]);

  useEffect(() => {
    if (authLoading || user) return;
    if (!hasSharePayload) return;

    persistPendingPayload();
    navigate(`/auth?redirect=${encodeURIComponent("/share-target")}`, { replace: true });
  }, [authLoading, hasSharePayload, navigate, persistPendingPayload, user]);

  useEffect(() => {
    if (captureResult?.status !== "saved" && captureResult?.status !== "duplicate") return;
    if (!captureResult.bookmarkId) return;

    const timeout = window.setTimeout(() => {
      navigate(`/b/${captureResult.bookmarkId}`, { replace: true });
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [captureResult, navigate]);

  useEffect(() => {
    if (authLoading || !user || !hasSharePayload || captureStartedRef.current) return;

    captureStartedRef.current = true;
    setViewState("capturing");
    setCaptureError(null);
    setCaptureResult(null);

    void (async () => {
      try {
        const result = await captureAndWait({
          requestId: requestIdRef.current,
          url: sharedUrl || undefined,
          sharedText: sharedText || undefined,
          sharedTitle: sharedTitle || undefined,
          surface: "pwa_share",
          clientCapturedAt: new Date().toISOString(),
        });
        setCaptureResult(result);
        await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });

        switch (result.status) {
          case "saved":
            setViewState("saved");
            toast({ title: "Saved", description: "Added to your watchlist." });
            break;
          case "duplicate":
            setViewState("duplicate");
            toast({ title: "Already saved", description: "This title is already in your watchlist." });
            break;
          case "needs_selection":
            setViewState("needs_selection");
            setPickerOpen(true);
            break;
          case "unresolved":
          default:
            setViewState("unresolved");
            toast({ title: "Saved for later", description: "We saved this capture for later review." });
            break;
        }
      } catch {
        captureStartedRef.current = false;
        setViewState("error");
        setCaptureError("Could not capture this share right now.");
      }
    })();
  }, [
    authLoading,
    hasSharePayload,
    queryClient,
    retryCount,
    sharedText,
    sharedTitle,
    sharedUrl,
    toast,
    user,
  ]);

  const handleRetry = () => {
    captureStartedRef.current = false;
    setCaptureError(null);
    setCaptureResult(null);
    setPickerOpen(false);
    setRetryCount((prev) => prev + 1);
  };

  const handleCandidateSelect = async (candidate: Extract<CaptureBookmarkResponse, { status: "needs_selection" }>["candidates"][number]) => {
    if (!captureResult?.captureId) return;
    setIsSelecting(true);
    try {
      const confirmed = await confirmCaptureCandidate({ captureId: captureResult.captureId, candidate });
      if (confirmed.status !== "saved") throw new Error("Candidate confirmation did not complete.");
      await queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Matched", description: `Saved as "${candidate.title}".` });
      navigate(`/b/${confirmed.bookmarkId}`, { replace: true });
    } catch {
      setCaptureError("Could not apply this match.");
      setViewState("error");
    } finally {
      setIsSelecting(false);
      setPickerOpen(false);
    }
  };

  if (!authLoading && user && !hasSharePayload) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="text-muted-foreground">No share data was found.</p>
          <p className="text-sm text-muted-foreground/80">
            If Watchmarks does not appear in your mobile share sheet yet, copy the link first, then open
            Watchmarks and paste it manually.
          </p>
        </div>
        <Button onClick={() => navigate("/new")}>Add manually</Button>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">Could not capture share</p>
          <p className="text-sm text-muted-foreground">{captureError}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
          <Button onClick={() => navigate(targetUrl ? `/new?url=${encodeURIComponent(targetUrl)}` : "/new")}>
            Add manually
          </Button>
        </div>
      </div>
    );
  }

  const headline =
    viewState === "saved"
      ? "Saved to Watchmarks"
      : viewState === "duplicate"
        ? "Already in your watchlist"
        : viewState === "unresolved"
          ? "Saved for later review"
          : viewState === "needs_selection"
            ? "Choose the right title"
            : `Saving from ${PROVIDER_LABELS[detectedProvider]}...`;
  const description =
    viewState === "saved"
      ? "We matched the title and stored it successfully."
      : viewState === "duplicate"
        ? "This capture already exists, so we linked you to the existing bookmark."
        : viewState === "unresolved"
          ? "We stored the capture, but the title still needs review."
          : viewState === "needs_selection"
            ? "Select the matching title to finish enrichment."
            : "Identifying content and preparing your save.";

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-sm font-semibold text-primary overflow-hidden">
          {viewState === "saved" || viewState === "duplicate" || viewState === "unresolved" ? (
            <CheckCircle2 className="w-7 h-7" />
          ) : (
            PROVIDER_MARKS[detectedProvider]
          )}
        </div>

        {viewState === "capturing" ? (
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        ) : null}

        <div className="space-y-1 max-w-sm">
          <p className="text-lg font-semibold text-foreground">{headline}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {viewState === "saved" || viewState === "duplicate" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LinkIcon className="w-4 h-4" />
            Opening bookmark...
          </div>
        ) : null}

        {viewState === "needs_selection" ? (
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button onClick={() => setPickerOpen(true)} disabled={isSelecting}>
              {isSelecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Select title"}
            </Button>
            <Button variant="outline" onClick={routeToBookmark} disabled={!bookmarkId}>
              Review later
            </Button>
          </div>
        ) : null}

        {viewState === "unresolved" ? (
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button onClick={routeToBookmark} disabled={!bookmarkId}>
              Open bookmark
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard", { replace: true })}>
              Go to dashboard
            </Button>
          </div>
        ) : null}
      </div>

      <TmdbCandidatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        candidates={captureResult?.status === "needs_selection" ? captureResult.candidates : []}
        extractedTitle={sharedTitle}
        onSelect={(candidate) => { void handleCandidateSelect(candidate); }}
        onSkip={() => {
          setPickerOpen(false);
          routeToBookmark();
        }}
      />
    </>
  );
};

export default ShareTarget;
