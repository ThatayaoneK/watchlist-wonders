import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookmarkPlus, Clock, Film, Play, Search, Tv, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSimilarTitles, type SimilarTitle } from "@/hooks/useSimilarTitles";
import { bookmarkService } from "@/services/bookmarks";
import { cn } from "@/lib/utils";
import type { Bookmark as BookmarkRecord } from "@/types/database";

interface Bookmark {
  id: string;
  title: string;
  poster_url?: string | null;
  type: string;
  provider: string;
  runtime_minutes?: number | null;
  release_year?: number | null;
  tags?: string[];
  mood_tags?: string[];
  metadata?: Record<string, unknown>;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
}

const MAX_RESULTS = 20;
const FALLBACK_THRESHOLD = 3;
const QUICK_INTENTS = ["Anime", "Action", "Comedy", "Short", "Tonight", "Drama"];

function getMetadataTmdbId(bookmark: Bookmark | null): number | null {
  if (!bookmark?.metadata || typeof bookmark.metadata !== "object") return null;
  const raw = bookmark.metadata.tmdb_id ?? bookmark.metadata.tmdbId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toBookmarkType(mediaType: SimilarTitle["media_type"]): BookmarkRecord["type"] {
  return mediaType === "tv" ? "series" : "movie";
}

function toTmdbSourceUrl(item: SimilarTitle): string {
  const media = item.media_type === "tv" ? "tv" : "movie";
  return `https://www.themoviedb.org/${media}/${item.id}`;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  movie: Film,
  series: Tv,
  episode: Tv,
  video: Play,
};

export function SearchOverlay({ isOpen, onClose, bookmarks }: SearchOverlayProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Bookmark[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
      setSelectedIndex(-1);
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSelectedIndex(-1); return; }
    let active = true;
    const trimmed = query.trim();
    const localResults = (() => {
      const term = trimmed.toLowerCase();
      return bookmarks
        .filter(
          (b) =>
            b.title.toLowerCase().includes(term) ||
            b.type.toLowerCase().includes(term) ||
            b.provider.toLowerCase().includes(term) ||
            (b.tags ?? []).some((tag) => tag.toLowerCase().includes(term)) ||
            (b.mood_tags ?? []).some((mood) => mood.toLowerCase().includes(term)),
        )
        .slice(0, MAX_RESULTS);
    })();
    setResults(localResults);
    setSelectedIndex(-1);

    const timer = window.setTimeout(() => {
      bookmarkService
        .semanticSearch(trimmed, { topK: MAX_RESULTS })
        .then((semantic) => {
          if (!active || !semantic.length) return;
          const localById = new Map(bookmarks.map((b) => [b.id, b]));
          const merged: Bookmark[] = semantic
            .map((r): Bookmark | null => {
              const local = localById.get(r.id);
              if (local) return local;
              return {
                id: r.id,
                title: r.title,
                poster_url: r.poster_url ?? null,
                type: r.type,
                provider: r.provider,
                tags: r.tags,
                mood_tags: [],
                metadata: undefined,
              };
            })
            .filter((b): b is Bookmark => b !== null);
          if (merged.length) {
            setResults(merged.slice(0, MAX_RESULTS));
          }
        })
        .catch(() => {
          // Silent — local results already shown.
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, bookmarks]);

  const recommendationSeed = results[0] ?? null;
  const recommendationSeedTmdbId = getMetadataTmdbId(recommendationSeed);
  const recommendationSeedType =
    recommendationSeed?.type === "series" || recommendationSeed?.type === "episode" ? "tv" : "movie";

  const { data: similarTitles = [] } = useSimilarTitles(recommendationSeedTmdbId, recommendationSeedType);

  const recommendationItems = useMemo(() => {
    const existingTmdbIds = new Set<number>();
    const existingTitles = new Set<string>();
    for (const bookmark of bookmarks) {
      const tmdbId = getMetadataTmdbId(bookmark);
      if (tmdbId) existingTmdbIds.add(tmdbId);
      existingTitles.add(bookmark.title.trim().toLowerCase());
    }
    return similarTitles
      .filter((item) => !existingTmdbIds.has(item.id))
      .filter((item) => !existingTitles.has(item.title.trim().toLowerCase()))
      .slice(0, 6);
  }, [similarTitles, bookmarks]);

  const saveRecommendationMutation = useMutation({
    mutationFn: async (item: SimilarTitle) =>
      bookmarkService.createBookmark({
        title: item.title,
        type: toBookmarkType(item.media_type),
        provider: "generic",
        source_url: toTmdbSourceUrl(item),
        canonical_url: toTmdbSourceUrl(item),
        poster_url: item.posterUrl ?? null,
        release_year: item.release_year ?? null,
        status: "backlog",
        tags: ["recommendation"],
        mood_tags: [],
        metadata: {
          tmdb_id: item.id,
          recommendation_source: "tmdb_similar_titles",
          vote_average: item.vote_average,
          media_type: item.media_type,
        },
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Saved", description: `"${saved.title}" added to your list.` });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Couldn't save recommendation right now.", variant: "destructive" });
    },
  });

  const handleSelect = (bookmark: Bookmark) => { navigate(`/b/${bookmark.id}`); onClose(); };
  const handleSaveNew = () => { navigate(`/new?title=${encodeURIComponent(query.trim())}`); onClose(); };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (results.length === 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1)); }
      else if (e.key === "Enter" && selectedIndex >= 0) { e.preventDefault(); handleSelect(results[selectedIndex]); }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose, results, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const showFallback = query.trim().length > 0 && results.length < FALLBACK_THRESHOLD;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-2xl"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative mx-auto mt-[8vh] w-full max-w-[860px] px-4 animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Container */}
        <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0e0e10]/95 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">

          {/* Input row */}
          <div className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-5">
            <Search size={20} className="text-zinc-500 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your saved list…"
              className="w-full bg-transparent text-[17px] text-white outline-none placeholder:text-zinc-500"
              aria-label="Search bookmarks"
            />
            <div className="flex items-center gap-2 shrink-0">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-full border border-white/[0.08] px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:text-white"
                aria-label="Close search"
              >
                ESC
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[68vh] overflow-y-auto">

            {/* Empty state */}
            {!query.trim() && (
              <div className="p-6">
                <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-zinc-600">
                  Quick search
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {QUICK_INTENTS.map((intent) => (
                    <button
                      key={intent}
                      type="button"
                      onClick={() => setQuery(intent.toLowerCase())}
                      className="group rounded-[18px] border border-white/[0.05] bg-white/[0.02] p-4 text-left transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.08]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-medium text-white/80 group-hover:text-white transition-colors">{intent}</span>
                        <ArrowRight
                          size={14}
                          className="text-zinc-600 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-400"
                        />
                      </div>
                    </button>
                  ))}
                </div>

                {bookmarks.length > 0 && (
                  <p className="mt-5 text-[12px] text-zinc-600">
                    Searching across {bookmarks.length} saved title{bookmarks.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {/* Results */}
            {query.trim() && (
              <div className="p-3">
                {/* From your list */}
                {results.length > 0 ? (
                  <div role="listbox" aria-label="Search results">
                    <p className="mb-2 px-3 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                      From your list
                    </p>
                    {results.map((bookmark, index) => {
                      const Icon = TYPE_ICONS[bookmark.type] ?? FileText;
                      const isSelected = index === selectedIndex;
                      return (
                        <button
                          key={bookmark.id}
                          onClick={() => handleSelect(bookmark)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            "group flex w-full items-center gap-4 rounded-[18px] p-3 text-left transition-colors duration-150",
                            isSelected ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"
                          )}
                          role="option"
                          aria-selected={isSelected}
                        >
                          {/* Poster */}
                          <div className="h-[72px] w-[48px] shrink-0 overflow-hidden rounded-[10px] bg-zinc-800/80">
                            {bookmark.poster_url ? (
                              <img
                                src={bookmark.poster_url}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Icon className="h-4 w-4 text-zinc-600" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-[15px] font-medium text-white">{bookmark.title}</h4>
                            <div className="mt-1 flex items-center gap-2 text-[13px] text-zinc-500">
                              <span className="capitalize">{bookmark.type}</span>
                              <span>·</span>
                              <span className="capitalize">{bookmark.provider}</span>
                              {bookmark.runtime_minutes && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {bookmark.runtime_minutes}m
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <ArrowRight
                            size={16}
                            className="shrink-0 text-zinc-700 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-400"
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-3 py-4">
                    <p className="text-[14px] text-zinc-500">No saved matches for "{query.trim()}".</p>
                    <p className="mt-1 text-[13px] text-zinc-600">Save it once and find it instantly next time.</p>
                  </div>
                )}

                {/* TMDB recommendations */}
                {recommendationItems.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 px-3 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                      You might also like
                    </p>
                    {recommendationItems.map((item) => {
                      const savingId = `${item.media_type}-${item.id}`;
                      const isSaving = saveRecommendationMutation.isPending &&
                        saveRecommendationMutation.variables &&
                        `${saveRecommendationMutation.variables.media_type}-${saveRecommendationMutation.variables.id}` === savingId;
                      return (
                        <div
                          key={savingId}
                          className="flex items-center gap-4 rounded-[18px] p-3 hover:bg-white/[0.03] transition-colors group"
                        >
                          <div className="h-[72px] w-[48px] shrink-0 overflow-hidden rounded-[10px] bg-zinc-800/80">
                            {item.posterUrl ? (
                              <img
                                src={item.posterUrl}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Film className="h-4 w-4 text-zinc-600" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-medium text-white/90">{item.title}</p>
                            <p className="mt-1 text-[13px] text-zinc-500 capitalize">{item.media_type}</p>
                          </div>
                          <button
                            type="button"
                            disabled={!!isSaving}
                            onClick={() => saveRecommendationMutation.mutate(item)}
                            className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-400 transition-all hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
                          >
                            <BookmarkPlus size={13} />
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fallback: save new */}
                {showFallback && recommendationItems.length === 0 && (
                  <div className="mt-3 flex items-center justify-between gap-4 rounded-[18px] border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white">"{query.trim()}"</p>
                      <p className="mt-0.5 text-[12px] text-zinc-500">Not in your list yet — add it now.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveNew}
                      className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-400 transition-all hover:bg-white/[0.07] hover:text-white"
                    >
                      <BookmarkPlus size={13} />
                      Save it
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
