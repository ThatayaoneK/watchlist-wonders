import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { readRange } from "./metrics";
import { requireAdmin } from "./auth";
import { memoizeAdminQuery } from "./cache";

export interface SystemHealthResponse {
  ingestion: Array<{ date: string; created: number; success: number; partial: number; error: number }>;
  failureRate: number;
  recentErrors: Array<{ stage: string; count: number }>;
  embedQueue: number;
}

export interface UserBehaviorResponse {
  totalUsers: number;
  totalBookmarks: number;
  savesByDay: Array<{ date: string; saves: number }>;
  captureByDay: Array<{
    date: string;
    total: number;
    autoSaved: number;
    needsSelection: number;
    unresolved: number;
    duplicate: number;
  }>;
  captureBySurface: Record<string, number>;
  captureByStatus: Record<string, number>;
  searchUsage: Array<{ date: string; queries: number; hits: number }>;
  deadBookmarkRatio: number;
  revisitRate: number;
}

export interface IntelligenceQualityResponse {
  classifierDistribution: Record<string, number>;
  resolveDistribution: Record<string, number>;
  averageConfidence: number;
  suggestedRatio: number;
  autoTagsPerBookmark: number;
}

export interface ContentGraphResponse {
  topClusters: Array<{ id: string; name: string; size: number; emerging: boolean; userId: string }>;
  totalClusters: number;
}

export interface RetentionResponse {
  surfaced: number;
  opened: number;
  dismissed: number;
  openRate: number;
  dismissRate: number;
  byDay: Array<{ date: string; surfaced: number; opened: number; dismissed: number }>;
}

const callable = <Req, Res>(
  handler: (request: CallableRequest<Req>) => Promise<Res>,
) =>
  onCall<Req, Promise<Res>>(
    { timeoutSeconds: 60, memory: "512MiB", cors: true },
    async (request) => {
      requireAdmin(request);
      return handler(request);
    },
  );

function sumCounter(counters: Record<string, number>, prefix: string): number {
  let total = 0;
  for (const [k, v] of Object.entries(counters)) {
    if (k.startsWith(prefix)) total += typeof v === "number" ? v : 0;
  }
  return total;
}

export const adminSystemHealth = callable<unknown, SystemHealthResponse>(() =>
  memoizeAdminQuery("adminSystemHealth", async () => {
  const range = await readRange(14);
  const ingestion = range.map((d) => ({
    date: d.date,
    created: sumCounter(d.counters, "pipeline.completed") + sumCounter(d.counters, "pipeline.partial"),
    success: d.counters["pipeline.completed"] ?? 0,
    partial: d.counters["pipeline.partial"] ?? 0,
    error: d.counters["pipeline.error"] ?? 0,
  }));
  const totalRuns = ingestion.reduce((s, d) => s + d.success + d.partial + d.error, 0);
  const totalErrors = ingestion.reduce((s, d) => s + d.error, 0);
  const failureRate = totalRuns === 0 ? 0 : totalErrors / totalRuns;
  const errorByStage: Record<string, number> = {};
  for (const d of range) {
    for (const [k, v] of Object.entries(d.counters)) {
      if (k.endsWith(".error") && k.startsWith("pipeline.")) {
        const stage = k.slice("pipeline.".length, -".error".length);
        errorByStage[stage] = (errorByStage[stage] ?? 0) + (typeof v === "number" ? v : 0);
      }
    }
  }
  const recentErrors = Object.entries(errorByStage)
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const pendingSnap = await getFirestore()
    .collectionGroup("bookmarks")
    .where("pending_cluster_assignment", "==", true)
    .count()
    .get()
    .catch(() => null);
  const embedQueue = pendingSnap?.data().count ?? 0;

  return { ingestion, failureRate, recentErrors, embedQueue };
}));

export const adminUserBehavior = callable<unknown, UserBehaviorResponse>(() =>
  memoizeAdminQuery("adminUserBehavior", async () => {
  const range = await readRange(14);
  const savesByDay = range.map((d) => ({
    date: d.date,
    saves: d.counters["pipeline.completed"] ?? 0,
  }));
  const captureByDay = range.map((d) => ({
    date: d.date,
    total: d.counters["capture.request"] ?? 0,
    autoSaved: d.counters["capture.status.auto_saved"] ?? 0,
    needsSelection: d.counters["capture.status.needs_selection"] ?? 0,
    unresolved: d.counters["capture.status.unresolved"] ?? 0,
    duplicate: d.counters["capture.status.duplicate"] ?? 0,
  }));
  const searchUsage = range.map((d) => ({
    date: d.date,
    queries: d.counters["search.query"] ?? 0,
    hits: d.counters["search.hit"] ?? 0,
  }));
  const captureBySurface: Record<string, number> = {};
  const captureByStatus: Record<string, number> = {};
  for (const d of range) {
    for (const [key, value] of Object.entries(d.counters)) {
      if (key.startsWith("capture.surface.")) {
        const surface = key.slice("capture.surface.".length);
        captureBySurface[surface] = (captureBySurface[surface] ?? 0) + (typeof value === "number" ? value : 0);
      }
      if (key.startsWith("capture.status.")) {
        const status = key.slice("capture.status.".length);
        captureByStatus[status] = (captureByStatus[status] ?? 0) + (typeof value === "number" ? value : 0);
      }
    }
  }

  const usersSnap = await getFirestore().collection("users").count().get().catch(() => null);
  const bookmarksSnap = await getFirestore().collectionGroup("bookmarks").count().get().catch(() => null);
  const totalUsers = usersSnap?.data().count ?? 0;
  const totalBookmarks = bookmarksSnap?.data().count ?? 0;

  const deadSnap = await getFirestore()
    .collectionGroup("bookmarks")
    .where("canonical_entity", "==", null)
    .count()
    .get()
    .catch(() => null);
  const dead = deadSnap?.data().count ?? 0;
  const deadBookmarkRatio = totalBookmarks === 0 ? 0 : dead / totalBookmarks;

  const totalQueries = searchUsage.reduce((s, d) => s + d.queries, 0);
  const totalHits = searchUsage.reduce((s, d) => s + d.hits, 0);
  const revisitRate = totalQueries === 0 ? 0 : totalHits / totalQueries;

  return {
    totalUsers,
    totalBookmarks,
    savesByDay,
    captureByDay,
    captureBySurface,
    captureByStatus,
    searchUsage,
    deadBookmarkRatio,
    revisitRate,
  };
}));

export const adminIntelligenceQuality = callable<unknown, IntelligenceQualityResponse>(() =>
  memoizeAdminQuery("adminIntelligenceQuality", async () => {
  const range = await readRange(14);
  const classifierDistribution: Record<string, number> = {};
  const resolveDistribution: Record<string, number> = {};
  let autoTagSuccess = 0;
  let autoTagBookmarks = 0;
  let suggested = 0;
  let matched = 0;
  for (const d of range) {
    for (const [k, v] of Object.entries(d.counters)) {
      const value = typeof v === "number" ? v : 0;
      if (k.startsWith("pipeline.classify.type.")) {
        const type = k.slice("pipeline.classify.type.".length);
        classifierDistribution[type] = (classifierDistribution[type] ?? 0) + value;
      }
      if (k.startsWith("pipeline.resolve.source.")) {
        const src = k.slice("pipeline.resolve.source.".length);
        resolveDistribution[src] = (resolveDistribution[src] ?? 0) + value;
      }
      if (k === "pipeline.autotag.success") autoTagSuccess += value;
      if (k === "pipeline.completed" || k === "pipeline.partial") autoTagBookmarks += value;
      if (k === "pipeline.resolve.suggested") suggested += value;
      if (k === "pipeline.resolve.matched") matched += value;
    }
  }
  const totalResolved = suggested + matched;
  return {
    classifierDistribution,
    resolveDistribution,
    averageConfidence: 0, // computed elsewhere; reserved for sampling
    suggestedRatio: totalResolved === 0 ? 0 : suggested / totalResolved,
    autoTagsPerBookmark: autoTagBookmarks === 0 ? 0 : autoTagSuccess / autoTagBookmarks,
  };
}));

export const adminContentGraph = callable<unknown, ContentGraphResponse>(() =>
  memoizeAdminQuery("adminContentGraph", async () => {
  const snap = await getFirestore()
    .collectionGroup("clusters")
    .orderBy("member_count", "desc")
    .limit(50)
    .get()
    .catch(() => null);

  const topClusters = (snap?.docs ?? []).map((d) => {
    const data = d.data();
    const userId = d.ref.parent.parent?.id ?? "unknown";
    return {
      id: d.id,
      name: typeof data.name === "string" ? data.name : "Cluster",
      size: typeof data.member_count === "number" ? data.member_count : 0,
      emerging: data.emerging_trend === true,
      userId,
    };
  });

  const countSnap = await getFirestore().collectionGroup("clusters").count().get().catch(() => null);
  const totalClusters = countSnap?.data().count ?? topClusters.length;
  return { topClusters, totalClusters };
}));

export const adminRetention = callable<unknown, RetentionResponse>(() =>
  memoizeAdminQuery("adminRetention", async () => {
  const range = await readRange(14);
  const byDay = range.map((d) => ({
    date: d.date,
    surfaced: d.counters["resurface.events.created"] ?? 0,
    opened: d.counters["resurface.events.opened"] ?? 0,
    dismissed: d.counters["resurface.events.dismissed"] ?? 0,
  }));
  const surfaced = byDay.reduce((s, d) => s + d.surfaced, 0);
  const opened = byDay.reduce((s, d) => s + d.opened, 0);
  const dismissed = byDay.reduce((s, d) => s + d.dismissed, 0);
  return {
    surfaced,
    opened,
    dismissed,
    openRate: surfaced === 0 ? 0 : opened / surfaced,
    dismissRate: surfaced === 0 ? 0 : dismissed / surfaced,
    byDay,
  };
}));

export const recordView = onCall<{ bookmarkId: string }>(
  { timeoutSeconds: 10, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const uid = request.auth.uid;
    const id = request.data?.bookmarkId;
    if (!id || typeof id !== "string") {
      throw new HttpsError("invalid-argument", "bookmarkId required");
    }
    const { bumpView } = await import("../pipeline/stages/persist");
    await bumpView(uid, id);
    const { incrementMetric } = await import("./metrics");
    await incrementMetric("bookmark.view");
    return { ok: true };
  },
);

export const respondToResurface = onCall<{ eventId: string; action: "opened" | "dismissed" }>(
  { timeoutSeconds: 10, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const uid = request.auth.uid;
    const { eventId, action } = request.data ?? { eventId: "", action: "opened" };
    if (!eventId || (action !== "opened" && action !== "dismissed")) {
      throw new HttpsError("invalid-argument", "eventId and valid action required");
    }
    const ref = getFirestore()
      .collection("users")
      .doc(uid)
      .collection("resurfaceEvents")
      .doc(eventId);
    const stamp = new Date().toISOString();
    await ref.set(
      action === "opened" ? { opened_at: stamp } : { dismissed_at: stamp },
      { merge: true },
    );
    await (await import("./metrics")).incrementMetric(`resurface.events.${action}`);
    return { ok: true };
  },
);
