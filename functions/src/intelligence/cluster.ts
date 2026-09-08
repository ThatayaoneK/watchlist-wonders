import { scheduledUsers } from "./scheduledUsers";
import { getFirestore } from "firebase-admin/firestore";
import { generateStructured, isVertexConfigured } from "../ai/vertex";
import { cosineSimilarity } from "../ai/vectorIndex";
import { incrementMetric } from "../admin/metrics";

interface BookmarkEmbedding {
  id: string;
  title: string;
  embedding: number[];
  tags: string[];
  isV2: boolean;
}

const CLUSTER_NAME_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    emerging: { type: "boolean" },
  },
  required: ["name"],
};

// In this codebase embeddings live in Vertex Vector Search, not Firestore. For the
// reclustering job we operate on a working set drawn from the bookmark fingerprint's
// cached `centroid_embedding` (clusters) and an in-memory representative drawn at
// cluster-creation time. This keeps the job bounded and tractable.

async function loadCentroids(uid: string): Promise<Map<string, { embedding: number[]; titles: string[] }>> {
  const snap = await getFirestore().collection("users").doc(uid).collection("clusters").get();
  const out = new Map<string, { embedding: number[]; titles: string[] }>();
  for (const d of snap.docs) {
    const data = d.data();
    const emb = Array.isArray(data.centroid_embedding) ? (data.centroid_embedding as number[]) : null;
    if (!emb) continue;
    out.set(d.id, { embedding: emb, titles: Array.isArray(data.top_titles) ? (data.top_titles as string[]) : [] });
  }
  return out;
}

async function loadPendingBookmarks(uid: string): Promise<BookmarkEmbedding[]> {
  const collection = getFirestore().collection("users").doc(uid).collection("bookmarks");
  const [legacy, v2] = await Promise.all([
    collection.where("pending_cluster_assignment", "==", true).limit(100).get(),
    collection.where("intelligence.pendingClusterAssignment", "==", true).limit(100).get(),
  ]);

  const out: BookmarkEmbedding[] = [];
  for (const d of [...legacy.docs, ...v2.docs].slice(0, 100)) {
    const data = d.data();
    const isV2 = data.schemaVersion === 2;
    const media = data.media && typeof data.media === "object" && !Array.isArray(data.media)
      ? data.media as Record<string, unknown> : {};
    const intelligence = data.intelligence && typeof data.intelligence === "object" && !Array.isArray(data.intelligence)
      ? data.intelligence as Record<string, unknown> : {};
    const fingerprint = isV2 && intelligence.fingerprint && typeof intelligence.fingerprint === "object"
      ? intelligence.fingerprint as Record<string, unknown> : data.fingerprint;
    const embRefValue = isV2 ? intelligence.embeddingRef : data.embedding_ref;
    const embRef = typeof embRefValue === "string" ? embRefValue : null;
    if (!embRef) continue;
    // We don't have full embedding in Firestore — clustering uses a probe embedding
    // stamped onto the bookmark by the pipeline. For new bookmarks we pull a freshly
    // computed embedding from the pipeline's `fingerprint` cache if present.
    const cachedEmbedding = Array.isArray((fingerprint as Record<string, unknown> | undefined)?.embedding_cache)
      ? ((fingerprint as Record<string, unknown>).embedding_cache as number[])
      : null;
    if (!cachedEmbedding) continue;
    out.push({
      id: d.id,
      title: typeof (isV2 ? media.title : data.title) === "string" ? String(isV2 ? media.title : data.title) : "",
      embedding: cachedEmbedding,
      tags: Array.isArray(isV2 ? intelligence.autoTags : data.auto_tags) ? (isV2 ? intelligence.autoTags : data.auto_tags) as string[] : [],
      isV2,
    });
  }
  return out;
}

function seedClusterId(): string {
  return `cl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function nameCluster(titles: string[], tags: string[]): Promise<{ name: string; emerging: boolean }> {
  if (!isVertexConfigured() || !titles.length) {
    return { name: titles[0]?.slice(0, 40) || tags[0] || "Cluster", emerging: false };
  }
  try {
    const prompt = [
      "Name this cluster of saved bookmarks in 2-4 words, like a Spotify playlist title.",
      "Be specific — avoid 'media', 'content', 'misc'.",
      "Set emerging=true if the topic looks novel or recent.",
      "",
      `Top titles:\n- ${titles.slice(0, 5).join("\n- ")}`,
      `Tags: ${tags.slice(0, 10).join(", ")}`,
    ].join("\n");
    return await generateStructured<{ name: string; emerging: boolean }>(prompt, CLUSTER_NAME_SCHEMA);
  } catch {
    return { name: titles[0]?.slice(0, 40) || "Cluster", emerging: false };
  }
}

const JOIN_THRESHOLD = 0.70;

export async function runOnlineClustering(uid: string): Promise<{ assigned: number; seeded: number }> {
  const centroids = await loadCentroids(uid);
  const pending = await loadPendingBookmarks(uid);
  if (!pending.length) return { assigned: 0, seeded: 0 };

  const db = getFirestore();
  let assigned = 0;
  let seeded = 0;

  for (const item of pending) {
    let bestId: string | null = null;
    let bestSim = 0;
    centroids.forEach((c, id) => {
      const sim = cosineSimilarity(item.embedding, c.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestId = id;
      }
    });

    let targetId: string;
    if (bestId && bestSim >= JOIN_THRESHOLD) {
      targetId = bestId;
      assigned++;
    } else {
      targetId = seedClusterId();
      const { name, emerging } = await nameCluster([item.title], item.tags);
      await db.collection("users").doc(uid).collection("clusters").doc(targetId).set({
        id: targetId,
        name,
        centroid_ref: `centroid:${targetId}`,
        centroid_embedding: item.embedding,
        member_count: 1,
        last_updated: new Date().toISOString(),
        emerging_trend: emerging,
        top_titles: [item.title],
      });
      centroids.set(targetId, { embedding: item.embedding, titles: [item.title] });
      seeded++;
    }

    await db.collection("users").doc(uid).collection("bookmarks").doc(item.id).update(
      item.isV2 ? {
        "intelligence.clusterId": targetId,
        "intelligence.pendingClusterAssignment": false,
        "intelligence.fingerprint.embedding_cache": null,
      } : {
        cluster_id: targetId,
        pending_cluster_assignment: false,
        "fingerprint.embedding_cache": null,
      },
    );
  }

  await incrementMetric("clustering.online.run");
  return { assigned, seeded };
}

export async function runReclusteringForAllUsers(maxUsers = 200): Promise<{ users: number; clusters: number }> {
  const usersSnap = await scheduledUsers("cluster", maxUsers);
  let users = 0;
  let clusters = 0;
  for (const u of usersSnap.docs) {
    const r = await runOnlineClustering(u.id).catch((err) => {
      console.warn("[clustering] user failed", u.id, err);
      return { assigned: 0, seeded: 0 };
    });
    users++;
    clusters += r.seeded;
  }
  await usersSnap.complete();
  return { users, clusters };
}

