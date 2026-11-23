import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { embedQuery, isVertexConfigured } from "../ai/vertex";
import { queryNearest, isVectorIndexConfigured } from "../ai/vectorIndex";
import { incrementMetric } from "../admin/metrics";
import { rank, type RankableBookmark, type RankedBookmark } from "./rank";

export type SearchMode = "auto" | "semantic" | "keyword" | "temporal" | "context";

interface SearchPayload {
  query?: string;
  mode?: SearchMode;
  topK?: number;
  filters?: {
    contentType?: string;
    clusterId?: string;
    minImportance?: number;
  };
}

interface BookmarkResultPayload {
  id: string;
  title: string;
  poster_url: string | null;
  type: string;
  provider: string;
  tags: string[];
  auto_tags: string[];
  canonical_entity: unknown;
  cluster_id: string | null;
  score: number;
  breakdown: RankedBookmark["breakdown"];
  reason: string;
}

interface SearchResponse {
  mode: SearchMode;
  query: string;
  results: BookmarkResultPayload[];
}

const TEMPORAL_PATTERNS = [
  /last\s+(week|month|year|7\s*days|30\s*days|90\s*days)/i,
  /yesterday|today|this\s+(week|month|year)/i,
  /past\s+\d+\s+(days?|weeks?|months?|years?)/i,
];

function detectMode(query: string, hint: SearchMode | undefined): SearchMode {
  if (hint && hint !== "auto") return hint;
  if (!query.trim()) return "temporal";
  if (TEMPORAL_PATTERNS.some((r) => r.test(query))) return "temporal";
  return "semantic";
}

function parseTemporalRange(query: string, now = Date.now()): { fromMs: number; toMs: number } {
  const day = 24 * 60 * 60 * 1000;
  const toMs = now;
  let fromMs = now - 30 * day;
  if (/last\s+week|past\s+7\s*days|7\s*days/i.test(query)) fromMs = now - 7 * day;
  else if (/last\s+month|past\s+30\s*days|30\s*days/i.test(query)) fromMs = now - 30 * day;
  else if (/last\s+year|past\s+365\s*days/i.test(query)) fromMs = now - 365 * day;
  else if (/yesterday/i.test(query)) fromMs = now - day;
  else if (/this\s+week/i.test(query)) fromMs = now - 7 * day;
  return { fromMs, toMs };
}

interface BookmarkDoc {
  id: string;
  title: string;
  poster_url: string | null;
  type: string;
  provider: string;
  tags: string[];
  auto_tags: string[];
  canonical_entity: unknown;
  cluster_id: string | null;
  created_at: string | null;
  view_count: number;
  importance_score: number;
  embedding_ref: string | null;
  notes: string | null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

function toBookmarkDoc(snap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): BookmarkDoc {
  const d = snap.data() ?? {};
  const isV2 = d.schemaVersion === 2;
  const source = asRecord(d.source);
  const media = asRecord(d.media);
  const resolution = asRecord(d.resolution);
  const library = asRecord(d.library);
  const intelligence = asRecord(d.intelligence);
  return {
    id: snap.id,
    title: asString(isV2 ? media.title : d.title),
    poster_url: typeof (isV2 ? media.posterUrl : d.poster_url) === "string" ? String(isV2 ? media.posterUrl : d.poster_url) : null,
    type: asString(isV2 ? media.type : d.type) || "other",
    provider: asString(isV2 ? source.platform : d.provider) || "generic",
    tags: asArray(isV2 ? library.tags : d.tags),
    auto_tags: asArray(isV2 ? intelligence.autoTags : d.auto_tags),
    canonical_entity: isV2 ? resolution : d.canonical_entity ?? null,
    cluster_id: typeof (isV2 ? intelligence.clusterId : d.cluster_id) === "string" ? String(isV2 ? intelligence.clusterId : d.cluster_id) : null,
    created_at: asIso(isV2 ? d.createdAt : d.created_at),
    view_count: asNumber(isV2 ? intelligence.viewCount : d.view_count, 0),
    importance_score: asNumber(isV2 ? intelligence.importanceScore : d.importance_score, 0.5),
    embedding_ref: typeof (isV2 ? intelligence.embeddingRef : d.embedding_ref) === "string" ? String(isV2 ? intelligence.embeddingRef : d.embedding_ref) : null,
    notes: typeof (isV2 ? library.notes : d.notes) === "string" ? String(isV2 ? library.notes : d.notes) : null,
  };
}

async function fetchByIds(uid: string, ids: string[]): Promise<BookmarkDoc[]> {
  const db = getFirestore();
  const refs = ids.map((id) => db.collection("users").doc(uid).collection("bookmarks").doc(id));
  if (!refs.length) return [];
  const snaps = await db.getAll(...refs);
  return snaps.filter((s) => s.exists).map(toBookmarkDoc);
}

async function fetchRecent(uid: string, limit: number): Promise<BookmarkDoc[]> {
  const collection = getFirestore().collection("users").doc(uid).collection("bookmarks");
  const [legacy, v2] = await Promise.all([
    collection.orderBy("created_at", "desc").limit(limit).get(),
    collection.orderBy("createdAt", "desc").limit(limit).get(),
  ]);
  return [...legacy.docs, ...v2.docs]
    .map(toBookmarkDoc)
    .sort((left, right) => Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? ""))
    .slice(0, limit);
}

async function fetchInDateRange(uid: string, fromMs: number, toMs: number, limit: number): Promise<BookmarkDoc[]> {
  const collection = getFirestore().collection("users").doc(uid).collection("bookmarks");
  const [legacy, v2] = await Promise.all([
    collection.where("created_at", ">=", new Date(fromMs).toISOString())
      .where("created_at", "<=", new Date(toMs).toISOString()).orderBy("created_at", "desc").limit(limit).get(),
    collection.where("createdAt", ">=", Timestamp.fromMillis(fromMs))
      .where("createdAt", "<=", Timestamp.fromMillis(toMs)).orderBy("createdAt", "desc").limit(limit).get(),
  ]);
  return [...legacy.docs, ...v2.docs]
    .map(toBookmarkDoc)
    .sort((left, right) => Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? ""))
    .slice(0, limit);
}

function keywordMatch(query: string, docs: BookmarkDoc[]): BookmarkDoc[] {
  const term = query.toLowerCase().trim();
  if (!term) return docs;
  return docs.filter(
    (d) =>
      d.title.toLowerCase().includes(term) ||
      d.tags.some((t) => t.toLowerCase().includes(term)) ||
      d.auto_tags.some((t) => t.toLowerCase().includes(term)) ||
      (d.notes ?? "").toLowerCase().includes(term),
  );
}

function applyFilters(docs: BookmarkDoc[], filters?: SearchPayload["filters"]): BookmarkDoc[] {
  if (!filters) return docs;
  return docs.filter((d) => {
    if (filters.clusterId && d.cluster_id !== filters.clusterId) return false;
    if (filters.minImportance !== undefined && d.importance_score < filters.minImportance) return false;
    if (filters.contentType) {
      const ce = d.canonical_entity as { type?: string } | null;
      if (ce?.type !== filters.contentType && d.type !== filters.contentType) return false;
    }
    return true;
  });
}

function reasonFor(item: RankedBookmark): string {
  const { semantic, recency, engagement, importance } = item.breakdown;
  const top = Math.max(semantic, recency, engagement, importance);
  if (top === semantic) return "semantic_match";
  if (top === importance) return "high_importance";
  if (top === recency) return "recent";
  if (top === engagement) return "frequently_revisited";
  return "balanced";
}

export const searchBookmarks = onCall<SearchPayload, Promise<SearchResponse>>(
  {
    secrets: [defineSecret("TMDB_API_KEY")],
    timeoutSeconds: 30,
    memory: "512MiB",
    cors: true,
  },
  async (request: CallableRequest<SearchPayload>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const uid = request.auth.uid;
    const query = (request.data?.query ?? "").trim();
    const topK = Math.min(Math.max(request.data?.topK ?? 20, 1), 50);
    const mode = detectMode(query, request.data?.mode);
    await incrementMetric("search.query");
    await incrementMetric(`search.mode.${mode}`);

    let docs: BookmarkDoc[] = [];
    const similarityById = new Map<string, number>();

    if (mode === "temporal") {
      const range = parseTemporalRange(query);
      docs = await fetchInDateRange(uid, range.fromMs, range.toMs, 200);
    } else if (mode === "semantic" || mode === "context") {
      if (isVertexConfigured() && isVectorIndexConfigured() && query) {
        try {
          const qEmbedding = await embedQuery(query);
          const neighbors = await queryNearest({
            embedding: qEmbedding,
            topK,
            filters: [{ namespace: "uid", allowList: [uid] }],
          });
          const ids = neighbors
            .map((n) => n.datapointId.split(":")[1])
            .filter((id): id is string => !!id);
          docs = await fetchByIds(uid, ids);
          neighbors.forEach((n) => {
            const id = n.datapointId.split(":")[1];
            if (id) similarityById.set(id, Math.max(0, 1 - n.distance));
          });
        } catch (err) {
          console.warn("[searchBookmarks] vector path failed, falling back", err instanceof Error ? err.message : err);
          await incrementMetric("search.fallback.keyword");
        }
      }
      if (docs.length === 0) {
        const recent = await fetchRecent(uid, 200);
        docs = keywordMatch(query, recent);
      }
    } else {
      const recent = await fetchRecent(uid, 200);
      docs = keywordMatch(query, recent);
    }

    docs = applyFilters(docs, request.data?.filters);

    const rankable: RankableBookmark[] = docs.map((d) => ({
      id: d.id,
      semanticSimilarity: similarityById.get(d.id) ?? (mode === "semantic" ? 0.4 : 0.6),
      createdAt: d.created_at,
      viewCount: d.view_count,
      importanceScore: d.importance_score,
    }));

    const ranked = rank(rankable).slice(0, topK);
    const byId = new Map(docs.map((d) => [d.id, d]));
    const results: BookmarkResultPayload[] = ranked
      .map((r): BookmarkResultPayload | null => {
        const doc = byId.get(r.id);
        if (!doc) return null;
        return {
          id: doc.id,
          title: doc.title,
          poster_url: doc.poster_url,
          type: doc.type,
          provider: doc.provider,
          tags: doc.tags,
          auto_tags: doc.auto_tags,
          canonical_entity: doc.canonical_entity,
          cluster_id: doc.cluster_id,
          score: r.score,
          breakdown: r.breakdown,
          reason: reasonFor(r),
        };
      })
      .filter((x): x is BookmarkResultPayload => x !== null);

    if (results.length > 0) await incrementMetric("search.hit");
    else await incrementMetric("search.miss");

    return { mode, query, results };
  },
);
