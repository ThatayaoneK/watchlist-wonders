import { GoogleAuth } from "google-auth-library";
import { VERTEX, isVertexConfigured } from "./vertex";

const INDEX_ID = process.env.VERTEX_INDEX_ID;
const INDEX_ENDPOINT_ID = process.env.VERTEX_INDEX_ENDPOINT_ID;
const DEPLOYED_INDEX_ID = process.env.VERTEX_DEPLOYED_INDEX_ID;

let cachedAuth: GoogleAuth | null = null;
function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  }
  return cachedAuth;
}

function baseHost(): string {
  return `https://${VERTEX.location}-aiplatform.googleapis.com/v1`;
}

function indexUri(): string {
  if (!isVertexConfigured() || !INDEX_ID) throw new Error("Vector index not configured");
  return `projects/${VERTEX.project}/locations/${VERTEX.location}/indexes/${INDEX_ID}`;
}

function indexEndpointUri(): string {
  if (!isVertexConfigured() || !INDEX_ENDPOINT_ID) throw new Error("Vector index endpoint not configured");
  return `projects/${VERTEX.project}/locations/${VERTEX.location}/indexEndpoints/${INDEX_ENDPOINT_ID}`;
}

async function vertexFetch<T>(path: string, body: unknown): Promise<T> {
  const client = await getAuth().getClient();
  const headers = await client.getRequestHeaders();
  const res = await fetch(`${baseHost()}/${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VectorIndex ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export interface Restrict {
  namespace: string;
  allowList?: string[];
  denyList?: string[];
}

export interface UpsertParams {
  datapointId: string;
  embedding: number[];
  restricts?: Restrict[];
  crowdingTag?: string;
}

export function isVectorIndexConfigured(): boolean {
  return isVertexConfigured() && !!INDEX_ID && !!INDEX_ENDPOINT_ID && !!DEPLOYED_INDEX_ID;
}

export async function upsertDatapoint(params: UpsertParams): Promise<void> {
  if (!isVectorIndexConfigured()) {
    console.warn("[vectorIndex] not configured, skipping upsert", params.datapointId);
    return;
  }
  const dp: Record<string, unknown> = {
    datapointId: params.datapointId,
    featureVector: params.embedding,
  };
  if (params.restricts?.length) {
    dp.restricts = params.restricts.map((r) => ({
      namespace: r.namespace,
      allowList: r.allowList,
      denyList: r.denyList,
    }));
  }
  if (params.crowdingTag) {
    dp.crowdingTag = { crowdingAttribute: params.crowdingTag };
  }
  await vertexFetch(`${indexUri()}:upsertDatapoints`, { datapoints: [dp] });
}

export async function removeDatapoint(datapointId: string): Promise<void> {
  if (!isVectorIndexConfigured()) return;
  await vertexFetch(`${indexUri()}:removeDatapoints`, { datapointIds: [datapointId] });
}

export interface Neighbor {
  datapointId: string;
  distance: number;
}

export interface QueryParams {
  embedding: number[];
  topK?: number;
  filters?: Restrict[];
}

interface FindNeighborsResponse {
  nearestNeighbors?: Array<{
    id: string;
    neighbors?: Array<{ datapoint?: { datapointId?: string }; distance?: number }>;
  }>;
}

export async function queryNearest(params: QueryParams): Promise<Neighbor[]> {
  if (!isVectorIndexConfigured()) return [];
  const query: Record<string, unknown> = {
    datapoint: { featureVector: params.embedding },
    neighborCount: params.topK ?? 20,
  };
  if (params.filters?.length) {
    query.datapoint = {
      ...(query.datapoint as object),
      restricts: params.filters.map((r) => ({
        namespace: r.namespace,
        allowList: r.allowList,
        denyList: r.denyList,
      })),
    };
  }
  const json = await vertexFetch<FindNeighborsResponse>(
    `${indexEndpointUri()}:findNeighbors`,
    {
      deployedIndexId: DEPLOYED_INDEX_ID,
      queries: [query],
      returnFullDatapoint: false,
    },
  );
  const neighbors = json.nearestNeighbors?.[0]?.neighbors ?? [];
  return neighbors
    .map((n) => ({
      datapointId: n.datapoint?.datapointId ?? "",
      distance: n.distance ?? 0,
    }))
    .filter((n) => n.datapointId);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
