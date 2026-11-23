import { Link } from "react-router-dom";
import { Film } from "lucide-react";
import type { Bookmark } from "@/types/database";

export function LibraryCard({ bookmark }: { bookmark: Bookmark }) {
  return (
    <Link
      to={`/b/${bookmark.id}`}
      className="group block w-36 shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-44"
      aria-label={`Open ${bookmark.title}`}
    >
      <div className="aspect-[2/3] overflow-hidden rounded-md bg-white/[0.06]">
        {bookmark.poster_url ? (
          <img
            src={bookmark.poster_url}
            alt={`${bookmark.title} poster`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform [transition-duration:var(--wm-duration-mid)] motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/30" aria-hidden="true">
            <Film className="h-9 w-9" />
          </div>
        )}
      </div>
      <span className="mt-2 block truncate text-sm font-medium text-white">{bookmark.title}</span>
      <span className="block truncate text-xs capitalize text-white/45">{bookmark.type}</span>
    </Link>
  );
}
