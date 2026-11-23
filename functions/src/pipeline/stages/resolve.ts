import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { searchMulti, getDetails, buildEnrichment } from "../../tmdb/client";
import { titleSimilarity } from "../../tmdb/titleNormalizer";
import { embedText, isVertexConfigured } from "../../ai/vertex";
import { cosineSimilarity } from "../../ai/vectorIndex";
import {
  confidenceFromScores,
  requiresUserSelection,
  resolutionStatusFromConfidence,
  type ConfidenceBand,
} from "../../resolution/scoring";
import type {
  ClassifyResult,
  ExtractedSignals,
  FingerprintResult,
  PipelineBookmark,
  ResolutionCandidate,
  ResolveResult,
} from "../types";

const EMBED_RERANK_THRESHOLD = 0.78;

function urlHash(url: string | null | undefined): string {
  if (!url) return "";
  return createHash("sha1").update(url.trim().toLowerCase()).digest("hex");
}

function unresolved(reason: string): ResolveResult {
  return {
    source: "unresolved",
    id: reason,
    type: "unknown",
    title: "",
    year: null,
    genres: [],
    runtime: null,
    poster: null,
    confidence: 0,
    suggested: false,
    status: "unresolved",
    confidenceBand: "low",
    candidates: [],
    requiresUserSelection: true,
  };
}

interface Candidate {
  title: string;
  year: number | null;
  overview: string;
  popularity: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  posterPath: string | null;
}

type LegacyCachedResolveResult = Omit<ResolveResult, "status" | "suggested"> & {
  suggested?: boolean;
  status?: ResolveResult["status"] | "suggested";
};

function normalizeCachedStatus(
  status: LegacyCachedResolveResult["status"],
  suggested: boolean,
): NonNullable<ResolveResult["status"]> {
  if (status === "suggested") return "needs_selection";
  if (status) return status;
  return suggested ? "needs_selection" : "matched";
}

export function normalizeCachedResolveResult(entity: LegacyCachedResolveResult): ResolveResult {
  const suggested =
    entity.suggested ?? (entity.status === "suggested" || entity.status === "needs_selection");
  const status = normalizeCachedStatus(entity.status, suggested);

  return {
    ...entity,
    suggested,
    status,
    confidenceBand: entity.confidenceBand ?? (status === "matched" ? "high" : "low"),
    candidates: entity.candidates ?? [],
    requiresUserSelection: entity.requiresUserSelection ?? requiresUserSelection(status),
  };
}

function normalizePopularity(value: number): number {
  return Math.min(value / 200, 1);
}

async function fetchTmdbCandidates(
  apiKey: string,
  titles: string[],
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const seen = new Set<number>();
  for (const title of titles) {
    if (!title.trim()) continue;
    const res = await searchMulti(apiKey, title).catch(() => null);
    if (!res?.results) continue;
    for (const r of res.results) {
      if (r.media_type !== "movie" && r.media_type !== "tv") continue;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const display = r.title ?? r.name ?? "";
      const date = r.release_date ?? r.first_air_date ?? null;
      out.push({
        title: display,
        year: date ? Number(date.slice(0, 4)) : null,
        overview: r.overview ?? "",
        popularity: Number(r.popularity) || 0,
        tmdbId: r.id,
        mediaType: r.media_type,
        posterPath: r.poster_path ?? null,
      });
      if (out.length >= 12) return out;
    }
  }
  return out;
}

async function readCache(hash: string): Promise<ResolveResult | null> {
  if (!hash) return null;
  try {
    const snap = await getFirestore().collection("entityCache").doc(hash).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data?.canonical_entity) return null;
    const ce = data.canonical_entity as LegacyCachedResolveResult;
    return normalizeCachedResolveResult(ce);
  } catch {
    return null;
  }
}

async function writeCache(hash: string, entity: ResolveResult): Promise<void> {
  if (!hash || entity.source === "unresolved" || entity.status !== "matched") return;
  try {
    await getFirestore().collection("entityCache").doc(hash).set({
      url_hash: hash,
      canonical_entity: entity,
      cached_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[resolve.writeCache] failed", err instanceof Error ? err.message : err);
  }
}

export async function resolve(
  bookmark: PipelineBookmark,
  signals: ExtractedSignals,
  fp: FingerprintResult | null,
  classifyResult: ClassifyResult,
  tmdbApiKey: string | null,
): Promise<ResolveResult> {
  const cacheKey = urlHash(bookmark.canonical_url ?? bookmark.source_url ?? null);
  const cached = await readCache(cacheKey);
  if (cached) return cached;

  if (classifyResult.contentType === "article" && classifyResult.confidence < 0.5) {
    return unresolved("article_low_confidence");
  }

  if (!tmdbApiKey) {
    return unresolved("no_tmdb_key");
  }

  const titles = classifyResult.candidateTitles.length
    ? classifyResult.candidateTitles
    : [signals.rawTitle].filter(Boolean);

  if (!titles.length) return unresolved("no_candidates");

  const candidates = await fetchTmdbCandidates(tmdbApiKey, titles);
  if (!candidates.length) {
    const result = unresolved("no_tmdb_results");
    await writeCache(cacheKey, result);
    return result;
  }

  const primary = titles[0].toLowerCase();
  const scored = candidates.map((c) => {
    const tokenOverlap = titleSimilarity(primary, c.title.toLowerCase());
    const popularity = normalizePopularity(c.popularity);
    const yearAligned = classifyResult.year && c.year ? (Math.abs(c.year - classifyResult.year) <= 1 ? 1 : 0) : 0.5;
    return {
      candidate: c,
      tokenOverlap,
      popularity,
      yearAligned,
      embeddingSimilarity: 0,
      score: 0.65 * tokenOverlap + 0.2 * yearAligned + 0.15 * popularity,
    };
  });

  if (fp?.textEmbedding.length && isVertexConfigured()) {
    try {
      const embeds = await Promise.all(
        scored.slice(0, 6).map((s) =>
          embedText(`${s.candidate.title} ${s.candidate.year ?? ""} ${s.candidate.overview}`.trim()),
        ),
      );
      let maxSim = 0;
      let maxIdx = 0;
      embeds.forEach((emb, i) => {
        const sim = cosineSimilarity(fp.textEmbedding, emb);
        if (sim > maxSim) {
          maxSim = sim;
          maxIdx = i;
        }
      });
      if (maxSim >= EMBED_RERANK_THRESHOLD && scored[maxIdx]) {
        scored[maxIdx].embeddingSimilarity = maxSim;
        scored[maxIdx].score = Math.min(1, scored[maxIdx].score * 0.7 + maxSim * 0.3);
      }
    } catch (err) {
      console.warn("[resolve] embed rerank failed", err instanceof Error ? err.message : err);
    }
  }

  scored.sort((left, right) => right.score - left.score);
  const bestScored = scored[0];
  const secondBest = scored[1];
  const confidence = Number(bestScored.score.toFixed(3));
  const confidenceBand: ConfidenceBand = confidenceFromScores(
    bestScored.score,
    secondBest ? Math.max(0, bestScored.score - secondBest.score) : 1,
  );
  const status = resolutionStatusFromConfidence(confidenceBand, scored.length);
  const resolutionCandidates: ResolutionCandidate[] = scored.slice(0, 5).map((s) => ({
    source: "tmdb",
    id: String(s.candidate.tmdbId),
    tmdbId: s.candidate.tmdbId,
    type: s.candidate.mediaType,
    title: s.candidate.title,
    year: s.candidate.year,
    poster: s.candidate.posterPath ? `https://image.tmdb.org/t/p/w500${s.candidate.posterPath}` : null,
    confidence: Number(s.score.toFixed(3)),
    scoreBreakdown: {
      title: Number(s.tokenOverlap.toFixed(3)),
      year: Number(s.yearAligned.toFixed(3)),
      popularity: Number(s.popularity.toFixed(3)),
      embedding: Number(s.embeddingSimilarity.toFixed(3)),
      total: Number(s.score.toFixed(3)),
    },
  }));

  const detail = await getDetails(tmdbApiKey, bestScored.candidate.tmdbId, bestScored.candidate.mediaType).catch(() => null);
  const enrichment = buildEnrichment(
    {
      id: bestScored.candidate.tmdbId,
      media_type: bestScored.candidate.mediaType,
      title: bestScored.candidate.title,
      poster_path: bestScored.candidate.posterPath,
      overview: bestScored.candidate.overview,
      popularity: bestScored.candidate.popularity,
    } as never,
    detail,
  );

  const result: ResolveResult = {
    source: "tmdb",
    id: String(enrichment.tmdbId),
    type: bestScored.candidate.mediaType === "tv" ? "tv" : "movie",
    title: enrichment.title,
    year: enrichment.releaseYear,
    genres: enrichment.genres,
    runtime: enrichment.runtimeMinutes,
    poster: enrichment.posterUrl,
    confidence,
    suggested: status !== "matched",
    status,
    confidenceBand,
    candidates: resolutionCandidates,
    requiresUserSelection: requiresUserSelection(status),
  };
  await writeCache(cacheKey, result);
  return result;
}
