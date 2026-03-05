import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link as LinkIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, detectProvider, extractYouTubeVideoId } from "@/lib/utils";
import { auth, fbFunctions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { bookmarkService } from "@/services/bookmarks";
import { ConfirmMetadataDialog, type ConfirmMetadataPayload } from "@/components/bookmarks/ConfirmMetadataDialog";
import {
  enrichWithYouTube,
  enrichWithTMDB,
  enrichWithInstagram,
  enrichWithFacebook,
  enrichWithTwitter,
  enrichWithTikTok,
  enrichWithReddit,
  enrichWithLetterboxd,
  enrichWithRottenTomatoes,
  extractYouTubeVideoId as enrichExtractYT,
} from "@/services/enrichment";
import { toast } from "sonner";
import type { Bookmark } from "@/types/database";

const PROVIDER_STYLES: Record<string, { label: string; dot: string }> = {
  youtube:   { label: "YouTube",    dot: "bg-red-600" },
  instagram: { label: "Instagram",  dot: "bg-pink-500" },
  facebook:  { label: "Facebook",   dot: "bg-blue-600" },
  x:         { label: "X / Twitter",dot: "bg-neutral-400" },
  netflix:   { label: "Netflix",    dot: "bg-red-700" },
  imdb:      { label: "IMDB",       dot: "bg-yellow-500" },
  generic:   { label: "Website",    dot: "bg-muted-foreground" },
};

interface QuickAddBarProps {
  className?: string;
}

export function QuickAddBar({ className }: QuickAddBarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [isEnriching, setIsEnriching] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInitial, setConfirmInitial] = useState<ConfirmMetadataPayload>({ url: "" });

  const detectedProvider = url.trim() ? detectProvider(url.trim()) : null;
  const providerInfo = detectedProvider ? PROVIDER_STYLES[detectedProvider] : null;

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof bookmarkService.createBookmark>[0]) =>
      bookmarkService.createBookmark(data),
    onSuccess: (bookmark) => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      setUrl("");
      toast.success(`"${bookmark.title}" saved to your watchlist!`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Could not save bookmark.");
    },
  });

  const handleConfirmMetadata = (data: {
    url: string;
    provider?: string;
    title: string;
    posterUrl?: string;
    runtimeMinutes: number | null;
    type: Bookmark["type"];
  }) => {
    createMutation.mutate({
      title: data.title,
      type: data.type,
      provider: (data.provider as Bookmark["provider"]) || "generic",
      source_url: data.url || null,
      canonical_url: null,
      runtime_minutes: data.runtimeMinutes,
      release_year: null,
      poster_url: data.posterUrl || null,
      notes: null,
      tags: [],
      mood_tags: [],
      status: "backlog",
      metadata: {},
    });
  };

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setIsEnriching(true);
    const dp = detectProvider(trimmed);

    try {
      // Use Firebase Callable Cloud Function
      try {
        const enrichCallable = httpsCallable(fbFunctions, 'enrich');
        const result = await enrichCallable({ url: trimmed });
        const data = result.data as any;

        const resolvedProvider = data.provider === "unknown" ? dp : data.provider;

        setConfirmInitial({
          url: trimmed,
          provider: resolvedProvider,
          title: data.title,
          posterUrl: data.posterUrl,
          runtimeMinutes: data.runtimeMinutes ?? null,
          type: dp === "youtube" ? "video" : "movie",
          blocked: data.blocked,
          debugMessage: data.error?.message,
        });
        setConfirmOpen(true);
        return;
      } catch (err) {
        // Remote enrichment failed, fall through to local enrichment
        console.warn("Remote enrichment failed, falling back to local enrichment", err);
      }

      // Fallback to local enrichment
      let enrichedData: {
        title?: string;
        posterUrl?: string;
        runtimeMinutes?: number | null;
      } = {};

      if (dp === "youtube") {
        // Try YouTube enrichment
        const videoId = enrichExtractYT(trimmed);
        if (videoId) {
          try {
            const ytData = await enrichWithYouTube(videoId);
            if (ytData) {
              enrichedData = {
                title: ytData.title,
                posterUrl: ytData.thumbnail_url || undefined,
                runtimeMinutes: ytData.duration_minutes,
              };
            }
          } catch (err) {
            console.warn("YouTube enrichment failed:", err);
          }
        }
      } else if (dp === "instagram") {
        try {
          const igData = await enrichWithInstagram(trimmed);
          if (igData) {
            enrichedData = {
              title: igData.title || undefined,
              posterUrl: igData.thumbnail_url || undefined,
              runtimeMinutes: null,
            };
          }
        } catch (err) {
          console.warn("Instagram enrichment failed:", err);
        }
      } else if (dp === "facebook") {
        try {
          const fbData = await enrichWithFacebook(trimmed);
          if (fbData) {
            enrichedData = {
              title: fbData.title || undefined,
              posterUrl: fbData.thumbnail_url || undefined,
              runtimeMinutes: null,
            };
          }
        } catch (err) {
          console.warn("Facebook enrichment failed:", err);
        }
      } else if (dp === "x") {
        try {
          const twitterData = await enrichWithTwitter(trimmed);
          if (twitterData) {
            enrichedData = {
              title: twitterData.title || undefined,
              posterUrl: twitterData.thumbnail_url || undefined,
              runtimeMinutes: null,
            };
          }
        } catch (err) {
          console.warn("Twitter enrichment failed:", err);
        }
      } else if (dp === "tiktok") {
        try {
          const ttData = await enrichWithTikTok(trimmed);
          if (ttData) {
            enrichedData = {
              title: ttData.title || undefined,
              posterUrl: ttData.thumbnail_url || undefined,
              runtimeMinutes: null,
            };
          }
        } catch (err) {
          console.warn("TikTok enrichment failed:", err);
        }
      } else if (dp === "reddit") {
        try {
          const redditData = await enrichWithReddit(trimmed);
          if (redditData) {
            enrichedData = {
              title: redditData.title || undefined,
              posterUrl: redditData.thumbnail_url || undefined,
              runtimeMinutes: null,
            };
          }
        } catch (err) {
          console.warn("Reddit enrichment failed:", err);
        }
      } else if (dp === "letterboxd") {
        try {
          const lbData = await enrichWithLetterboxd(trimmed);
          if (lbData) {
            enrichedData = {
              title: lbData.title || undefined,
              posterUrl: lbData.thumbnail_url || undefined,
              runtimeMinutes: null,
            };
          }
        } catch (err) {
          console.warn("Letterboxd enrichment failed:", err);
        }
      } else if (dp === "rottentomatoes") {
        try {
          const rtData = await enrichWithRottenTomatoes(trimmed);
          if (rtData) {
            enrichedData = {
              title: rtData.title || undefined,
              posterUrl: rtData.thumbnail_url || undefined,
              runtimeMinutes: null,
            };
          }
        } catch (err) {
          console.warn("Rotten Tomatoes enrichment failed:", err);
        }
      } else if (dp === "netflix" || dp === "imdb") {
        // For other providers, try to extract title from URL or use TMDB
        let possibleTitle: string | undefined;
        
        // Try to extract from URL patterns
        if (dp === "imdb") {
          // IMDb URL patterns: /title/tt1234567 or ?title=Movie%20Name
          const idMatch = trimmed.match(/\/title\/(tt\d+)/);
          if (idMatch) {
            possibleTitle = idMatch[1];
          }
        } else if (dp === "netflix") {
          // Netflix URL patterns: /watch/1234567 or contains show/movie name
          possibleTitle = trimmed.match(/\/watch\/(\d+)|\/[a-z-]+\/([0-9]+)|title=([^&]*)/i)?.[3];
        }
        
        // Try TMDB enrichment if we have a potential title
        if (possibleTitle) {
          try {
            const tmdbData = await enrichWithTMDB(possibleTitle, "movie");
            if (tmdbData) {
              enrichedData = {
                title: possibleTitle,
                posterUrl: tmdbData.poster_url || undefined,
                runtimeMinutes: null,
              };
            }
          } catch (err) {
            console.warn("TMDB enrichment failed:", err);
          }
        }
      }

      setConfirmInitial({
        url: trimmed,
        provider: dp,
        title: enrichedData.title,
        posterUrl: enrichedData.posterUrl,
        runtimeMinutes: enrichedData.runtimeMinutes,
        type: dp === "youtube" ? "video" : "movie",
        blocked: false,
        debugMessage: enrichedData.title ? undefined : "Could not fetch details automatically.",
      });
      setConfirmOpen(true);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && url.trim()) {
      handleFetch();
    }
    if (e.key === "Escape") {
      setUrl("");
    }
  };

  const canSave = Boolean(url.trim()) && !isEnriching && !createMutation.isPending;

  return (
    <>
      <div className={cn("w-full", className)}>
        <div className="relative flex items-center gap-2 bg-wm-surface border border-border rounded-xl px-4 py-3 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
          {/* Provider dot or default link icon */}
          {providerInfo ? (
            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 transition-colors", providerInfo.dot)} />
          ) : (
            <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          )}

          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a YouTube, Instagram, or Facebook link to save…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
            aria-label="Paste URL to save"
          />

          {/* Provider label */}
          {providerInfo && url.trim() && (
            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
              {providerInfo.label} detected
            </span>
          )}

          {/* Clear button */}
          {url && (
            <button
              type="button"
              onClick={() => { setUrl(""); inputRef.current?.focus(); }}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              aria-label="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <Button
            size="sm"
            disabled={!canSave}
            onClick={handleFetch}
            className="shrink-0 h-8 text-xs"
          >
            {isEnriching || createMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : "Save"}
          </Button>
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground mt-1.5 px-1">
          Or{" "}
          <button
            type="button"
            onClick={() => navigate("/new")}
            className="text-primary hover:underline"
          >
            add manually
          </button>{" "}
          for more options
        </p>
      </div>

      <ConfirmMetadataDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        initial={confirmInitial}
        onConfirm={handleConfirmMetadata}
      />
    </>
  );
}
