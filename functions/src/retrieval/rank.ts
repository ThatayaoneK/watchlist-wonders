export interface RankableBookmark {
  id: string;
  semanticSimilarity: number;
  createdAt: string | null;
  viewCount: number;
  importanceScore: number;
}

export interface RankedBookmark extends RankableBookmark {
  score: number;
  breakdown: {
    semantic: number;
    recency: number;
    engagement: number;
    importance: number;
  };
}

const WEIGHT_SEMANTIC = 0.45;
const WEIGHT_RECENCY = 0.15;
const WEIGHT_ENGAGEMENT = 0.15;
const WEIGHT_IMPORTANCE = 0.25;

function recencyWeight(createdAt: string | null, now = Date.now()): number {
  if (!createdAt) return 0;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return 0;
  const ageDays = Math.max(0, (now - t) / (24 * 60 * 60 * 1000));
  return Math.exp(-ageDays / 30);
}

function engagementWeight(viewCount: number): number {
  return Math.min(Math.log(Math.max(0, viewCount) + 1) / 5, 1);
}

export function rank(items: RankableBookmark[], now = Date.now()): RankedBookmark[] {
  return items
    .map((item) => {
      const semantic = clamp01(item.semanticSimilarity);
      const recency = recencyWeight(item.createdAt, now);
      const engagement = engagementWeight(item.viewCount);
      const importance = clamp01(item.importanceScore);
      const score =
        semantic * WEIGHT_SEMANTIC +
        recency * WEIGHT_RECENCY +
        engagement * WEIGHT_ENGAGEMENT +
        importance * WEIGHT_IMPORTANCE;
      return { ...item, score, breakdown: { semantic, recency, engagement, importance } };
    })
    .sort((a, b) => b.score - a.score);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
