import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, parseISO, isValid } from "date-fns";
import { bookmarkService } from "@/services/bookmarks";

export function useWatchStreak() {
  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
    staleTime: 5 * 60 * 1000,
  });

  const streak = useMemo(() => {
    const done = bookmarks.filter((b) => b.status === "done");
    const watchedDays = new Set<string>();

    done.forEach((b) => {
      const dateStr = b.watched_at ?? null;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        if (isValid(d)) watchedDays.add(format(startOfDay(d), "yyyy-MM-dd"));
      } catch {
        // ignore
      }
    });

    let count = 0;
    const today = startOfDay(new Date());
    for (let i = 0; i <= 365; i++) {
      const day = format(subDays(today, i), "yyyy-MM-dd");
      if (watchedDays.has(day)) {
        count++;
      } else if (i > 0) {
        break;
      }
    }
    return count;
  }, [bookmarks]);

  return { streak };
}
