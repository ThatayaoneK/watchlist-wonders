import type { Bookmark } from "@/types/database";

export type DecisionMood = "action" | "chill" | "intense" | null;
export type DecisionTime = "quick" | "deep" | null;
export type DecisionIntent = "quick" | "deep" | "random" | "continue" | null;

export interface DecisionSeed {
  mood: DecisionMood;
  time: DecisionTime;
  randomize: boolean;
  preferContinue: boolean;
}

export interface BuildDecisionCandidateOptions {
  mood?: DecisionMood;
  time?: DecisionTime;
  intent?: DecisionIntent;
}

export const DECISION_MOOD_TAG_MAP: Record<Exclude<DecisionMood, null>, string[]> = {
  action: ["action", "thriller", "epic"],
  chill: ["relaxing", "inspiring", "family"],
  intense: ["intense", "drama", "dark"],
};

export function deriveDecisionSeedFromIntent(intent: DecisionIntent): DecisionSeed {
  if (intent === "quick") {
    return { mood: null, time: "quick", randomize: false, preferContinue: false };
  }
  if (intent === "deep") {
    return { mood: null, time: "deep", randomize: false, preferContinue: false };
  }
  if (intent === "random") {
    return { mood: null, time: null, randomize: true, preferContinue: false };
  }
  if (intent === "continue") {
    return { mood: null, time: null, randomize: false, preferContinue: true };
  }
  return { mood: null, time: null, randomize: false, preferContinue: false };
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function hasProgress(bookmark: Bookmark): boolean {
  return bookmark.status === "watching" || (bookmark.progress_percent ?? 0) > 0;
}

function applyTimeFilter(items: Bookmark[], time: DecisionTime): Bookmark[] {
  if (!time) return items;
  if (time === "quick") {
    return items.filter((item) => item.runtime_minutes != null && item.runtime_minutes <= 30);
  }
  return items.filter(
    (item) => item.type === "movie" || (item.runtime_minutes != null && item.runtime_minutes > 60),
  );
}

function applyMoodFilter(items: Bookmark[], mood: DecisionMood): Bookmark[] {
  if (!mood) return items;
  const acceptedTags = new Set(DECISION_MOOD_TAG_MAP[mood].map(normalizeTag));
  return items.filter((item) => (item.mood_tags ?? []).some((tag) => acceptedTags.has(normalizeTag(tag))));
}

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function stableShuffle(items: Bookmark[]): Bookmark[] {
  return [...items].sort((a, b) => {
    const ha = stableHash(a.id);
    const hb = stableHash(b.id);
    if (ha !== hb) return ha - hb;
    return a.id.localeCompare(b.id);
  });
}

function sortByPriorityAndRecency(items: Bookmark[]): Bookmark[] {
  return [...items].sort((a, b) => {
    const upNextDelta = Number((b.queue_status ?? "") === "up_next") - Number((a.queue_status ?? "") === "up_next");
    if (upNextDelta !== 0) return upNextDelta;

    const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDelta !== 0) return priorityDelta;

    return b.created_at.localeCompare(a.created_at);
  });
}

function prioritizeContinue(items: Bookmark[]): Bookmark[] {
  const inProgress = items.filter(hasProgress);
  if (inProgress.length === 0) return items;
  const inProgressIds = new Set(inProgress.map((item) => item.id));
  const rest = items.filter((item) => !inProgressIds.has(item.id));
  return [...inProgress, ...rest];
}

export function buildDecisionCandidates(
  bookmarks: Bookmark[],
  options: BuildDecisionCandidateOptions = {},
): Bookmark[] {
  const intentSeed = deriveDecisionSeedFromIntent(options.intent ?? null);
  const selectedMood = options.mood ?? intentSeed.mood;
  const selectedTime = options.time ?? intentSeed.time;

  let candidates = bookmarks.filter((bookmark) => bookmark.status !== "done");
  candidates = intentSeed.preferContinue ? prioritizeContinue(candidates) : candidates;

  const timeFiltered = applyTimeFilter(candidates, selectedTime);
  candidates = timeFiltered.length > 0 ? timeFiltered : candidates;

  const moodFiltered = applyMoodFilter(candidates, selectedMood);
  candidates = moodFiltered.length > 0 ? moodFiltered : candidates;

  const ranked = sortByPriorityAndRecency(candidates);
  if (intentSeed.randomize) return stableShuffle(ranked);
  return ranked;
}

export function getNextDecisionIndex(currentIndex: number, total: number): number {
  if (total <= 0) return 0;
  return (currentIndex + 1) % total;
}

