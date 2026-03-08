import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Link as LinkIcon, Loader2, Upload, X, Plus, Clock,
  Tag, FileText, Film, Tv, Play, ChevronRight, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { detectProvider, getMoodEmoji, cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { fbFunctions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { bookmarkService } from "@/services/bookmarks";
import { attachmentService } from "@/services/attachments";
import { ConfirmMetadataDialog, type ConfirmMetadataPayload } from "@/components/bookmarks/ConfirmMetadataDialog";
import { QuickScheduleSheet } from "@/components/schedules/QuickScheduleSheet";
import type { Bookmark } from "@/types/database";

const MOOD_OPTIONS = [
  "action", "comedy", "drama", "horror", "romance", "thriller",
  "documentary", "scifi", "fantasy", "animation", "family",
  "relaxing", "inspiring", "intense", "thoughtful", "nostalgic",
  "uplifting", "dark", "quirky", "epic", "emotional", "fun", "educational"
];

const MOOD_DEFAULT_VISIBLE = 9; // Hick's Law: show fewer to start

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

const NewBookmark = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step control
  const [step, setStep] = useState<Step>("paste");

  // URL enrichment state
  const [url, setUrl] = useState("");
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
  const [notes, setNotes] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [showAllMoods, setShowAllMoods] = useState(false);

  // Duplicate detection
  const { data: allBookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
    staleTime: 60 * 1000,
  });
  const duplicateBookmark = metadata.tmdb_id
    ? allBookmarks.find((b) => (b.metadata?.tmdb_id ?? b.metadata?.tmdbId) === metadata.tmdb_id)
    : null;

  // Attachment state
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Confirm metadata dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInitial, setConfirmInitial] = useState<ConfirmMetadataPayload>({ url: "" });

  // Schedule after save
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [savedBookmark, setSavedBookmark] = useState<Bookmark | null>(null);

  // Create bookmark mutation
  const createBookmarkMutation = useMutation({
    mutationFn: async (bookmarkData: Parameters<typeof bookmarkService.createBookmark>[0]) => {
      const bookmark = await bookmarkService.createBookmark(bookmarkData);
      if (attachments.length > 0) {
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
    onError: (error: any) => {
      setUploadProgress(0);
      toast({
        title: "Error saving",
        description: error.message || "Something went wrong.",
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
  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    autoFetchedUrlRef.current = trimmed;
    setEnrichError(null);
    setIsEnriching(true);
    const dp = detectProvider(trimmed);
    setProvider(dp);

    try {
      const enrichCallable = httpsCallable(fbFunctions, 'enrich');
      const result = await enrichCallable({ url: trimmed });
      const data = result.data as any;

      const resolvedProvider = (data.provider && data.provider !== "unknown") ? data.provider : dp;
      setProvider(resolvedProvider);

      if (!data.title) {
        setConfirmInitial({
          url: trimmed,
          provider: resolvedProvider,
          title: data.title,
          posterUrl: data.posterUrl,
          runtimeMinutes: data.runtimeMinutes,
          type: dp === "youtube" ? "video" : "movie",
          debugMessage: data.error?.message ?? "Could not fetch details for this link.",
        });
        setConfirmOpen(true);
        return;
      }

      setTitle(data.title);
      if (data.posterUrl) setPosterUrl(data.posterUrl);
      if (data.runtimeMinutes) setRuntimeMinutes(data.runtimeMinutes);
      if (data.releaseYear) setReleaseYear(data.releaseYear);
      if (data.description && !notes.trim()) setNotes(data.description);

      // Detect type from Cloud Function mediaType
      if (data.mediaType === "movie") setType("movie");
      else if (data.mediaType === "tv") setType("series");
      else if (dp === "youtube") setType("video");

      // Store TMDB metadata
      setMetadata({
        ...(data.tmdbId ? { tmdb_id: data.tmdbId } : {}),
        ...(data.backdropUrl ? { backdrop_url: data.backdropUrl } : {}),
      });

      // Advance to step 2
      setStep("confirm");
    } catch (error: any) {
      const dp2 = detectProvider(trimmed);
      setConfirmInitial({ url: trimmed, provider: dp2, type: dp2 === "youtube" ? "video" : "movie", debugMessage: error?.message });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a title.", variant: "destructive" });
      return;
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
      metadata,
    });
  };

  // ── Render: Step 1 — Paste ───────────────────────────────────────
  if (step === "paste") {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
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
            <Button variant="outline" onClick={() => setStep("confirm")}>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 lg:px-8 flex items-center gap-4 h-16">
          <Button variant="ghost" size="icon" onClick={() => setStep("paste")}>
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
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
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

              {/* Mood tags — Hick's Law: show subset by default */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mood Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllMoods ? MOOD_OPTIONS : MOOD_OPTIONS.slice(0, MOOD_DEFAULT_VISIBLE)).map((mood) => (
                    <Badge
                      key={mood}
                      variant={selectedMoods.includes(mood) ? "default" : "outline"}
                      className="cursor-pointer select-none text-xs transition-colors"
                      onClick={() => handleMoodToggle(mood)}
                    >
                      {getMoodEmoji(mood)} {mood}
                    </Badge>
                  ))}
                  <Badge
                    variant="outline"
                    className="cursor-pointer select-none text-xs text-muted-foreground border-dashed transition-colors hover:border-solid"
                    onClick={() => setShowAllMoods((v) => !v)}
                  >
                    {showAllMoods ? "Show less" : `+${MOOD_OPTIONS.length - MOOD_DEFAULT_VISIBLE} more`}
                  </Badge>
                </div>
                {selectedMoods.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedMoods.length} selected</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Why do you want to watch this? Any thoughts…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* More options (collapsible) */}
              <Collapsible open={moreOptionsOpen} onOpenChange={setMoreOptionsOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-1">
                    <ChevronRight className={cn("w-4 h-4 transition-transform", moreOptionsOpen && "rotate-90")} />
                    {moreOptionsOpen ? "Fewer options" : "More options"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-3">
                  {/* Poster URL (hidden from main view — power user option) */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Poster URL</Label>
                    <Input
                      type="url"
                      placeholder="https://…"
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Custom tags */}
                  <div className="space-y-2">
                    <Label className="text-sm">Custom Tags</Label>
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
                            <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attachments */}
                  <div className="space-y-2">
                    <Label className="text-sm">Attachments</Label>
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
                        <p className="text-xs text-muted-foreground">Click to upload images or PDFs</p>
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
                </CollapsibleContent>
              </Collapsible>
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
            ) : "Save to Watchlist"}
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
