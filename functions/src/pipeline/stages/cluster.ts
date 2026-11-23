import { getFirestore } from "firebase-admin/firestore";
import { cosineSimilarity } from "../../ai/vectorIndex";
import type { ClusterAssignment, FingerprintResult, PipelineBookmark } from "../types";

const CLUSTER_JOIN_THRESHOLD = 0.70;

export async function assignCluster(
  bookmark: PipelineBookmark,
  fp: FingerprintResult | null,
): Promise<ClusterAssignment> {
  if (!fp?.textEmbedding.length) return { clusterId: null, pending: true };

  try {
    const clustersRef = getFirestore()
      .collection("users")
      .doc(bookmark.userId)
      .collection("clusters");
    const snap = await clustersRef.limit(50).get();

    let bestId: string | null = null;
    let bestSim = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const centroid = Array.isArray(data.centroid_embedding) ? (data.centroid_embedding as number[]) : null;
      if (!centroid) continue;
      const sim = cosineSimilarity(fp.textEmbedding, centroid);
      if (sim > bestSim) {
        bestSim = sim;
        bestId = doc.id;
      }
    }

    if (bestId && bestSim >= CLUSTER_JOIN_THRESHOLD) {
      return { clusterId: bestId, pending: false };
    }
    return { clusterId: null, pending: true };
  } catch (err) {
    console.warn("[pipeline.cluster] failed", err instanceof Error ? err.message : err);
    return { clusterId: null, pending: true };
  }
}
