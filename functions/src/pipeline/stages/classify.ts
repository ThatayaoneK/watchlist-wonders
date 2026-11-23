import { generateStructured, isVertexConfigured } from "../../ai/vertex";
import type { ClassifyResult, ExtractedSignals } from "../types";

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    contentType: {
      type: "string",
      enum: ["movie", "tv", "anime", "music", "clip", "meme", "article", "unknown"],
    },
    candidateTitles: { type: "array", items: { type: "string" }, maxItems: 5 },
    possibleFranchise: { type: "string", nullable: true },
    year: { type: "integer", nullable: true },
    characters: { type: "array", items: { type: "string" }, maxItems: 8 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["contentType", "candidateTitles", "confidence"],
};

function buildPrompt(signals: ExtractedSignals, providerHint: string | null): string {
  return [
    "You are a content classifier for a bookmark + memory app.",
    "Given a saved web link's extracted signals, return a JSON object describing the underlying media.",
    "Pay close attention to clip/edit/fan-edit/scene language — that usually means the underlying entity is a movie or tv show.",
    "If unsure, set contentType=unknown and confidence below 0.4.",
    "",
    `Platform: ${signals.platform}`,
    providerHint ? `Provider hint: ${providerHint}` : "",
    `Title: ${signals.rawTitle}`,
    `Description: ${signals.description}`,
    `Hashtags: ${signals.hashtags.join(", ")}`,
    `Username: ${signals.username ?? ""}`,
    "",
    "Return up to 5 candidateTitles ordered by how likely each is the canonical name of the underlying movie/show/song.",
  ]
    .filter(Boolean)
    .join("\n");
}

function heuristicFallback(signals: ExtractedSignals, providerHint: string | null): ClassifyResult {
  const text = `${signals.rawTitle} ${signals.description}`.toLowerCase();
  let contentType: ClassifyResult["contentType"] = "unknown";
  if (providerHint === "imdb" || providerHint === "letterboxd" || providerHint === "rottentomatoes") {
    contentType = /season|episode|series/.test(text) ? "tv" : "movie";
  } else if (providerHint === "netflix") {
    contentType = "tv";
  } else if (providerHint === "youtube" && /trailer|movie|film/.test(text)) {
    contentType = "movie";
  } else if (signals.domainType === "article") {
    contentType = "article";
  } else if (signals.domainType === "social" || signals.domainType === "video") {
    contentType = "clip";
  }
  const candidate = signals.rawTitle.replace(/\s*[-–|]\s*.*$/, "").trim();
  return {
    contentType,
    candidateTitles: candidate ? [candidate] : [],
    possibleFranchise: null,
    year: null,
    characters: [],
    confidence: candidate ? 0.4 : 0.1,
  };
}

export async function classify(
  signals: ExtractedSignals,
  providerHint: string | null,
): Promise<ClassifyResult> {
  if (!isVertexConfigured() || !signals.rawTitle.trim()) {
    return heuristicFallback(signals, providerHint);
  }
  try {
    const result = await generateStructured<ClassifyResult>(
      buildPrompt(signals, providerHint),
      CLASSIFY_SCHEMA,
    );
    return {
      contentType: result.contentType ?? "unknown",
      candidateTitles: Array.isArray(result.candidateTitles) ? result.candidateTitles.slice(0, 5) : [],
      possibleFranchise: result.possibleFranchise ?? null,
      year: typeof result.year === "number" ? result.year : null,
      characters: Array.isArray(result.characters) ? result.characters.slice(0, 8) : [],
      confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
    };
  } catch (err) {
    console.warn("[pipeline.classify] LLM failed, using heuristic", err instanceof Error ? err.message : err);
    return heuristicFallback(signals, providerHint);
  }
}
