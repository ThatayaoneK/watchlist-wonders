import { normalizeMediaTitle } from "./titleNormalizer";

export const AUTO_MATCH_THRESHOLD = 0.9;
export const SELECTION_THRESHOLD = 0.65;

export type ExplainableScore = {
  total: number;
  title: number;
  year: number;
  type: number;
};

export function scoreCandidate(input: {
  queryTitle: string;
  candidateTitle: string;
  queryYear?: number | null;
  candidateYear?: number | null;
  expectedType?: "movie" | "tv" | null;
  candidateType?: "movie" | "tv" | null;
}): ExplainableScore {
  const queryTokens = new Set(normalizeMediaTitle(input.queryTitle).split(" ").filter(Boolean));
  const candidateTokens = new Set(normalizeMediaTitle(input.candidateTitle).split(" ").filter(Boolean));
  const overlap = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
  const union = new Set([...queryTokens, ...candidateTokens]).size;
  const title = union ? overlap / union : 0;
  const year = input.queryYear && input.candidateYear ? (input.queryYear === input.candidateYear ? 1 : 0) : 0.5;
  const type = input.expectedType && input.candidateType ? (input.expectedType === input.candidateType ? 1 : 0) : 0.5;
  return { title, year, type, total: Number((title * 0.8 + year * 0.12 + type * 0.08).toFixed(3)) };
}

export function outcomeForScore(score: number): "matched" | "needs_selection" | "unresolved" {
  if (score >= AUTO_MATCH_THRESHOLD) return "matched";
  if (score >= SELECTION_THRESHOLD) return "needs_selection";
  return "unresolved";
}
