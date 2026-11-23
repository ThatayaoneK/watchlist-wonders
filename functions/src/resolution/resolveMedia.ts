import type { EnrichResponse } from "../enrich";
import { outcomeForScore } from "./scoreCandidates";

export function resolveMedia(result: EnrichResponse): EnrichResponse {
  const score = result.confidenceScore ?? result.matchCandidates?.[0]?.score ?? 0;
  const thresholdOutcome = outcomeForScore(score);
  const candidates = result.matchCandidates ?? [];
  const resolutionStatus = result.tmdbId && thresholdOutcome === "matched"
    ? "matched"
    : candidates.length > 0 && score >= 0.65
      ? "needs_selection"
      : "unresolved";
  return {
    ...result,
    confidenceScore: score,
    resolutionStatus,
    requiresUserSelection: resolutionStatus !== "matched",
  };
}
