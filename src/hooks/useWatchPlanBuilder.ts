import { useState, useMemo, useCallback } from "react";
import type { Bookmark } from "@/types/database";

export type BuilderItem = {
  id: string;
  title: string;
  type: string;
  poster_url: string | null;
  runtime_minutes: number | null;
  status: string;
  mood_tags: string[];
};

export type VibeType = "movie-night" | "binge-series" | "quick-watch" | "surprise-me" | "custom";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function autoGenerateName(items: BuilderItem[]): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = days[new Date().getDay()];
  const hasMovies = items.some((i) => i.type === "movie");
  const hasSeries = items.some((i) => i.type === "series" || i.type === "episode");
  if (hasMovies && !hasSeries) return `${day} Movie Night`;
  if (hasSeries && !hasMovies) return `${day} Series Night`;
  if (items.length === 0) return "My Watch Plan";
  return `${day} Watch Session`;
}

function pickItems(vibe: VibeType, bookmarks: Bookmark[]): BuilderItem[] {
  if (vibe === "custom") return [];

  const pool = bookmarks.filter((b) => b.status === "backlog" || b.status === "watching");

  let filtered: Bookmark[];
  let count: number;

  switch (vibe) {
    case "movie-night":
      filtered = pool.filter((b) => b.type === "movie");
      count = 2;
      break;
    case "binge-series":
      filtered = pool.filter((b) => b.type === "series" || b.type === "episode");
      count = 4;
      break;
    case "quick-watch":
      filtered = pool.filter((b) => b.runtime_minutes !== null && b.runtime_minutes <= 60);
      if (filtered.length < 2) filtered = pool;
      count = 3;
      break;
    case "surprise-me":
    default:
      filtered = pool;
      count = 3;
      break;
  }

  if (filtered.length < count) filtered = pool;

  return shuffleArray(filtered)
    .slice(0, count)
    .map((b) => ({
      id: b.id,
      title: b.title,
      type: b.type,
      poster_url: b.poster_url,
      runtime_minutes: b.runtime_minutes,
      status: b.status,
      mood_tags: b.mood_tags,
    }));
}

export function useWatchPlanBuilder(allBookmarks: Bookmark[]) {
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [customName, setCustomName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [startTime, setStartTime] = useState("20:00");

  const totalMinutes = useMemo(
    () => items.reduce((acc, i) => acc + (i.runtime_minutes ?? 0), 0),
    [items]
  );

  const autoName = useMemo(() => autoGenerateName(items), [items]);
  const name = nameEdited ? customName : autoName;

  const load = useCallback(
    (vibe: VibeType) => {
      setItems(pickItems(vibe, allBookmarks));
      setNameEdited(false);
    },
    [allBookmarks]
  );

  const shuffle = useCallback(
    (vibe: VibeType) => {
      setItems(pickItems(vibe, allBookmarks));
    },
    [allBookmarks]
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addItem = useCallback((bookmark: Bookmark) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === bookmark.id)) return prev;
      return [
        ...prev,
        {
          id: bookmark.id,
          title: bookmark.title,
          type: bookmark.type,
          poster_url: bookmark.poster_url,
          runtime_minutes: bookmark.runtime_minutes,
          status: bookmark.status,
          mood_tags: bookmark.mood_tags,
        },
      ];
    });
  }, []);

  const setName = useCallback((n: string) => {
    setCustomName(n);
    setNameEdited(true);
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setCustomName("");
    setNameEdited(false);
    setStartTime("20:00");
  }, []);

  return {
    items,
    name,
    setName,
    startTime,
    setStartTime,
    totalMinutes,
    load,
    shuffle,
    removeItem,
    addItem,
    reset,
  };
}
