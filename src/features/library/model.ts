import type { Bookmark } from "@/types/database";

export interface LibraryGroup {
  title: string;
  bookmarks: Bookmark[];
}

function timestamp(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function genresFor(bookmark: Bookmark): string[] {
  const raw = bookmark.metadata?.genres;
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === "string");
  return [];
}

export function isUnresolvedBookmark(bookmark: Bookmark): boolean {
  return bookmark.enriched === false || Boolean(bookmark.enrich_fail_reason)
    || ["unresolved", "needs_selection", "pending", "failed"].includes(String(bookmark.metadata?.resolution_status));
}

export function buildLibraryGroups(bookmarks: Bookmark[]): {
  watchNext: Bookmark | null;
  continueWatching: Bookmark[];
  recentlySaved: Bookmark[];
  savedByGenreOrMood: LibraryGroup[];
  unresolved: Bookmark[];
  allSaved: Bookmark[];
} {
  const saved = bookmarks.filter((bookmark) => !bookmark.is_vaulted);
  const watchNext = [...saved]
    .filter((bookmark) => bookmark.status === "backlog" || bookmark.queue_status === "up_next")
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || timestamp(right.created_at) - timestamp(left.created_at))[0] ?? null;
  const continueWatching = saved.filter((bookmark) => bookmark.status === "watching" || bookmark.queue_status === "in_progress");
  const recentlySaved = [...saved].sort((left, right) => timestamp(right.created_at) - timestamp(left.created_at)).slice(0, 20);
  const unresolved = saved.filter(isUnresolvedBookmark);
  const buckets = new Map<string, Bookmark[]>();

  for (const bookmark of saved) {
    const labels = [...genresFor(bookmark), ...bookmark.mood_tags].filter(Boolean);
    for (const label of new Set(labels)) {
      const normalized = label.trim();
      if (!normalized) continue;
      buckets.set(normalized, [...(buckets.get(normalized) ?? []), bookmark]);
    }
  }

  const savedByGenreOrMood = [...buckets.entries()]
    .filter(([, items]) => items.length >= 2)
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([title, items]) => ({ title, bookmarks: items }));

  const allSaved = [...saved].sort((left, right) => timestamp(right.created_at) - timestamp(left.created_at));
  return { watchNext, continueWatching, recentlySaved, savedByGenreOrMood, unresolved, allSaved };
}
