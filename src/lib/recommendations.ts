import type { Bookmark } from "@/types/database";
import {
  buildRecommendationInsights as buildFromDecisionEngine,
  type RecommendationInsights,
} from "@/engine/decisionEngine";

export type { RecommendationInsights };

export function buildRecommendationInsights(
  bookmarks: Bookmark[],
  now: Date = new Date(),
): RecommendationInsights {
  return buildFromDecisionEngine(bookmarks, now);
}
