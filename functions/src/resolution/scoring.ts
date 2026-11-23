export type ConfidenceBand = "high" | "medium" | "low";
export type ResolutionStatus = "matched" | "needs_selection" | "unresolved";

export const HIGH_CONFIDENCE_SCORE = 0.82;
export const HIGH_CONFIDENCE_GAP = 0.12;
export const MEDIUM_CONFIDENCE_SCORE = 0.68;
export const MEDIUM_CONFIDENCE_GAP = 0.06;

export function confidenceFromScores(bestScore: number, gapToSecond: number): ConfidenceBand {
  if (bestScore >= HIGH_CONFIDENCE_SCORE && gapToSecond >= HIGH_CONFIDENCE_GAP) {
    return "high";
  }
  if (bestScore >= MEDIUM_CONFIDENCE_SCORE && gapToSecond >= MEDIUM_CONFIDENCE_GAP) {
    return "medium";
  }
  return "low";
}

export function resolutionStatusFromConfidence(
  band: ConfidenceBand | undefined,
  candidateCount: number,
): ResolutionStatus {
  if (band === "high") return "matched";
  if (candidateCount > 0) return "needs_selection";
  return "unresolved";
}

export function requiresUserSelection(status: ResolutionStatus): boolean {
  return status !== "matched";
}
