import { FieldValue, getFirestore, Timestamp, type UpdateData, type DocumentData } from "firebase-admin/firestore";
import type { TmdbEnrichment } from "../../tmdb/types";
import { logResolutionEvent } from "../../resolution/events";
import type {
  AutoTagResult,
  ClassifyResult,
  ClusterAssignment,
  ExtractedSignals,
  FingerprintResult,
  PipelineBookmark,
  ResolveResult,
} from "../types";
import { PIPELINE_VERSION } from "../types";

function buildLegacyTmdb(resolveResult: ResolveResult): TmdbEnrichment | null {
  if (resolveResult.source !== "tmdb" || !resolveResult.id) return null;
  const tmdbId = Number(resolveResult.id);
  if (!Number.isFinite(tmdbId)) return null;
  return {
    tmdbId,
    mediaType: resolveResult.type === "tv" ? "tv" : "movie",
    title: resolveResult.title,
    originalTitle: resolveResult.title,
    overview: null,
    posterPath: null,
    posterUrl: resolveResult.poster,
    backdropPath: null,
    backdropUrl: null,
    releaseDate: resolveResult.year ? `${resolveResult.year}-01-01` : null,
    releaseYear: resolveResult.year ?? null,
    rating: null,
    voteCount: null,
    popularity: null,
    genreIds: [],
    genres: resolveResult.genres,
    runtimeMinutes: resolveResult.runtime,
    trailerUrl: null,
    canonicalUrl: `https://www.themoviedb.org/${resolveResult.type === "tv" ? "tv" : "movie"}/${tmdbId}`,
    streaming: {},
    enrichedAt: new Date().toISOString(),
  };
}

export async function persist(
  bookmark: PipelineBookmark,
  signals: ExtractedSignals,
  fp: FingerprintResult | null,
  classifyResult: ClassifyResult,
  resolveResult: ResolveResult,
  autoTags: AutoTagResult,
  cluster: ClusterAssignment,
  completed = true,
): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("users").doc(bookmark.userId).collection("bookmarks").doc(bookmark.id);
  const now = new Date().toISOString();
  const guardedUpdate = async (update: Record<string, unknown>) => db.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) throw new Error("Bookmark deleted during ingestion");
    const current = fresh.data()!;
    const protectedResolution = current.schemaVersion === 2
      ? Boolean(current.source?.captureId) || ["user", "manual"].includes(current.resolution?.selectedBy)
      : ["user", "manual"].includes(current.metadata?.resolution_selected_by);
    const safeUpdate = { ...update };
    if (protectedResolution) {
      for (const key of Object.keys(safeUpdate)) {
        if (key.startsWith("resolution.") || key.startsWith("media.") || key.startsWith("metadata.resolution_")
          || key === "metadata.match_candidates" || ["canonical_entity", "tmdb", "enriched", "enriched_at", "enrich_fail_reason", "title", "type", "poster_url", "release_year", "runtime_minutes"].includes(key)) delete safeUpdate[key];
      }
    }
    tx.update(ref, safeUpdate as UpdateData<DocumentData>);
  });
  const currentSnap = await ref.get().catch(() => null);
  const currentData = currentSnap?.data() ?? {};
  const currentMetadata =
    currentData.metadata && typeof currentData.metadata === "object" && !Array.isArray(currentData.metadata)
      ? (currentData.metadata as Record<string, unknown>)
      : {};
  const currentResolution =
    currentData.resolution && typeof currentData.resolution === "object" && !Array.isArray(currentData.resolution)
      ? currentData.resolution as Record<string, unknown>
      : {};
  const userConfirmedResolution =
    currentData.schemaVersion === 2
      ? currentResolution.selectedBy === "user" || currentResolution.selectedBy === "manual"
      : currentMetadata.resolution_selected_by === "user" ||
        currentMetadata.resolution_selected_by === "manual" ||
        Boolean(currentData.canonical_entity && currentMetadata.resolution_selected_by !== "auto");

  if (currentData.schemaVersion === 2) {
    const v2Update: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
      "intelligence.pipelineVersion": completed ? PIPELINE_VERSION : 0,
      "intelligence.autoTags": autoTags.tags,
      "intelligence.fingerprint": fp
        ? {
            text_embedding_id: fp.textEmbeddingId,
            image_embedding_id: fp.imageEmbeddingId,
            extracted_keywords: fp.extractedKeywords,
            platform: fp.platform,
            embedding_cache: cluster.clusterId ? null : (fp.textEmbedding.length ? fp.textEmbedding : null),
          }
        : null,
      "intelligence.embeddingRef": fp?.textEmbedding.length ? fp.textEmbeddingId : null,
      "intelligence.clusterId": cluster.clusterId,
      "intelligence.pendingClusterAssignment": cluster.pending,
    };

    if (!userConfirmedResolution) {
      const status = resolveResult.status ?? (resolveResult.source === "unresolved" ? "unresolved" : "matched");
      v2Update["resolution.status"] = status;
      v2Update["resolution.confidence"] = resolveResult.confidence;
      v2Update["resolution.provider"] = resolveResult.source === "tmdb" || resolveResult.source === "youtube"
        ? resolveResult.source
        : null;
      v2Update["resolution.externalId"] = resolveResult.id || null;
      v2Update["resolution.candidates"] = resolveResult.candidates ?? [];
      v2Update["resolution.selectedBy"] = status === "matched" ? "auto" : null;
      if (status === "matched" && resolveResult.source !== "unresolved") {
        if (resolveResult.title) v2Update["media.title"] = resolveResult.title;
        if (resolveResult.poster) v2Update["media.posterUrl"] = resolveResult.poster;
        if (resolveResult.year) v2Update["media.releaseYear"] = resolveResult.year;
        if (resolveResult.runtime) v2Update["media.runtimeMinutes"] = resolveResult.runtime;
        v2Update["media.type"] = resolveResult.type === "tv" ? "series" : "movie";
      }
    }

    await guardedUpdate(v2Update);
    if (!userConfirmedResolution) {
      await logResolutionEvent({
        userId: bookmark.userId,
        bookmarkId: bookmark.id,
        action: resolveResult.status === "matched" ? "auto_matched" : resolveResult.status === "needs_selection" ? "needs_selection" : "unresolved",
        status: resolveResult.status ?? "unresolved",
        platform: signals.platform,
        rawTitle: signals.rawTitle,
        sourceUrl: bookmark.canonical_url ?? bookmark.source_url ?? null,
        confidence: resolveResult.confidence,
        confidenceBand: resolveResult.confidenceBand ?? "low",
        candidates: resolveResult.candidates ?? [],
        selectedCandidate: resolveResult.status === "matched" ? (resolveResult.candidates?.[0] ?? null) : null,
        selectedRank: resolveResult.status === "matched" ? 1 : null,
      });
    }
    return;
  }

  const update: Record<string, unknown> = {
    updated_at: now,
    pipeline_version: completed ? PIPELINE_VERSION : 0,
    auto_tags: autoTags.tags,
    context: {
      reason: null,
      mood: autoTags.inferredMood,
      inferred_tags: autoTags.topics,
      domain_type: signals.domainType,
    },
    fingerprint: fp
      ? {
          text_embedding_id: fp.textEmbeddingId,
          image_embedding_id: fp.imageEmbeddingId,
          extracted_keywords: fp.extractedKeywords,
          platform: fp.platform,
          // embedding_cache is retained transiently to support scheduled clustering
          // when no centroid was close enough at write time. Cleared after assignment.
          embedding_cache: cluster.clusterId ? null : (fp.textEmbedding.length ? fp.textEmbedding : null),
        }
      : null,
    embedding_ref: fp?.textEmbedding.length ? fp.textEmbeddingId : null,
    cluster_id: cluster.clusterId,
    pending_cluster_assignment: cluster.pending,
  };

  if (!userConfirmedResolution) {
    update["metadata.resolution_status"] = resolveResult.status ?? (resolveResult.source === "unresolved" ? "unresolved" : "matched");
    update["metadata.resolution_confidence"] = resolveResult.confidence;
    update["metadata.resolution_confidence_band"] = resolveResult.confidenceBand ?? "low";
    update["metadata.resolution_requires_selection"] = resolveResult.requiresUserSelection ?? resolveResult.status !== "matched";
    update["metadata.resolution_source"] = resolveResult.source;
    update["metadata.match_candidates"] = resolveResult.candidates ?? [];
  }

  if (!userConfirmedResolution && resolveResult.status === "matched" && resolveResult.source !== "unresolved") {
    update.canonical_entity = {
      source: resolveResult.source,
      id: resolveResult.id,
      type: resolveResult.type,
      title: resolveResult.title,
      year: resolveResult.year,
      genres: resolveResult.genres,
      runtime: resolveResult.runtime,
      poster: resolveResult.poster,
      confidence: resolveResult.confidence,
      matched_at: now,
      suggested: resolveResult.suggested,
    };
    update["metadata.resolution_selected_by"] = "auto";

    const legacy = buildLegacyTmdb(resolveResult);
    if (legacy && !bookmark.enriched && !bookmark.tmdb) {
      update.tmdb = legacy;
      update.enriched = true;
      update.enriched_at = now;
      update.enrich_fail_reason = null;
      if (resolveResult.title) update.title = resolveResult.title;
      if (resolveResult.poster) {
        update.poster_url = resolveResult.poster;
      }
      if (resolveResult.year) update.release_year = resolveResult.year;
      if (resolveResult.runtime) update.runtime_minutes = resolveResult.runtime;
      update.type = resolveResult.type === "tv" ? "series" : "movie";
    }
  } else if (!userConfirmedResolution && resolveResult.status === "needs_selection") {
    update.canonical_entity = null;
    if (!bookmark.enriched) {
      update.enriched = false;
      update.enriched_at = null;
      update.enrich_fail_reason = null;
      update.tmdb = null;
    }
  } else if (!userConfirmedResolution) {
    update.canonical_entity = null;
    if (!bookmark.enriched) {
      update.enriched = false;
      update.enriched_at = null;
      update.enrich_fail_reason = resolveResult.id;
      update.tmdb = null;
    }
  }

  if (typeof bookmark.view_count !== "number") {
    update.view_count = 0;
  }
  if (typeof bookmark.importance_score !== "number") {
    update.importance_score = 0.5;
  }

  await guardedUpdate(update);

  if (!userConfirmedResolution) {
    await logResolutionEvent({
      userId: bookmark.userId,
      bookmarkId: bookmark.id,
      action: resolveResult.status === "matched" ? "auto_matched" : resolveResult.status === "needs_selection" ? "needs_selection" : "unresolved",
      status: resolveResult.status ?? "unresolved",
      platform: signals.platform,
      rawTitle: signals.rawTitle,
      sourceUrl: bookmark.canonical_url ?? bookmark.source_url ?? null,
      confidence: resolveResult.confidence,
      confidenceBand: resolveResult.confidenceBand ?? "low",
      candidates: resolveResult.candidates ?? [],
      selectedCandidate: resolveResult.status === "matched" ? (resolveResult.candidates?.[0] ?? null) : null,
      selectedRank: resolveResult.status === "matched" ? 1 : null,
    });
  }
}

export async function bumpView(userId: string, bookmarkId: string): Promise<void> {
  const ref = getFirestore()
    .collection("users")
    .doc(userId)
    .collection("bookmarks")
    .doc(bookmarkId);
  const snap = await ref.get();
  const isV2 = snap.data()?.schemaVersion === 2;
  await ref.update(isV2
    ? {
        "intelligence.viewCount": FieldValue.increment(1),
        "intelligence.lastViewedAt": Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
    : {
        view_count: FieldValue.increment(1),
        last_viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
}



