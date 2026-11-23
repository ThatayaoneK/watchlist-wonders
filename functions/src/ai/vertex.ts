import { GoogleAuth } from "google-auth-library";

const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const VERTEX_PROJECT = process.env.VERTEX_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const EMBED_MODEL = "text-embedding-005";
const MULTIMODAL_EMBED_MODEL = "multimodalembedding@001";
const GENERATIVE_MODEL = "gemini-2.0-flash-001";

let cachedAuth: GoogleAuth | null = null;
function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  }
  return cachedAuth;
}

function vertexBaseUrl(): string {
  if (!VERTEX_PROJECT) {
    throw new Error("Vertex project not configured (set VERTEX_PROJECT_ID or rely on GCLOUD_PROJECT).");
  }
  return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}`;
}

export function isVertexConfigured(): boolean {
  return Boolean(VERTEX_PROJECT);
}

async function vertexFetch<T>(path: string, body: unknown): Promise<T> {
  const client = await getAuth().getClient();
  const headers = await client.getRequestHeaders();
  const res = await fetch(`${vertexBaseUrl()}${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vertex ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

interface EmbedResponse {
  predictions: Array<{ embeddings: { values: number[]; statistics?: { token_count: number } } }>;
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) throw new Error("embedText: empty input");
  const json = await vertexFetch<EmbedResponse>(
    `/publishers/google/models/${EMBED_MODEL}:predict`,
    { instances: [{ task_type: "RETRIEVAL_DOCUMENT", content: trimmed }] },
  );
  return json.predictions[0]?.embeddings?.values ?? [];
}

export async function embedQuery(query: string): Promise<number[]> {
  const trimmed = query.trim().slice(0, 4000);
  if (!trimmed) throw new Error("embedQuery: empty input");
  const json = await vertexFetch<EmbedResponse>(
    `/publishers/google/models/${EMBED_MODEL}:predict`,
    { instances: [{ task_type: "RETRIEVAL_QUERY", content: trimmed }] },
  );
  return json.predictions[0]?.embeddings?.values ?? [];
}

interface MultimodalEmbedResponse {
  predictions: Array<{ imageEmbedding?: number[]; textEmbedding?: number[] }>;
}

export async function embedImage(imageUrl: string): Promise<number[] | null> {
  if (!imageUrl) return null;
  try {
    const json = await vertexFetch<MultimodalEmbedResponse>(
      `/publishers/google/models/${MULTIMODAL_EMBED_MODEL}:predict`,
      { instances: [{ image: { gcsUri: imageUrl.startsWith("gs://") ? imageUrl : undefined, bytesBase64Encoded: undefined } }] },
    );
    return json.predictions[0]?.imageEmbedding ?? null;
  } catch (err) {
    console.warn("[vertex.embedImage] failed", err instanceof Error ? err.message : err);
    return null;
  }
}

interface GenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function generateStructured<T>(prompt: string, schema: Record<string, unknown>): Promise<T> {
  const json = await vertexFetch<GenerateResponse>(
    `/publishers/google/models/${GENERATIVE_MODEL}:generateContent`,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        responseMimeType: "application/json",
        responseSchema: schema,
        maxOutputTokens: 1024,
      },
    },
  );
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text) as T;
}

export const VERTEX = { project: VERTEX_PROJECT, location: VERTEX_LOCATION };
