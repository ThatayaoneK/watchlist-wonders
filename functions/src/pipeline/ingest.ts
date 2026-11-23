import { incrementMetric } from "../admin/metrics";
import { extract } from "./stages/extract";
import { fingerprint } from "./stages/fingerprint";
import { classify } from "./stages/classify";
import { resolve } from "./stages/resolve";
import { autotag } from "./stages/autotag";
import { assignCluster } from "./stages/cluster";
import { indexDatapoint } from "./stages/index_stage";
import { persist } from "./stages/persist";
import type { PipelineBookmark, PipelineContext } from "./types";

export type IngestStatus = "completed" | "partial" | "skipped" | "error";

export interface IngestSummary {
  status: IngestStatus;
  bookmarkId: string;
  resolveSource: string;
  resolveConfidence: number;
  errors: Record<string, string>;
}

export async function runIngestionPipeline(
  bookmark: PipelineBookmark,
  tmdbApiKey: string | null,
): Promise<IngestSummary> {
  const ctx: PipelineContext = { bookmark, tmdbApiKey, errors: {} };

  // Stage 1: extract
  try {
    ctx.extracted = extract(bookmark);
  } catch (err) {
    ctx.errors.extract = err instanceof Error ? err.message : String(err);
    await incrementMetric("pipeline.extract.error");
    return { status: "error", bookmarkId: bookmark.id, resolveSource: "n/a", resolveConfidence: 0, errors: ctx.errors };
  }
  await incrementMetric("pipeline.extract.success");

  if (!ctx.extracted.rawTitle.trim() && !ctx.extracted.description.trim()) {
    await incrementMetric("pipeline.skipped.no_signal");
    return { status: "skipped", bookmarkId: bookmark.id, resolveSource: "skipped", resolveConfidence: 0, errors: ctx.errors };
  }

  // Stage 2: fingerprint
  try {
    ctx.fingerprint = (await fingerprint(bookmark, ctx.extracted)) ?? undefined;
    await incrementMetric(ctx.fingerprint ? "pipeline.fingerprint.success" : "pipeline.fingerprint.empty");
  } catch (err) {
    ctx.errors.fingerprint = err instanceof Error ? err.message : String(err);
    await incrementMetric("pipeline.fingerprint.error");
  }

  // Stage 3: classify
  try {
    ctx.classify = await classify(ctx.extracted, bookmark.provider ?? null);
    await incrementMetric("pipeline.classify.success");
    await incrementMetric(`pipeline.classify.type.${ctx.classify.contentType}`);
  } catch (err) {
    ctx.errors.classify = err instanceof Error ? err.message : String(err);
    await incrementMetric("pipeline.classify.error");
    ctx.classify = {
      contentType: "unknown",
      candidateTitles: [],
      possibleFranchise: null,
      year: null,
      characters: [],
      confidence: 0,
    };
  }

  // Stage 4: resolve
  try {
    ctx.resolve = await resolve(bookmark, ctx.extracted, ctx.fingerprint ?? null, ctx.classify, tmdbApiKey);
    await incrementMetric(`pipeline.resolve.source.${ctx.resolve.source}`);
    await incrementMetric(`pipeline.resolve.status.${ctx.resolve.status ?? "unresolved"}`);
    await incrementMetric(`pipeline.resolve.confidence.${ctx.resolve.confidenceBand ?? "low"}`);
    if (ctx.resolve.source !== "unresolved") {
      await incrementMetric(ctx.resolve.suggested ? "pipeline.resolve.suggested" : "pipeline.resolve.matched");
    }
  } catch (err) {
    ctx.errors.resolve = err instanceof Error ? err.message : String(err);
    await incrementMetric("pipeline.resolve.error");
    ctx.resolve = {
      source: "unresolved",
      id: "error",
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

  // Stage 5: autotag
  try {
    ctx.autoTags = await autotag(ctx.extracted, ctx.classify, ctx.resolve);
    await incrementMetric("pipeline.autotag.success");
  } catch (err) {
    ctx.errors.autotag = err instanceof Error ? err.message : String(err);
    await incrementMetric("pipeline.autotag.error");
    ctx.autoTags = { tags: [], inferredMood: null, topics: [] };
  }

  // Stage 6: cluster
  try {
    ctx.cluster = await assignCluster(bookmark, ctx.fingerprint ?? null);
    await incrementMetric(ctx.cluster.clusterId ? "pipeline.cluster.assigned" : "pipeline.cluster.pending");
  } catch (err) {
    ctx.errors.cluster = err instanceof Error ? err.message : String(err);
    ctx.cluster = { clusterId: null, pending: true };
  }

  // Stage 7: index in Vertex
  try {
    await indexDatapoint(bookmark, ctx.fingerprint ?? null, ctx.classify, ctx.resolve, ctx.cluster);
    await incrementMetric("pipeline.index.success");
  } catch (err) {
    ctx.errors.index = err instanceof Error ? err.message : String(err);
    await incrementMetric("pipeline.index.error");
  }

  // Stage 8: persist
  try {
    await persist(bookmark, ctx.extracted, ctx.fingerprint ?? null, ctx.classify, ctx.resolve, ctx.autoTags, ctx.cluster, Object.keys(ctx.errors).length === 0);
    await incrementMetric("pipeline.persist.success");
  } catch (err) {
    ctx.errors.persist = err instanceof Error ? err.message : String(err);
    await incrementMetric("pipeline.persist.error");
    return { status: "error", bookmarkId: bookmark.id, resolveSource: ctx.resolve.source, resolveConfidence: ctx.resolve.confidence, errors: ctx.errors };
  }

  const status: IngestStatus = Object.keys(ctx.errors).length === 0 ? "completed" : "partial";
  await incrementMetric(`pipeline.${status}`);
  return {
    status,
    bookmarkId: bookmark.id,
    resolveSource: ctx.resolve.source,
    resolveConfidence: ctx.resolve.confidence,
    errors: ctx.errors,
  };
}

