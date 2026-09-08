import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Link as LinkIcon, Loader2, Upload, X, Plus, Clock,
  Tag, FileText, Film, Tv, Play, ChevronRight, Sparkles, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { detectProvider, cn } from "@/lib/utils";
import { enrichUrl } from "@/services/functions";
import { captureAndWait, confirmCaptureCandidate } from "@/services/captureShare";
import { bookmarkService } from "@/services/bookmarks";
import { attachmentService } from "@/services/attachments";
import { buildSmartFillData, mapGenresToMoodTags, type EnrichmentMatchCandidate, type MatchConfidence } from "@/lib/enrichmentSmartFill";
import { getSafeErrorMessage } from "@/lib/errorMessage";
import { ConfirmMetadataDialog, type ConfirmMetadataPayload } from "@/components/bookmarks/ConfirmMetadataDialog";
import { CandidateGrid } from "@/components/bookmarks/CandidateGrid";
import { QuickScheduleSheet } from "@/components/schedules/QuickScheduleSheet";
import type { Bookmark } from "@/types/database";
import { queryKeys } from "@/lib/queryKeys";

const GENRE_OPTIONS = [
  "action",
  "adventure",
  "animation",
  "comedy",
  "crime",
  "documentary",
  "drama",
  "family",
  "fantasy",
  "history",
  "horror",
  "music",
  "mystery",
  "romance",
  "scifi",
  "thriller",
  "war",
  "western",
];

const TYPE_OPTIONS: { value: Bookmark["type"]; label: string; icon: React.ElementType }[] = [
  { value: "movie",   label: "Movie",    icon: Film },
  { value: "series",  label: "Series",   icon: Tv },
  { value: "episode", label: "Episode",  icon: Play },
  { value: "video",   label: "Video",    icon: Play },
  { value: "doc",     label: "Document", icon: FileText },
  { value: "other",   label: "Other",    icon: LinkIcon },
];

const PROVIDER_LABELS: Record<string, string> = {
  youtube:   "YouTube",
  instagram: "Instagram",
  facebook:  "Facebook",
  x:         "X / Twitter",
  netflix:   "Netflix",
  imdb:      "IMDB",
  generic:   "Website",
};

const PROVIDER_COLORS: Record<string, string> = {
  youtube:   "bg-red-600",
  instagram: "bg-pink-500",
  facebook:  "bg-blue-600",
  x:         "bg-neutral-700",
  netflix:   "bg-red-700",
  imdb:      "bg-yellow-500",
  generic:   "bg-muted",
};

type Step = "paste" | "confirm";

function toNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function fallbackTitleFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Saved link";
  }
}

function stripCanonicalMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const next = { ...metadata };
  delete next.tmdb_id;
  delete next.tmdbId;
  delete next.media_type;
  delete next.resolution_selected_by;
  return next;
}

function resolveTypeFromEnrichment(
  data: Record<string, unknown>,
  fallbackProvider: Bookmark["provider"],
): Bookmark["type"] {
  const contentType = typeof data.contentType === "string" ? data.contentType : "";
  if (contentType === "video") return "video";
  if (contentType === "episode") return "episode";
  if (contentType === "series") return "series";
  if (contentType === "movie") return "movie";

  const mediaType = typeof data.mediaType === "string" ? data.mediaType : "";
  if (mediaType === "movie") return "movie";
  if (mediaType === "tv") return "series";
  if (fallbackProvider === "youtube") return "video";
  return "movie";
}

const DEMO_URL = "https://www.imdb.com/title/tt1375666/"; // Inception

const NewBookmark = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step control
  const [step, setStep] = useState<Step>("paste");

  // URL enrichment state — pre-fill with demo URL if ?demo=1
  const [url, setUrl] = useState(searchParams.get("demo") === "1" ? DEMO_URL : "");
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Detected provider
  const detectedProvider = url.trim() ? detectProvider(url.trim()) : null;

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Bookmark["type"]>("movie");
  const [provider, setProvider] = useState<Bookmark["provider"]>("generic");
  const [runtimeMinutes, setRuntimeMinutes] = useState<number | null>(null);
  const [releaseYear, setReleaseYear] = useState<number | null>(null);
  const [posterUrl, setPosterUrl] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [matchCandidates, setMatchCandidates] = useState<EnrichmentMatchCandidate[]>([]);
  const [matchConfidence, setMatchConfidence] = useState<MatchConfidence>("unknown");
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string | null>(null);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [isManualSearching, setIsManualSearching] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Duplicate detection
  const selectedTmdbId = toNumericId(metadata.tmdb_id ?? metadata.tmdbId);
  const { data: duplicateBookmark = null } = useQuery({
    queryKey: [...queryKeys.bookmarks.duplicate(selectedTmdbId), type],
    queryFn: () => bookmarkService.findDuplicateByTmdbId(selectedTmdbId!, type === "series" || type === "episode" ? "tv" : "movie"),
    enabled: selectedTmdbId !== null,
    staleTime: 60 * 1000,
  });

  // Attachment state
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Confirm metadata dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInitial, setConfirmInitial] = useState<ConfirmMetadataPayload>({ url: "" });

  // Schedule after save
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [savedBookmark, setSavedBookmark] = useState<Bookmark | null>(null);
  const manualRequestIdRef = useRef(crypto.randomUUID());

  // Create bookmark mutation
  const createBookmarkMutation = useMutation({
    mutationFn: async (bookmarkData: Parameters<typeof bookmarkService.createBookmark>[0]) => {
      let capture = await captureAndWait({
        requestId: manualRequestIdRef.current,
        url: bookmarkData.source_url ?? undefined,
        sharedTitle: bookmarkData.title,
        surface: "manual",
        clientCapturedAt: new Date().toISOString(),
      });
      if (capture.status === "needs_selection" && selectedCandidateKey) {
        const selected = capture.candidates.find(
          (candidate) => `${candidate.tmdbId}-${candidate.mediaType}` === selectedCandidateKey,
        );
        if (selected) capture = await confirmCaptureCandidate({ captureId: capture.captureId, candidate: selected });
      }
      if (capture.status === "processing" || !("bookmarkId" in capture)) {
        throw new Error("Capture did not produce a bookmark.");
      }
      const isDuplicate = capture.status === "duplicate";
      const bookmark = isDuplicate
        ? await bookmarkService.getBookmark(capture.bookmarkId)
        : await bookmarkService.updateBookmark(capture.bookmarkId, {
            title: bookmarkData.title,
            status: bookmarkData.status,
            tags: bookmarkData.tags,
            mood_tags: bookmarkData.mood_tags,
            notes: bookmarkData.notes,
            priority: bookmarkData.priority,
            queue_status: bookmarkData.queue_status,
          });
      if (!isDuplicate && attachments.length > 0) {
        setUploadProgress(0);
        for (let i = 0; i < attachments.length; i++) {
          await attachmentService.createAttachment(attachments[i], bookmark.id);
          setUploadProgress(i + 1);
        }
      }
      return bookmark;
    },
    onSuccess: (bookmark) => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      setUploadProgress(0);
      toast({
        title: "Saved to watchlist!",
        description: `"${bookmark.title}" added successfully.`,
      });
      // Offer to schedule
      setSavedBookmark(bookmark);
      setScheduleOpen(true);
    },
    onError: (error: unknown) => {
      setUploadProgress(0);
      toast({
        title: "Error saving",
        description: getSafeErrorMessage(error, "Something went wrong."),
        variant: "destructive",
      });
    },
  });

  // Auto-trigger fetch when a valid URL is pasted
  const autoFetchedUrlRef = useRef<string>("");
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed || step !== "paste" || isEnriching) return;
    try { new URL(trimmed); } catch { return; }
    if (trimmed === autoFetchedUrlRef.current) return;
    const timer = setTimeout(() => {
      if (autoFetchedUrlRef.current === trimmed) return; // Re-check before calling
      autoFetchedUrlRef.current = trimmed;
      handleFetch();
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, step, isEnriching]);

  // ── Step 1: Fetch enrichment ─────────────────────────────────────
  const mergeUnique = (existing: string[], incoming: string[]) => {
    if (incoming.length === 0) return existing;
    const seen = new Set(existing.map((item) => item.toLowerCase()));
    const merged = [...existing];
    for (const value of incoming) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(value);
    }
    return merged;
  };

  const applyMatchCandidate = (candidate: EnrichmentMatchCandidate, selectedBy: "auto" | "user" = "user") => {
    setSelectedCandidateKey(`${candidate.tmdbId}-${candidate.mediaType}`);
    setShowManualSearch(false);
    setMatchConfidence("high");
    setTitle(candidate.title);
    if (candidate.posterUrl) setPosterUrl(candidate.posterUrl);
    if (candidate.releaseYear) setReleaseYear(candidate.releaseYear);
    if (candidate.runtimeMinutes) setRuntimeMinutes(candidate.runtimeMinutes);
    if (candidate.description) setDescription(candidate.description);

    const candidateMoods = candidate.genres ? mapGenresToMoodTags(candidate.genres) : [];
    if (candidateMoods.length > 0) {
      setSelectedMoods((prev) => prev.length === 0 ? candidateMoods : mergeUnique(prev, candidateMoods));
    }

    if (candidate.contentType === "episode") setType("episode");
    else if (candidate.contentType === "series") setType("series");
    else setType(candidate.mediaType === "tv" ? "series" : "movie");
    setCanonicalUrl(`https://www.themoviedb.org/${candidate.mediaType}/${candidate.tmdbId}`);

    const rejectedCandidates = matchCandidates
      .filter((c) => c.tmdbId !== candidate.tmdbId)
      .map((c) => ({
        tmdbId: c.tmdbId,
        title: c.title,
        mediaType: c.mediaType,
        releaseYear: c.releaseYear,
        score: c.score,
        selected: false,
      }));

    setMetadata((prev) => ({
      ...prev,
      tmdb_id: candidate.tmdbId,
      media_type: candidate.mediaType,
      match_confidence: "high",
      resolution_status: "matched",
      resolution_confidence: candidate.score ?? 1,
      resolution_confidence_band: "high",
      resolution_requires_selection: false,
      resolution_selected_by: selectedBy,
      resolution_selected_candidate: candidate,
      resolution_candidate_history: rejectedCandidates,
      ...(candidate.backdropUrl ? { backdrop_url: candidate.backdropUrl } : {}),
      ...(candidate.description ? { overview: candidate.description } : {}),
      ...(candidate.voteAverage !== undefined ? { vote_average: candidate.voteAverage } : {}),
      ...(candidate.genres && candidate.genres.length ? { genres: candidate.genres } : {}),
    }));
  };

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    autoFetchedUrlRef.current = trimmed;
    setEnrichError(null);
    setIsEnriching(true);
    const dp = detectProvider(trimmed);
    setProvider(dp);

    try {
      const data = await enrichUrl(trimmed);
      const smartFill = buildSmartFillData(data);
      const rawTitle = typeof data.title === "string" ? data.title.trim() : "";

      if (import.meta.env.DEV) {
        console.log("RAW META:", data);
        console.log("CLEAN TITLE:", rawTitle);
        console.log("TMDB RESULT:", smartFill.matchCandidates[0] ?? null);
      }

      const resolvedProvider =
        typeof data.provider === "string" && data.provider !== "unknown"
          ? data.provider
          : dp;
      const fallbackProvider = (resolvedProvider as Bookmark["provider"]) || "generic";
      setProvider(fallbackProvider);

      if (!rawTitle) {
        // If TMDB returned candidates, move to step 2 instead of forcing manual dialog.
        if (smartFill.matchCandidates.length > 0) {
          const resolvedConfidence =
            smartFill.matchConfidence === "unknown" ? "low" : smartFill.matchConfidence;
          const shouldAutoSelectTopCandidate =
            smartFill.resolutionStatus === "matched" && resolvedConfidence === "high";
          const topCandidate = smartFill.matchCandidates[0];

          if (topCandidate && shouldAutoSelectTopCandidate) {
            applyMatchCandidate(topCandidate, "auto");
          } else {
            setTitle(fallbackTitleFromUrl(trimmed));
            setSelectedCandidateKey(null);
            setType(resolveTypeFromEnrichment(data, fallbackProvider));
          }

          setMatchCandidates(smartFill.matchCandidates);
          setMatchConfidence(resolvedConfidence);

          let metadataFromSmartFill = { ...smartFill.metadata };
          if (!shouldAutoSelectTopCandidate) {
            metadataFromSmartFill = stripCanonicalMetadata(metadataFromSmartFill);
            metadataFromSmartFill.resolution_status = "needs_selection";
            metadataFromSmartFill.resolution_requires_selection = true;
            metadataFromSmartFill.match_candidates = smartFill.matchCandidates;
          }
          setMetadata((prev) => ({ ...prev, ...metadataFromSmartFill }));
          setStep("confirm");
          return;
        }
        // Truly nothing found - fall back to manual entry dialog.
        setConfirmInitial({
          url: trimmed,
          provider: fallbackProvider,
          title: rawTitle || undefined,
          posterUrl: typeof data.posterUrl === "string" ? data.posterUrl : undefined,
          runtimeMinutes: typeof data.runtimeMinutes === "number" ? data.runtimeMinutes : null,
          type: resolveTypeFromEnrichment(data, fallbackProvider),
          debugMessage: data.error ? "Could not fetch details for this link." : undefined,
        });
        setConfirmOpen(true);
        return;
      }

      const shouldAutoSelectTopCandidate =
        smartFill.resolutionStatus === "matched" && smartFill.matchConfidence === "high";
      const topCandidate = smartFill.matchCandidates[0];

      setTitle(rawTitle);
      if (typeof data.posterUrl === "string") setPosterUrl(data.posterUrl);
      if (typeof data.runtimeMinutes === "number") setRuntimeMinutes(data.runtimeMinutes);
      if (smartFill.releaseYear) setReleaseYear(smartFill.releaseYear);
      if (smartFill.description !== null) setDescription(smartFill.description);
      if (smartFill.canonicalUrl) setCanonicalUrl(smartFill.canonicalUrl);
      if (smartFill.tags.length > 0) {
        setTags((prev) => mergeUnique(prev, smartFill.tags));
      }
      if (smartFill.moodTags.length > 0) {
        setSelectedMoods((prev) => prev.length === 0 ? smartFill.moodTags : mergeUnique(prev, smartFill.moodTags));
      }
      setMatchCandidates(smartFill.matchCandidates);
      setMatchConfidence(smartFill.matchConfidence);
      if (shouldAutoSelectTopCandidate && topCandidate) {
        applyMatchCandidate(topCandidate, "auto");
      } else {
        setSelectedCandidateKey(null);
      }

      setType(resolveTypeFromEnrichment(data, fallbackProvider));

      // Store TMDB metadata
      let metadataFromSmartFill = { ...smartFill.metadata };
      if (!shouldAutoSelectTopCandidate) {
        metadataFromSmartFill = stripCanonicalMetadata(metadataFromSmartFill);
        metadataFromSmartFill.resolution_status = smartFill.matchCandidates.length > 0 ? "needs_selection" : "unresolved";
        metadataFromSmartFill.resolution_requires_selection = true;
        if (smartFill.matchCandidates.length > 0) {
          metadataFromSmartFill.match_candidates = smartFill.matchCandidates;
        }
      }
      setMetadata((prev) => ({ ...prev, ...metadataFromSmartFill }));

      // Advance to step 2
      setStep("confirm");
    } catch (error: unknown) {
      setMatchCandidates([]);
      setMatchConfidence("unknown");
      setSelectedCandidateKey(null);
      const dp2 = detectProvider(trimmed);
      setConfirmInitial({
        url: trimmed,
        provider: dp2,
        type: resolveTypeFromEnrichment({}, dp2),
        debugMessage: getSafeErrorMessage(error, "Could not fetch details for this link."),
      });
      setConfirmOpen(true);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleConfirmMetadata = (data: {
    url: string; provider?: string; title: string;
    posterUrl?: string; runtimeMinutes: number | null; type: Bookmark["type"];
  }) => {
    setTitle(data.title);
    if (data.posterUrl) setPosterUrl(data.posterUrl);
    if (data.runtimeMinutes) setRuntimeMinutes(data.runtimeMinutes);
    setType(data.type);
    setMatchCandidates([]);
    setMatchConfidence("unknown");
    setSelectedCandidateKey(null);
    setStep("confirm");
  };

  const handleMoodToggle = (mood: string) => {
    setSelectedMoods((prev) => prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const openManualEntry = (searchTitle: string) => {
    setConfirmInitial({ url: url || "", title: searchTitle });
    setConfirmOpen(true);
    setShowManualSearch(false);
  };

  const handleManualSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsManualSearching(true);
    try {
      const data = await enrichUrl(trimmed);
      const smartFill = buildSmartFillData(data);
      if (smartFill.matchCandidates.length > 0) {
        setMatchCandidates(smartFill.matchCandidates);
        setMatchConfidence(smartFill.matchConfidence === "unknown" ? "low" : smartFill.matchConfidence);
        setSelectedCandidateKey(null);
        setMetadata((prev) => ({
          ...prev,
          resolution_status: "needs_selection",
          resolution_requires_selection: true,
          match_candidates: smartFill.matchCandidates,
        }));
      } else {
        openManualEntry(trimmed);
      }
    } catch {
      openManualEntry(trimmed);
    } finally {
      setIsManualSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a title.", variant: "destructive" });
      return;
    }
    const trimmedDescription = description.trim();
    const metadataForSave = {
      ...metadata,
      ...(trimmedDescription ? { overview: trimmedDescription } : {}),
    };
    if (duplicateBookmark) {
      const shouldContinue = window.confirm(
        `"${duplicateBookmark.title}" is already in your watchlist. Save this as another copy?`,
      );
      if (!shouldContinue) return;
    }
    createBookmarkMutation.mutate({
      title: title.trim(),
      type,
      provider,
      source_url: url || null,
      canonical_url: canonicalUrl,
      runtime_minutes: runtimeMinutes,
      release_year: releaseYear,
      poster_url: posterUrl || null,
      notes: notes || null,
      tags,
      mood_tags: selectedMoods,
      status: "backlog",
      metadata: metadataForSave,
    });
  };

  // ── Render: Step 1 — Paste ───────────────────────────────────────
  if (step === "paste") {
    return (
      <div className="min-h-screen bg-background pt-[68px]">
        {/* Header */}
        <div className="sticky top-[68px] z-40 bg-background/95 backdrop-blur border-b border-border">
          <div className="container mx-auto px-4 lg:px-8 flex items-center gap-4 h-16">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Add to Watchlist</h1>
              <p className="text-xs text-muted-foreground">Step 1 of 2 — Paste a link</p>
            </div>
          </div>
        </div>

        {/* Step 1 content */}
        <div className="container mx-auto px-4 lg:px-8 max-w-xl py-16">
          {/* Big URL input */}
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LinkIcon className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Paste a link</h2>
            <p className="text-muted-foreground">
              Paste any link from YouTube, Instagram, Facebook, X, Netflix, or IMDB — we'll fetch the details automatically.
            </p>
          </div>

          {/* Platform icons */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {Object.entries(PROVIDER_COLORS).filter(([k]) => k !== "generic").map(([key, color]) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <div
                  title={PROVIDER_LABELS[key]}
                  className={cn(
                    "w-9 h-9 rounded-full text-[10px] font-bold text-white flex items-center justify-center transition-all",
                    color,
                    detectedProvider === key ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-background" : "opacity-50"
                  )}
                >
                  {PROVIDER_LABELS[key].slice(0, 2)}
                </div>
                <span className={cn(
                  "text-[9px] font-medium transition-opacity",
                  detectedProvider === key ? "text-foreground" : "text-muted-foreground/50"
                )}>
                  {PROVIDER_LABELS[key].split(" ")[0].slice(0, 4)}
                </span>
              </div>
            ))}
          </div>

          {/* URL input + button */}
          <div className="space-y-3">
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => { setUrl(e.target.value); setEnrichError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) handleFetch(); }}
                className="pl-10 pr-4 h-12 text-base"
                autoFocus
              />
            </div>

            {/* Inline feedback — detected provider OR error (mutually exclusive) */}
            {enrichError ? (
              <p className="text-xs text-destructive px-1">{enrichError}</p>
            ) : detectedProvider && url.trim() ? (
              <p className="text-xs text-muted-foreground px-1">
                ✓ <span className="text-foreground font-medium">{PROVIDER_LABELS[detectedProvider]}</span> link detected
              </p>
            ) : null}

            {/* Loading skeleton — appears right here, close to where the user is looking */}
            {isEnriching && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex gap-2">
                  <div className="h-3 bg-muted rounded animate-pulse flex-1" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/4" />
                </div>
                <div className="flex gap-2">
                  <div className="h-3 bg-muted rounded animate-pulse w-2/5" />
                  <div className="h-3 bg-muted rounded animate-pulse flex-1" />
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Fetching details from {detectedProvider ? PROVIDER_LABELS[detectedProvider] : "the link"}…
                </p>
              </div>
            )}

            <Button
              className="w-full h-12 text-base"
              onClick={handleFetch}
              disabled={!url.trim() || isEnriching}
            >
              {isEnriching ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Fetching details…</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" />Fetch & Continue<ChevronRight className="w-5 h-5 ml-2" /></>
              )}
            </Button>
          </div>

          {/* Manual add option */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">Don't have a link?</p>
            <Button
              variant="outline"
              onClick={() => {
                setMatchCandidates([]);
                setMatchConfidence("unknown");
                setSelectedCandidateKey(null);
                setStep("confirm");
              }}
            >
              Add manually without a link
            </Button>
          </div>
        </div>

        <ConfirmMetadataDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          initial={confirmInitial}
          onConfirm={handleConfirmMetadata}
        />
      </div>
    );
  }

  // ── Render: Step 2 — Confirm & Save ────────────────────────────
  return (
    <div className="min-h-screen bg-background pt-[68px]">
      {/* Header */}
      <div className="sticky top-[68px] z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 lg:px-8 flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" onClick={() => { setStep("paste"); setShowManualSearch(false); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Confirm Details</h1>
            <p className="text-xs text-muted-foreground">Step 2 of 2 — Confirm & save</p>
          </div>
        </div>
      </div>

      {/* Step 2 content */}
      <div className="container mx-auto px-4 lg:px-8 py-8 max-w-4xl">
        {/* Duplicate warning */}
        {duplicateBookmark && (
          <div className="mb-6 flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
            <span className="text-yellow-500 mt-0.5">⚠</span>
            <div>
              <span className="font-medium text-foreground">Already in your watchlist — </span>
              <Link to={`/b/${duplicateBookmark.id}`} className="text-primary hover:underline">
                View "{duplicateBookmark.title}"
              </Link>
              <span className="text-muted-foreground"> · You can still save another copy.</span>
            </div>
          </div>
        )}
        {matchCandidates.length > 0 && (matchConfidence !== "high" || matchCandidates.length > 1) && (
          <div className="mb-6 rounded-xl border border-border bg-wm-surface p-4">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {matchCandidates.length === 1 ? "Is this the right title?" : "We found possible matches"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select to auto-fill synopsis, runtime, and genre.
                </p>
              </div>
              {!showManualSearch && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground shrink-0"
                  onClick={() => {
                    setSelectedCandidateKey(null);
                    setShowManualSearch(true);
                    setManualSearchQuery("");
                    setMetadata((prev) => ({
                      ...stripCanonicalMetadata(prev),
                      resolution_status: "needs_selection",
                      resolution_requires_selection: true,
                      match_candidates: matchCandidates,
                    }));
                  }}
                >
                  None of these
                </Button>
              )}
            </div>

            <CandidateGrid
              candidates={matchCandidates}
              selectedKey={selectedCandidateKey}
              onSelect={(candidate) => applyMatchCandidate(candidate)}
            />

            {showManualSearch && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Search for the correct title</p>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleManualSearch(manualSearchQuery);
                  }}
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="e.g. Pain (2021 documentary)…"
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-9 px-4 shrink-0"
                    disabled={!manualSearchQuery.trim() || isManualSearching}
                  >
                    {isManualSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 shrink-0"
                    onClick={() => setShowManualSearch(false)}
                  >
                    Cancel
                  </Button>
                </form>
              </div>
            )}
          </div>
        )}

        <form id="bookmark-form" onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-[200px_1fr] gap-8">
            {/* Left: Poster preview */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-full aspect-[2/3] bg-wm-surface rounded-xl overflow-hidden border border-border relative">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={title || "Poster"}
                    className="w-full h-full object-cover"
                    onError={() => setPosterUrl("")}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl font-bold text-muted-foreground/30">
                      {title.charAt(0).toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                {/* Provider badge */}
                {provider && provider !== "generic" && (
                  <div className={cn("absolute top-2 left-2 w-3 h-3 rounded-full", PROVIDER_COLORS[provider])} />
                )}
              </div>
            </div>

            {/* Right: Form fields */}
            <div className="space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter title…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 text-base font-medium"
                  required
                />
              </div>

              {/* Type + Runtime + Year */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as Bookmark["type"])}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="w-3.5 h-3.5" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="runtime" className="text-xs text-muted-foreground">Runtime (min)</Label>
                  <div className="relative">
                    <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="runtime"
                      type="number"
                      placeholder="90"
                      value={runtimeMinutes || ""}
                      onChange={(e) => setRuntimeMinutes(e.target.value ? parseInt(e.target.value) : null)}
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="year" className="text-xs text-muted-foreground">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="2024"
                    value={releaseYear || ""}
                    onChange={(e) => setReleaseYear(e.target.value ? parseInt(e.target.value) : null)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Genre */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Genre</Label>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Genre">
                  {GENRE_OPTIONS.map((mood) => {
                    const isSelected = selectedMoods.includes(mood);
                    return (
                      <button
                        key={mood}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        onClick={() => handleMoodToggle(mood)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium select-none transition-colors min-h-[28px]",
                          isSelected
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "bg-transparent text-foreground border-border hover:bg-white/10"
                        )}
                      >
                        {mood}
                      </button>
                    );
                  })}
                </div>
                {selectedMoods.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedMoods.length} selected</p>
                )}
              </div>

              {/* Description (synopsis) */}
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Synopsis from TMDB or source metadata…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* My Notes — always visible; primes the user to record context */}
              <div className="space-y-1.5">
                <Label htmlFor="my-notes" className="text-sm font-medium">My Notes</Label>
                <Textarea
                  id="my-notes"
                  placeholder="Why are you saving this? Who recommended it?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Custom tags */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Custom Tags</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Add a tag…"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                  {/* Fitts's Law: ≥44px touch target */}
                  <Button type="button" variant="secondary" size="icon" className="h-11 w-11 shrink-0" onClick={handleAddTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                        {tag}
                        <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-destructive min-w-[20px] min-h-[20px] flex items-center justify-center" aria-label={`Remove tag ${tag}`}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Files */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Files (optional)</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  <input
                    type="file"
                    id="attachments"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => setAttachments([...attachments, ...Array.from(e.target.files || [])])}
                    className="hidden"
                  />
                  <label htmlFor="attachments" className="cursor-pointer">
                    <Upload className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Upload screenshots, PDFs, or related files</p>
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map((file) => {
                      const stableKey = `${file.name}-${file.size}-${file.lastModified}`;
                      return (
                        <div key={stableKey} className="flex items-center justify-between p-2.5 bg-wm-surface rounded-lg text-sm">
                          <span className="truncate max-w-[200px] text-xs">{file.name}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAttachments(attachments.filter((f) => `${f.name}-${f.size}-${f.lastModified}` !== stableKey))}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Sticky bottom CTA — Fitts's Law: put the primary action where the user's eye ends up */}
        <div className="sticky bottom-0 left-0 right-0 mt-8 py-4 bg-background/95 backdrop-blur border-t border-border">
          <Button
            type="submit"
            form="bookmark-form"
            size="lg"
            className="w-full h-12 text-base gap-2"
            disabled={createBookmarkMutation.isPending || !title.trim()}
          >
            {createBookmarkMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {uploadProgress > 0 ? `Uploading ${uploadProgress}/${attachments.length}…` : "Saving…"}
              </>
            ) : selectedCandidateKey === null && matchCandidates.length > 0 ? "Save Link Only" : "Save to Watchlist"}
          </Button>
        </div>
      </div>

      <ConfirmMetadataDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        initial={confirmInitial}
        onConfirm={handleConfirmMetadata}
      />

      {/* Schedule after save */}
      <QuickScheduleSheet
        bookmark={savedBookmark}
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) navigate("/dashboard");
        }}
        onScheduled={() => navigate("/dashboard")}
      />
    </div>
  );
};

export default NewBookmark;

