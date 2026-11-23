import { generateStructured, isVertexConfigured } from "../../ai/vertex";
import type { AutoTagResult, ClassifyResult, ExtractedSignals, ResolveResult } from "../types";

const SCHEMA = {
  type: "object",
  properties: {
    tags: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 15 },
    inferredMood: { type: "string", nullable: true },
    topics: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
  required: ["tags", "topics"],
};

function heuristic(signals: ExtractedSignals, resolve: ResolveResult): AutoTagResult {
  const tags = new Set<string>();
  for (const t of signals.hashtags) tags.add(t.toLowerCase());
  for (const g of resolve.genres) tags.add(g.toLowerCase().replace(/\s+/g, "_"));
  if (resolve.year) tags.add(`${Math.floor(resolve.year / 10) * 10}s`);
  tags.add(signals.domainType);
  return {
    tags: Array.from(tags).slice(0, 15),
    inferredMood: null,
    topics: resolve.genres.slice(0, 5),
  };
}

export async function autotag(
  signals: ExtractedSignals,
  classifyResult: ClassifyResult,
  resolveResult: ResolveResult,
): Promise<AutoTagResult> {
  if (!isVertexConfigured()) return heuristic(signals, resolveResult);

  const prompt = [
    "Generate 5-15 short, lowercase, underscore-separated tags for this saved bookmark.",
    "Tags should capture: topics, themes, mood, entities, content_type, era.",
    "Avoid generic words like 'video', 'content', 'post'.",
    "",
    `Title: ${signals.rawTitle}`,
    `Description: ${signals.description}`,
    `Resolved entity: ${resolveResult.title || "unresolved"} (${resolveResult.type})`,
    `Genres: ${resolveResult.genres.join(", ") || "n/a"}`,
    `Hashtags: ${signals.hashtags.join(", ") || "none"}`,
    `Classified as: ${classifyResult.contentType}`,
    "",
    "Also infer one mood word (cozy, intense, melancholic, hype, etc) and up to 8 high-level topics.",
  ].join("\n");

  try {
    const result = await generateStructured<AutoTagResult>(prompt, SCHEMA);
    return {
      tags: Array.isArray(result.tags) ? result.tags.slice(0, 15).map((t) => String(t).toLowerCase()) : [],
      inferredMood: result.inferredMood ?? null,
      topics: Array.isArray(result.topics) ? result.topics.slice(0, 8) : [],
    };
  } catch (err) {
    console.warn("[pipeline.autotag] LLM failed", err instanceof Error ? err.message : err);
    return heuristic(signals, resolveResult);
  }
}
