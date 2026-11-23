import type { KeyboardEvent } from "react";
import type { Bookmark } from "@/types/database";
import { LibraryCard } from "./LibraryCard";

export function LibraryRail({ title, bookmarks }: { title: string; bookmarks: Bookmark[] }) {
  if (!bookmarks.length) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[href]")];
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (current < 0) return;
    event.preventDefault();
    links.at(event.key === "ArrowRight" ? Math.min(current + 1, links.length - 1) : Math.max(current - 1, 0))?.focus();
  };

  return (
    <section aria-labelledby={`rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <h2 id={`rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="mb-3 text-xl font-semibold text-white">{title}</h2>
      <div
        className="flex gap-3 overflow-x-auto pb-4 [scrollbar-width:thin]"
        onKeyDown={handleKeyDown}
        aria-label={`${title} saved titles`}
      >
        {bookmarks.map((bookmark) => <LibraryCard key={bookmark.id} bookmark={bookmark} />)}
      </div>
    </section>
  );
}
