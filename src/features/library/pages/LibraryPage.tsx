import { Link } from "react-router-dom";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildLibraryGroups } from "../model";
import { useLibraryBookmarks } from "../useLibraryBookmarks";
import { LibraryRail } from "../components/LibraryRail";

export default function LibraryPage() {
  const query = useLibraryBookmarks();
  const bookmarks = query.data?.pages.flatMap((page) => page.bookmarks) ?? [];
  const uniqueBookmarks = [...new Map(bookmarks.map((bookmark) => [bookmark.id, bookmark])).values()];
  const groups = buildLibraryGroups(uniqueBookmarks);

  if (query.isLoading) {
    return <main className="flex min-h-screen items-center justify-center pt-[72px]"><Loader2 className="h-6 w-6 animate-spin text-white/50" aria-label="Loading library" /></main>;
  }

  return (
    <main className="min-h-screen pb-24 pt-[72px] text-white">
      {groups.watchNext ? (
        <section className="relative min-h-[42vh] overflow-hidden border-b border-white/[0.06] px-5 py-12 sm:px-10 lg:px-14" aria-labelledby="watch-next-title">
          {groups.watchNext.backdrop_url && <img src={groups.watchNext.backdrop_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
          <div className="relative max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Watch this next</p>
            <h1 id="watch-next-title" className="text-4xl font-black sm:text-6xl">{groups.watchNext.title}</h1>
            <p className="mt-4 max-w-xl text-white/65">The strongest next pick from your saved library.</p>
            <Button asChild className="mt-7"><Link to={`/b/${groups.watchNext.id}`}>Open details</Link></Button>
          </div>
        </section>
      ) : groups.allSaved.length === 0 && !query.isError ? (
        <section className="px-5 py-16 text-center sm:px-10">
          <h1 className="text-3xl font-bold">Your library is ready for its first save</h1>
          <p className="mx-auto mt-3 max-w-lg text-white/55">Paste a link or add a title manually. Saved items stay separate from recommendations.</p>
          <Button asChild className="mt-6"><Link to="/new"><Plus className="mr-2 h-4 w-4" />Add a title</Link></Button>
        </section>
      ) : null}

      <div className="space-y-10 px-5 py-10 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Your saved library</h1>
          <Button asChild variant="outline"><Link to="/search"><Search className="mr-2 h-4 w-4" />Search saved</Link></Button>
        </div>
        <LibraryRail title="Continue Watching" bookmarks={groups.continueWatching} />
        <LibraryRail title="Recently Saved" bookmarks={groups.recentlySaved} />
        {groups.savedByGenreOrMood.map((group) => <LibraryRail key={group.title} title={group.title} bookmarks={group.bookmarks} />)}
        <LibraryRail title="Needs Attention" bookmarks={groups.unresolved} />
        <LibraryRail title="All saved" bookmarks={groups.allSaved} />
        {query.hasNextPage && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
              {query.isFetchingNextPage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading</> : "Load more saved titles"}
            </Button>
          </div>
        )}
        {query.isError && <p role="alert" className="text-sm text-destructive">Could not load your saved library. Try again.</p>}
      </div>
    </main>
  );
}
