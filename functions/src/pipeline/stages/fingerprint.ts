import { embedText, embedImage, isVertexConfigured } from "../../ai/vertex";
import type { ExtractedSignals, FingerprintResult, PipelineBookmark } from "../types";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "your", "you",
  "are", "was", "but", "not", "can", "will", "all", "one", "out", "get",
  "has", "had", "they", "them", "their", "what", "when", "where", "how",
]);

function extractKeywords(text: string, max = 12): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  const counts: Record<string, number> = {};
  for (const t of tokens) counts[t] = (counts[t] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([t]) => t);
}

export async function fingerprint(
  bookmark: PipelineBookmark,
  signals: ExtractedSignals,
): Promise<FingerprintResult | null> {
  if (!isVertexConfigured()) {
    return {
      textEmbedding: [],
      textEmbeddingId: `${bookmark.userId}:${bookmark.id}`,
      imageEmbedding: null,
      imageEmbeddingId: null,
      extractedKeywords: extractKeywords(signals.fullText),
      platform: signals.platform,
    };
  }

  const textForEmbed = signals.fullText || signals.rawTitle;
  if (!textForEmbed.trim()) return null;

  const textEmbedding = await embedText(textForEmbed);
  const textEmbeddingId = `${bookmark.userId}:${bookmark.id}`;

  const imageEmbedding = signals.thumbnailUrl
    ? await embedImage(signals.thumbnailUrl).catch(() => null)
    : null;

  return {
    textEmbedding,
    textEmbeddingId,
    imageEmbedding,
    imageEmbeddingId: imageEmbedding ? `${textEmbeddingId}:img` : null,
    extractedKeywords: extractKeywords(signals.fullText),
    platform: signals.platform,
  };
}
