import type { Bookmark } from "@/types/database";

export interface SavedSearchFilters {
  genre?: string;
  provider?: string;
  status?: string;
  mood?: string;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function genres(bookmark: Bookmark): string[] {
  const raw = bookmark.metadata?.genres;
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  let index = 0;
  for (const character of haystack) {
    if (character === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return needle.length > 0 && index === needle.length;
}

export function rankSavedBookmarks(bookmarks: Bookmark[], query: string, filters: SavedSearchFilters): Bookmark[] {
  const term = normalize(query);
  return bookmarks
    .filter((bookmark) => {
      if (filters.provider && bookmark.provider !== filters.provider) return false;
      if (filters.status && bookmark.status !== filters.status) return false;
      if (filters.mood && !bookmark.mood_tags.some((mood) => normalize(mood) === normalize(filters.mood ?? ""))) return false;
      if (filters.genre && !genres(bookmark).some((genre) => normalize(genre) === normalize(filters.genre ?? ""))) return false;
      return true;
    })
    .map((bookmark) => {
      if (!term) return { bookmark, score: 4 };
      const title = normalize(bookmark.title);
      const searchable = [title, bookmark.provider, bookmark.type, ...bookmark.tags, ...bookmark.mood_tags, ...genres(bookmark)].map(normalize);
      if (title === term) return { bookmark, score: 0 };
      if (title.startsWith(term)) return { bookmark, score: 1 };
      if (searchable.some((value) => value.startsWith(term))) return { bookmark, score: 2 };
      if (searchable.some((value) => value.includes(term))) return { bookmark, score: 3 };
      if (fuzzyIncludes(title, term)) return { bookmark, score: 5 };
      return { bookmark, score: Number.POSITIVE_INFINITY };
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.bookmark.title.localeCompare(right.bookmark.title))
    .map(({ bookmark }) => bookmark);
}
