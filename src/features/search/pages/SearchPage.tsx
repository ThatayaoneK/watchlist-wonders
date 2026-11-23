import { useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LibraryCard } from "@/features/library/components/LibraryCard";
import { useLibraryBookmarks } from "@/features/library/useLibraryBookmarks";
import { rankSavedBookmarks, type SavedSearchFilters } from "../rankSavedBookmarks";

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

export default function SearchPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const library = useLibraryBookmarks();
  const bookmarks = useMemo(
    () => [...new Map((library.data?.pages.flatMap((page) => page.bookmarks) ?? []).map((item) => [item.id, item])).values()],
    [library.data?.pages],
  );
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SavedSearchFilters>({});
  const results = useMemo(() => rankSavedBookmarks(bookmarks, query, filters), [bookmarks, query, filters]);
  const genres = unique(bookmarks.flatMap((bookmark) => Array.isArray(bookmark.metadata?.genres) ? bookmark.metadata.genres.filter((value): value is string => typeof value === "string") : []));
  const moods = unique(bookmarks.flatMap((bookmark) => bookmark.mood_tags));
  const providers = unique(bookmarks.map((bookmark) => bookmark.provider));

  const updateFilter = (key: keyof SavedSearchFilters, value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));

  return (
    <main className="min-h-screen px-5 pb-24 pt-28 text-white sm:px-10 lg:px-14">
      <header className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your saved library</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Find something you saved</h1>
        <label className="mt-7 flex min-h-12 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
          <Search className="h-5 w-5 text-white/45" aria-hidden="true" />
          <span className="sr-only">Search saved titles</span>
          <input ref={inputRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, genre, mood, or provider" className="w-full bg-transparent py-3 text-base outline-none placeholder:text-white/35" />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Search filters">
          <Filter label="Genre" value={filters.genre} options={genres} onChange={(value) => updateFilter("genre", value)} />
          <Filter label="Provider" value={filters.provider} options={providers} onChange={(value) => updateFilter("provider", value)} />
          <Filter label="Status" value={filters.status} options={["backlog", "watching", "done", "dropped"]} onChange={(value) => updateFilter("status", value)} />
          <Filter label="Mood" value={filters.mood} options={moods} onChange={(value) => updateFilter("mood", value)} />
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-7xl" aria-labelledby="saved-results-title">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="saved-results-title" className="text-xl font-semibold">Saved results</h2>
            <p className="mt-1 text-sm text-white/45">Exact and prefix matches appear before fuzzy matches. Recommendations are not mixed in.</p>
          </div>
          <span className="text-sm text-white/45" aria-live="polite">{results.length} found</span>
        </div>
        {library.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-white/45" aria-label="Loading saved titles" />
        ) : library.isError ? (
          <div role="alert"><p>Could not load your saved titles.</p><Button variant="outline" onClick={() => void library.refetch()}>Try again</Button></div>
        ) : results.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {results.map((bookmark) => <LibraryCard key={bookmark.id} bookmark={bookmark} />)}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/55">No saved titles match yet.</p>
        )}
        {library.hasNextPage && (
          <div className="mt-10 flex flex-col items-center gap-2">
            <Button variant="outline" onClick={() => void library.fetchNextPage()} disabled={library.isFetchingNextPage}>
              {library.isFetchingNextPage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching more</> : "Search more of my library"}
            </Button>
            <p className="text-xs text-white/40">More saved titles remain unloaded so large libraries stay fast.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="text-xs text-white/50">
      <span className="sr-only">{label}</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-white/10 bg-[#19191c] px-3 text-sm capitalize text-white outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <option value="">All {label === "Status" ? "statuses" : `${label.toLowerCase()}s`}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
