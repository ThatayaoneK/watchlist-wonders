import type { Bookmark } from "@/types/database";

type TimeBucket = "morning" | "daytime" | "evening" | "late";

export type DecisionIntent = "quick" | "deep" | "random" | "continue" | null;

export interface DecisionFilters {
  type?: Bookmark["type"] | "all";
  status?: Bookmark["status"] | "all";
  activeMood?: string | null;
  providers?: string[];
  moods?: string[];
  runtimeMin?: number | null;
  runtimeMax?: number | null;
}

export interface UpcomingScheduleSignal {
  bookmarkId: string;
  scheduledFor: string;
}

export interface DecisionContext {
  now?: Date;
  filters?: DecisionFilters;
  upcomingSchedules?: UpcomingScheduleSignal[];
  intent?: DecisionIntent;
  maxRails?: number;
}

export interface RecommendationInsights {
  scores: Record<string, number>;
  reasons: Record<string, string>;
  timeSubtitle: string;
}

export interface RankedBookmark {
  bookmark: Bookmark;
  score: number;
  reason: string;
}

export interface DecisionRail {
  id: string;
  title: string;
  subtitle?: string;
  bookmarks: Bookmark[];
  variant?: "poster" | "backdrop";
}

export interface DecisionSnapshot {
  ranked: RankedBookmark[];
  bestNext: Bookmark | null;
  rails: DecisionRail[];
  insights: RecommendationInsights;
}

interface WeightedReason {
  text: string;
  weight: number;
}

interface TimeContext {
  bucket: TimeBucket;
  preferredMin: number;
  preferredMax: number;
  targetMinutes: number;
  subtitle: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_MAX_RAILS = 5;

const DEFAULT_FILTERS: Required<DecisionFilters> = {
  type: "all",
  status: "all",
  activeMood: null,
  providers: [],
  moods: [],
  runtimeMin: null,
  runtimeMax: null,
};

function getTimeContext(now: Date): TimeContext {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) {
    return {
      bucket: "morning",
      preferredMin: 12,
      preferredMax: 50,
      targetMinutes: 30,
      subtitle: "You have about 30 min right now. Quick picks are prioritized.",
    };
  }
  if (hour >= 11 && hour < 17) {
    return {
      bucket: "daytime",
      preferredMin: 20,
      preferredMax: 65,
      targetMinutes: 45,
      subtitle: "Midday mode: shorter picks are easier to finish now.",
    };
  }
  if (hour >= 17 && hour < 23) {
    return {
      bucket: "evening",
      preferredMin: 75,
      preferredMax: 170,
      targetMinutes: 110,
      subtitle: "Tonight mode: longer, immersive picks are boosted.",
    };
  }
  return {
    bucket: "late",
    preferredMin: 20,
    preferredMax: 80,
    targetMinutes: 45,
    subtitle: "Late-night mode: manageable runtimes are ranked higher.",
  };
}

function getDaysOld(isoDate: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(isoDate).getTime()) / DAY_MS);
}

function getHoursSince(isoDate: string, now: Date): number {
  return (now.getTime() - new Date(isoDate).getTime()) / HOUR_MS;
}

function addReason(candidates: WeightedReason[], text: string, weight: number) {
  candidates.push({ text, weight });
}

function topReason(candidates: WeightedReason[], fallback: string): string {
  if (candidates.length === 0) return fallback;
  return [...candidates].sort((a, b) => b.weight - a.weight)[0].text;
}

function getAverageCompletedRuntime(bookmarks: Bookmark[]): number | null {
  const values = bookmarks
    .filter((bookmark) => bookmark.status === "done" && bookmark.runtime_minutes != null)
    .map((bookmark) => bookmark.runtime_minutes as number);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRuntimeFit(
  runtime: number | null,
  timeContext: TimeContext,
): { score: number; reason: string | null } {
  if (runtime == null) return { score: 0, reason: null };

  if (runtime >= timeContext.preferredMin && runtime <= timeContext.preferredMax) {
    if (timeContext.bucket === "evening") {
      return { score: 18, reason: "Good fit for tonight" };
    }
    return {
      score: 18,
      reason: `Fits your current ~${timeContext.targetMinutes} min window`,
    };
  }

  if (timeContext.bucket !== "evening" && runtime <= timeContext.preferredMax + 20) {
    return { score: 9, reason: "Easy to finish in one sitting" };
  }

  if (timeContext.bucket === "evening" && runtime >= 55 && runtime <= 220) {
    return { score: 10, reason: "Strong evening-length option" };
  }

  if (runtime > 180 && timeContext.bucket !== "evening") {
    return { score: -9, reason: null };
  }

  if (runtime < 20 && timeContext.bucket === "evening") {
    return { score: -4, reason: null };
  }

  return { score: 0, reason: null };
}

function normalizeFilters(filters?: DecisionFilters): Required<DecisionFilters> {
  return {
    ...DEFAULT_FILTERS,
    ...filters,
    providers: filters?.providers ?? [],
    moods: filters?.moods ?? [],
  };
}

function normalizeIntent(items: Bookmark[], intent: DecisionIntent): Bookmark[] {
  if (!intent) return items;
  if (intent === "quick") {
    return items.filter((item) => item.status !== "done" && (item.runtime_minutes ?? Infinity) <= 30);
  }
  if (intent === "deep") {
    return items.filter(
      (item) => item.status !== "done" && (item.type === "movie" || (item.runtime_minutes ?? 0) > 60),
    );
  }
  if (intent === "continue") {
    return items.filter((item) => item.status === "watching" || (item.progress_percent ?? 0) > 0);
  }
  if (intent === "random") {
    return items.filter((item) => item.status !== "done");
  }
  return items;
}

function applyVisibilityFilters(items: Bookmark[], filters: Required<DecisionFilters>): Bookmark[] {
  return items.filter((bookmark) => {
    if (filters.type !== "all" && bookmark.type !== filters.type) return false;
    if (filters.status !== "all" && bookmark.status !== filters.status) return false;
    if (filters.activeMood && !(bookmark.mood_tags ?? []).includes(filters.activeMood)) return false;
    if (filters.providers.length > 0 && !filters.providers.includes(bookmark.provider)) return false;
    if (
      filters.moods.length > 0 &&
      !(bookmark.mood_tags ?? []).some((mood) => filters.moods.includes(mood))
    ) {
      return false;
    }

    const min = filters.runtimeMin;
    const max = filters.runtimeMax;
    if (min != null && (bookmark.runtime_minutes == null || bookmark.runtime_minutes < min)) return false;
    if (max != null && (bookmark.runtime_minutes == null || bookmark.runtime_minutes > max)) return false;
    return true;
  });
}

function readIsoFromMetadata(bookmark: Bookmark): string | null {
  const candidateKeys = ["scheduled_for", "scheduledFor", "next_watch_at", "nextWatchAt"];
  for (const key of candidateKeys) {
    const raw = bookmark.metadata?.[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw;
    }
  }
  return null;
}

function buildUpcomingByBookmark(
  signals: UpcomingScheduleSignal[] = [],
): Map<string, Date[]> {
  const map = new Map<string, Date[]>();
  for (const signal of signals) {
    const parsed = new Date(signal.scheduledFor);
    if (!Number.isFinite(parsed.getTime())) continue;
    const list = map.get(signal.bookmarkId) ?? [];
    list.push(parsed);
    map.set(signal.bookmarkId, list);
  }
  for (const [bookmarkId, dates] of map) {
    map.set(bookmarkId, dates.sort((a, b) => a.getTime() - b.getTime()));
  }
  return map;
}

function rankBookmarks(
  bookmarks: Bookmark[],
  now: Date,
  filters: Required<DecisionFilters>,
  upcomingByBookmark: Map<string, Date[]>,
): DecisionSnapshot["ranked"] {
  const timeContext = getTimeContext(now);
  const watchedMoods = new Set(
    bookmarks
      .filter((bookmark) => bookmark.status === "done")
      .flatMap((bookmark) => bookmark.mood_tags ?? [])
      .map((mood) => mood.toLowerCase()),
  );
  const averageCompletedRuntime = getAverageCompletedRuntime(bookmarks);
  const ranked: DecisionSnapshot["ranked"] = [];

  for (const bookmark of bookmarks) {
    if (bookmark.status === "done") continue;

    let score = 0;
    const reasons: WeightedReason[] = [];

    if (bookmark.queue_status === "up_next") {
      score += 34;
      addReason(reasons, "You marked this as Up Next", 34);
    }

    if (bookmark.status === "watching" || (bookmark.progress_percent ?? 0) > 0) {
      score += 30;
      addReason(reasons, "You started this earlier", 30);
    }

    const runtimeFit = getRuntimeFit(bookmark.runtime_minutes, timeContext);
    score += runtimeFit.score;
    if (runtimeFit.reason) {
      addReason(reasons, runtimeFit.reason, Math.max(1, runtimeFit.score));
    }

    const moodMatches = (bookmark.mood_tags ?? []).filter((mood) =>
      watchedMoods.has(mood.toLowerCase()),
    ).length;
    if (moodMatches > 0) {
      const moodBoost = 8 + moodMatches * 4;
      score += moodBoost;
      addReason(reasons, "Because you watched similar titles", moodBoost);
    }

    if (averageCompletedRuntime != null && bookmark.runtime_minutes != null) {
      const runtimeDelta = Math.abs(bookmark.runtime_minutes - averageCompletedRuntime);
      if (runtimeDelta <= 20) {
        score += 10;
        addReason(reasons, "Fits your usual watch time", 10);
      } else if (runtimeDelta > 90) {
        score -= 4;
      }
    }

    const daysOld = getDaysOld(bookmark.created_at, now);
    if (daysOld <= 3) {
      score += 6;
      addReason(reasons, "Fresh in your queue", 6);
    } else if (daysOld > 45) {
      score -= 6;
    }

    if (bookmark.last_shown_at) {
      const hoursSinceShown = getHoursSince(bookmark.last_shown_at, now);
      if (hoursSinceShown < 6) score -= 20;
      else if (hoursSinceShown < 24) score -= 12;
      else if (hoursSinceShown < 72) score -= 6;
    }

    if (bookmark.status === "backlog" && (bookmark.shown_count ?? 0) > 0) {
      score -= Math.min(10, (bookmark.shown_count ?? 0) * 0.9);
    }

    if (bookmark.priority != null) {
      score += (bookmark.priority - 100) / 8;
    }

    const upcoming = upcomingByBookmark.get(bookmark.id)?.[0] ?? null;
    if (upcoming) {
      const hoursUntil = (upcoming.getTime() - now.getTime()) / HOUR_MS;
      if (hoursUntil <= 4) {
        score += 34;
        addReason(reasons, "Scheduled soon on your calendar", 34);
      } else if (hoursUntil <= 24) {
        score += 50;
        addReason(reasons, "Scheduled for today", 50);
      } else if (hoursUntil <= 72) {
        score += 14;
        addReason(reasons, "Coming up on your schedule", 14);
      } else {
        score += 7;
      }
    } else {
      const metadataIso = readIsoFromMetadata(bookmark);
      if (metadataIso) {
        const metadataDate = new Date(metadataIso);
        if (Number.isFinite(metadataDate.getTime()) && metadataDate.getTime() < now.getTime()) {
          score += 14;
          addReason(reasons, "Your scheduled slot passed, resurfacing now", 14);
        }
      } else if (bookmark.status === "scheduled") {
        score += 10;
        addReason(reasons, "Scheduled item needs a new slot", 10);
      }
    }

    if (filters.activeMood && (bookmark.mood_tags ?? []).includes(filters.activeMood)) {
      score += 8;
      addReason(reasons, "Matches your selected mood", 8);
    }

    if (filters.providers.length > 0 && filters.providers.includes(bookmark.provider)) {
      score += 7;
      addReason(reasons, `Available on ${bookmark.provider}`, 7);
    }

    if (filters.moods.length > 0) {
      const matches = (bookmark.mood_tags ?? []).filter((mood) => filters.moods.includes(mood)).length;
      if (matches > 0) {
        const boost = 5 + matches * 2;
        score += boost;
        addReason(reasons, "Matches your mood filters", boost);
      }
    }

    if (
      bookmark.runtime_minutes != null &&
      (filters.runtimeMin != null || filters.runtimeMax != null)
    ) {
      const min = filters.runtimeMin ?? 0;
      const max = filters.runtimeMax ?? Number.POSITIVE_INFINITY;
      if (bookmark.runtime_minutes >= min && bookmark.runtime_minutes <= max) {
        score += 6;
        addReason(reasons, "Matches your duration filter", 6);
      }
    }

    const fallback =
      timeContext.bucket === "evening"
        ? "Picked for your evening session"
        : "Picked for this time window";

    ranked.push({
      bookmark,
      score,
      reason: topReason(reasons, fallback),
    });
  }

  return ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.bookmark.created_at.localeCompare(a.bookmark.created_at);
  });
}

function topBookmarks(
  ranked: RankedBookmark[],
  predicate: (bookmark: Bookmark) => boolean,
  limit: number,
): Bookmark[] {
  return ranked
    .filter((item) => predicate(item.bookmark))
    .slice(0, limit)
    .map((item) => item.bookmark);
}

function toTitleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const GENRE_NORMALIZATION: Record<string, string> = {
  "sci fi": "Sci-Fi",
  "science fiction": "Sci-Fi",
  "sci-fi": "Sci-Fi",
  "tv movie": "TV Movie",
  "reality tv": "Reality TV",
  "action adventure": "Action & Adventure",
};

const GENRE_BLOCKLIST = new Set([
  "onboarding",
  "watchlist",
  "wishlist",
  "movie",
  "series",
  "video",
  "film",
  "other",
]);

function normalizeGenre(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  const lowered = cleaned.toLowerCase();
  if (GENRE_BLOCKLIST.has(lowered)) return null;
  const normalized = GENRE_NORMALIZATION[lowered];
  if (normalized) return normalized;
  if (cleaned.includes("&")) {
    return cleaned
      .split("&")
      .map((part) => toTitleCase(part))
      .join(" & ");
  }
  return toTitleCase(cleaned);
}

function collectGenreValues(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
        return [(entry as { name: string }).name];
      }
      return [];
    });
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,|/]/g)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function extractBookmarkGenres(bookmark: Bookmark): string[] {
  const metadata = bookmark.metadata ?? {};
  const values = [
    ...collectGenreValues(metadata.genres),
    ...collectGenreValues(metadata.genre),
    ...collectGenreValues(metadata.onboarding_genres),
  ];

  const source = values.length > 0 ? values : (bookmark.tags ?? []);
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const candidate of source) {
    const normalized = normalizeGenre(candidate);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
}

function toRailId(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "genre";
}

function buildGenreRails(ranked: RankedBookmark[], maxGenres: number): DecisionRail[] {
  const grouped = new Map<string, Bookmark[]>();

  for (const item of ranked) {
    const bookmark = item.bookmark;
    const genres = extractBookmarkGenres(bookmark);
    for (const genre of genres) {
      const list = grouped.get(genre) ?? [];
      if (!list.some((existing) => existing.id === bookmark.id)) {
        list.push(bookmark);
      }
      grouped.set(genre, list);
    }
  }

  return [...grouped.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    })
    .slice(0, maxGenres)
    .map(([genre, list]) => ({
      id: `genre-${toRailId(genre)}`,
      title: genre,
      subtitle: "Popular in your list",
      bookmarks: list.slice(0, 12),
      variant: "backdrop" as const,
    }));
}

function dedupeRailBookmarks(
  bookmarks: Bookmark[],
  usedIds: Set<string>,
): Bookmark[] {
  const next: Bookmark[] = [];
  for (const bookmark of bookmarks) {
    if (usedIds.has(bookmark.id)) continue;
    usedIds.add(bookmark.id);
    next.push(bookmark);
  }
  return next;
}

function buildRails(
  ranked: RankedBookmark[],
  upcomingByBookmark: Map<string, Date[]>,
  now: Date,
  maxRails: number,
): DecisionRail[] {
  const selected: DecisionRail[] = [];
  const usedIds = new Set<string>();

  const continueWatching = topBookmarks(
    ranked,
    (bookmark) => bookmark.status === "watching" || (bookmark.progress_percent ?? 0) > 0,
    10,
  );
  const planned = topBookmarks(
    ranked,
    (bookmark) => {
      if (upcomingByBookmark.has(bookmark.id)) return true;
      if (bookmark.status === "scheduled") return true;
      const metadataIso = readIsoFromMetadata(bookmark);
      if (!metadataIso) return false;
      const metadataDate = new Date(metadataIso);
      return Number.isFinite(metadataDate.getTime()) && metadataDate.getTime() >= now.getTime();
    },
    12,
  );

  const recentlyAdded = topBookmarks(
    ranked,
    (bookmark) => getDaysOld(bookmark.created_at, now) <= 10,
    12,
  );

  const quickWatch = topBookmarks(
    ranked,
    (bookmark) => bookmark.runtime_minutes != null && bookmark.runtime_minutes <= 30,
    12,
  );

  const appendRail = (rail: DecisionRail, minSize: number) => {
    if (selected.length >= maxRails) return;
    const deduped = dedupeRailBookmarks(rail.bookmarks, usedIds);
    if (deduped.length < minSize) return;
    selected.push({ ...rail, bookmarks: deduped });
  };

  appendRail(
    {
      id: "continue-watching",
      title: "Continue Watching",
      subtitle: "Resume where you left off",
      bookmarks: continueWatching,
      variant: "backdrop",
    },
    1,
  );

  appendRail(
    {
      id: "planned",
      title: "Planned",
      subtitle: "Coming up on your calendar",
      bookmarks: planned,
      variant: "backdrop",
    },
    1,
  );

  const genreRails = buildGenreRails(ranked, 2);
  for (const genreRail of genreRails) {
    appendRail(genreRail, 2);
  }

  appendRail(
    {
      id: "new-to-your-list",
      title: "New to your list",
      subtitle: "Recently added picks",
      bookmarks: recentlyAdded,
      variant: "backdrop",
    },
    2,
  );

  appendRail(
    {
      id: "quick-watch",
      title: "Quick Watch",
      subtitle: "Under 30 minutes",
      bookmarks: quickWatch,
      variant: "backdrop",
    },
    2,
  );

  return selected.slice(0, maxRails);
}

export function buildDecisionSnapshot(
  bookmarks: Bookmark[],
  context: DecisionContext = {},
): DecisionSnapshot {
  const now = context.now ?? new Date();
  const filters = normalizeFilters(context.filters);
  const maxRails = context.maxRails ?? DEFAULT_MAX_RAILS;
  const upcomingByBookmark = buildUpcomingByBookmark(context.upcomingSchedules);

  const filtered = applyVisibilityFilters(
    normalizeIntent(bookmarks, context.intent ?? null),
    filters,
  );
  const ranked = rankBookmarks(filtered, now, filters, upcomingByBookmark);

  const scores: Record<string, number> = {};
  const reasons: Record<string, string> = {};
  for (const rankedItem of ranked) {
    scores[rankedItem.bookmark.id] = rankedItem.score;
    reasons[rankedItem.bookmark.id] = rankedItem.reason;
  }

  const rails = buildRails(ranked, upcomingByBookmark, now, maxRails);

  return {
    ranked,
    bestNext: ranked[0]?.bookmark ?? null,
    rails,
    insights: {
      scores,
      reasons,
      timeSubtitle: getTimeContext(now).subtitle,
    },
  };
}

export function getBestNextItem(
  bookmarks: Bookmark[],
  context: DecisionContext = {},
): Bookmark | null {
  return buildDecisionSnapshot(bookmarks, context).bestNext;
}

export function getRails(
  bookmarks: Bookmark[],
  context: DecisionContext = {},
): DecisionRail[] {
  return buildDecisionSnapshot(bookmarks, context).rails;
}

export function buildRecommendationInsights(
  bookmarks: Bookmark[],
  now: Date = new Date(),
): RecommendationInsights {
  return buildDecisionSnapshot(bookmarks, { now }).insights;
}
