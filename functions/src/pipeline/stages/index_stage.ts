import { upsertDatapoint, isVectorIndexConfigured } from "../../ai/vectorIndex";
import type { ClassifyResult, ClusterAssignment, FingerprintResult, PipelineBookmark, ResolveResult } from "../types";

export async function indexDatapoint(
  bookmark: PipelineBookmark,
  fp: FingerprintResult | null,
  classifyResult: ClassifyResult,
  resolveResult: ResolveResult,
  cluster: ClusterAssignment,
): Promise<void> {
  if (!fp?.textEmbedding.length) return;
  if (!isVectorIndexConfigured()) return;

  const restricts = [
    { namespace: "uid", allowList: [bookmark.userId] },
    { namespace: "type", allowList: [classifyResult.contentType] },
    { namespace: "source", allowList: [resolveResult.source] },
  ];
  if (cluster.clusterId) {
    restricts.push({ namespace: "cluster", allowList: [cluster.clusterId] });
  }

  await upsertDatapoint({
    datapointId: fp.textEmbeddingId,
    embedding: fp.textEmbedding,
    restricts,
    crowdingTag: bookmark.userId,
  });
}
