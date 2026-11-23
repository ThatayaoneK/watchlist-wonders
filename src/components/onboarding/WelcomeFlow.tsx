import { useMemo, useState } from "react";
import { ArrowRight, Check, Link2, Sparkles, X, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getSafeErrorMessage } from "@/lib/errorMessage";
import { toast } from "sonner";
import { getProviderMeta } from "@/constants/providers";
import type { Bookmark } from "@/types/database";
import { storage } from "@/lib/storage";

const GENRE_OPTIONS = [
  "Action",
  "Comedy",
  "Drama",
  "Sci-Fi",
  "Thriller",
  "Animation",
  "Documentary",
  "Fantasy",
  "Romance",
] as const;

// Extended provider list — provider key maps to PROVIDER_META for logos
const PROVIDER_OPTIONS = [
  { key: "netflix",    label: "Netflix" },
  { key: "primevideo", label: "Prime Video" },
  { key: "disneyplus", label: "Disney+" },
  { key: "youtube",    label: "YouTube" },
  { key: "hbomax",     label: "Max (HBO)" },
  { key: "appletv",    label: "Apple TV+" },
  { key: "peacock",    label: "Peacock" },
  { key: "tiktok",     label: "TikTok" },
  { key: "imdb",       label: "IMDb" },
  { key: "instagram",  label: "Instagram" },
] as const;

// Persist provider selections to dashboard filters so WatchBar pre-populates
const FILTER_STORAGE_KEY = "wm_dashboard_filters";

function saveProvidersToFilters(providerKeys: string[]) {
  const existing = storage.get<Record<string, unknown>>(FILTER_STORAGE_KEY, { fallback: {} });
  storage.set(FILTER_STORAGE_KEY, { ...existing, providers: providerKeys });
}

export interface OnboardingSuggestion {
  id: string;
  title: string;
  type: Bookmark["type"];
  provider: Bookmark["provider"];
  release_year: number;
  poster_url: string | null;
  genres: string[];
  providers: string[];
}

const SUGGESTION_POOL: OnboardingSuggestion[] = [
  { id: "dune-2", title: "Dune: Part Two", type: "movie", provider: "generic", release_year: 2024, poster_url: "https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg", genres: ["Sci-Fi", "Action"], providers: ["Prime Video", "HBO Max"] },
  { id: "inside-out-2", title: "Inside Out 2", type: "movie", provider: "generic", release_year: 2024, poster_url: "https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg", genres: ["Animation", "Comedy"], providers: ["Disney+"] },
  { id: "the-bear", title: "The Bear", type: "series", provider: "generic", release_year: 2022, poster_url: "https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg", genres: ["Drama", "Comedy"], providers: ["Disney+"] },
  { id: "oppenheimer", title: "Oppenheimer", type: "movie", provider: "generic", release_year: 2023, poster_url: "https://image.tmdb.org/t/p/w500/ptpr0kGAckfQkJeJIt8st5dglvd.jpg", genres: ["Drama", "Thriller"], providers: ["Prime Video"] },
  { id: "severance", title: "Severance", type: "series", provider: "generic", release_year: 2022, poster_url: "https://image.tmdb.org/t/p/w500/9Pf0zMgWaD6LqF8i8K2J6U4Xj5D.jpg", genres: ["Sci-Fi", "Thriller"], providers: ["HBO Max"] },
  { id: "fallout", title: "Fallout", type: "series", provider: "generic", release_year: 2024, poster_url: "https://image.tmdb.org/t/p/w500/AnsSKR9LuK0T9bAOcPVA3PUvyWj.jpg", genres: ["Sci-Fi", "Action"], providers: ["Prime Video"] },
  { id: "arcane", title: "Arcane", type: "series", provider: "netflix", release_year: 2021, poster_url: "https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg", genres: ["Animation", "Action"], providers: ["Netflix"] },
  { id: "glass-onion", title: "Glass Onion", type: "movie", provider: "netflix", release_year: 2022, poster_url: "https://image.tmdb.org/t/p/w500/vDGr1YdrlfbU9wxTOdpf3zChmv9.jpg", genres: ["Comedy", "Thriller"], providers: ["Netflix"] },
  { id: "our-planet", title: "Our Planet", type: "series", provider: "netflix", release_year: 2019, poster_url: "https://image.tmdb.org/t/p/w500/6Y0w2s5Qd8P3FWo8Z2s2Q7m7W1S.jpg", genres: ["Documentary"], providers: ["Netflix"] },
  { id: "blade-runner-2049", title: "Blade Runner 2049", type: "movie", provider: "generic", release_year: 2017, poster_url: "https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg", genres: ["Sci-Fi", "Drama"], providers: ["Prime Video"] },
];

function rankSuggestion(
  suggestion: OnboardingSuggestion,
  selectedGenres: string[],
  selectedProviders: string[],
): number {
  const genreHits = suggestion.genres.filter((genre) => selectedGenres.includes(genre)).length;
  const providerHits = suggestion.providers.filter((provider) => selectedProviders.includes(provider)).length;
  return genreHits * 3 + providerHits * 2;
}

interface WelcomeFlowProps {
  open: boolean;
  onDismiss: () => void;
  onAddSuggestion: (suggestion: OnboardingSuggestion) => Promise<void>;
  onComplete: (payload: { genres: string[]; providers: string[]; addedSuggestionIds: string[] }) => Promise<void> | void;
}

export function WelcomeFlow({ open, onDismiss, onAddSuggestion, onComplete }: WelcomeFlowProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    return [...SUGGESTION_POOL]
      .sort((a, b) => rankSuggestion(b, genres, providers) - rankSuggestion(a, genres, providers))
      .slice(0, 3);
  }, [genres, providers]);

  if (!open) return null;

  const toggleTag = (value: string, selected: string[], setSelected: (next: string[]) => void) => {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const handleAdd = async (suggestion: OnboardingSuggestion) => {
    setPendingSuggestionId(suggestion.id);
    try {
      await onAddSuggestion(suggestion);
      setAddedIds((current) => (current.includes(suggestion.id) ? current : [...current, suggestion.id]));
    } catch (error) {
      toast.error(getSafeErrorMessage(error, "Couldn't add this title. Please try again."));
    } finally {
      setPendingSuggestionId(null);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      // Pre-populate WatchBar with selected providers
      if (providers.length > 0) {
        saveProvidersToFilters(providers);
      }
      await onComplete({
        genres,
        providers,
        addedSuggestionIds: addedIds,
      });
    } catch (error) {
      toast.error(getSafeErrorMessage(error, "Couldn't complete setup. Please try again."));
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-background/90 backdrop-blur-sm px-4 py-6 flex items-center justify-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 md:p-8">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Dismiss onboarding"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-2">
            Welcome
          </p>
          <h2 className="text-2xl font-bold text-foreground">Set up your watchlist in 3 quick steps</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pick your taste, then add suggested titles in one tap.
          </p>
        </div>

        {/* Step 0 — Provider selection FIRST (powers all personalization) */}
        {step === 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Where do you watch?</h3>
            <p className="text-xs text-muted-foreground mb-3">Select the services you have — we'll prioritize your content.</p>
            <div className="flex flex-wrap gap-2">
              {PROVIDER_OPTIONS.map(({ key, label }) => {
                const selected = providers.includes(key);
                const meta = getProviderMeta(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTag(key, providers, setProviders)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "bg-primary/10 text-primary border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/60",
                    )}
                  >
                    {meta.logoUrl ? (
                      <img src={meta.logoUrl} alt="" className="w-4 h-4 object-contain rounded-sm" loading="lazy" />
                    ) : (
                      <span className={cn("w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold text-white", meta.color)}>
                        {label.charAt(0)}
                      </span>
                    )}
                    {label}
                    {selected && <Check className="w-3 h-3 ml-0.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1 — Genre / taste selection */}
        {step === 1 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">What do you love watching?</h3>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((genre) => {
                const selected = genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleTag(genre, genres, setGenres)}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/60",
                    )}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Add a few to get started</h3>
            <div className="grid gap-3">
              {suggestions.map((suggestion) => {
                const added = addedIds.includes(suggestion.id);
                const pending = pendingSuggestionId === suggestion.id;
                return (
                  <div
                    key={suggestion.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3"
                  >
                    <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                      {suggestion.poster_url ? (
                        <img src={suggestion.poster_url} alt={suggestion.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.release_year} • {suggestion.type === "series" ? "Series" : "Movie"}
                      </p>
                    </div>
                    <Button
                      variant={added ? "secondary" : "default"}
                      size="sm"
                      disabled={added || pending}
                      onClick={() => handleAdd(suggestion)}
                    >
                      {added ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Added
                        </>
                      ) : pending ? "Adding..." : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
              <Link2 className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-muted-foreground flex-1">
                See something on TikTok or YouTube?{" "}
                <button
                  type="button"
                  onClick={() => { onDismiss(); navigate("/new"); }}
                  className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
                >
                  Paste the link
                </button>{" "}
                — we'll find the movie automatically.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3">
              <FileDown className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground flex-1">
                Already have an IMDb watchlist?{" "}
                <button
                  type="button"
                  onClick={() => { onDismiss(); navigate("/import"); }}
                  className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
                >
                  Import it in seconds
                </button>
                {" "}— no manual entry needed.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={cn("h-1.5 rounded-full transition-all", index === step ? "w-6 bg-primary" : "w-2 bg-muted")}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((value) => value - 1)}>
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep((value) => value + 1)}>
                Next
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={isCompleting}>
                <Sparkles className="w-4 h-4 mr-1.5" />
                {isCompleting ? "Finishing..." : "Finish setup"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
