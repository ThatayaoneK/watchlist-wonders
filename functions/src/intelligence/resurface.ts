import { scheduledUsers } from "./scheduledUsers";
import { getFirestore } from "firebase-admin/firestore";
import { incrementMetric } from "../admin/metrics";

const IMPORTANCE_FLOOR = 0.6;
const FORGOTTEN_DAYS = 30;
const SUPPRESSION_DAYS = 14;
const PER_USER_LIMIT = 3;

interface ResurfaceCandidate {
  bookmark_id: string;
  importance_score: number;
  last_viewed_at: string | null;
  created_at: string | null;
  cluster_id: string | null;
  title: string;
}

function daysSince(iso: string | null, now = Date.now()): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (now - t) / (24 * 60 * 60 * 1000);
}

async function recentEventBookmarkIds(uid: string, now = Date.now()): Promise<Set<string>> {
  const cutoff = new Date(now - SUPPRESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const snap = await getFirestore()
    .collection("users")
    .doc(uid)
    .collection("resurfaceEvents")
    .where("surfaced_at", ">=", cutoff)
    .get();
  const ids = new Set<string>();
  for (const d of snap.docs) {
    const raw = d.data();
    const iso = (value: unknown): string | null => typeof value === "string" ? value : value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate().toISOString() : null;
    const data = raw.schemaVersion === 2 ? {
      importance_score: raw.intelligence?.importanceScore, last_viewed_at: iso(raw.intelligence?.lastViewedAt),
      created_at: iso(raw.createdAt), cluster_id: raw.intelligence?.clusterId, title: raw.media?.title,
    } : raw;
    if (typeof data.bookmark_id === "string") ids.add(data.bookmark_id);
  }
  return ids;
}

async function loadCandidates(uid: string): Promise<ResurfaceCandidate[]> {
  const col = getFirestore().collection("users").doc(uid).collection("bookmarks");
  const pages = await Promise.all(["importance_score", "intelligence.importanceScore"].map(field =>
    col.where(field, ">=", IMPORTANCE_FLOOR).orderBy(field, "desc").limit(200).get()));
  const snap = { docs: [...new Map(pages.flatMap(page => page.docs).map(d => [d.id, d])).values()] };
  return snap.docs.map((d) => {
    const raw = d.data();
    const iso = (value: unknown): string | null => typeof value === "string" ? value : value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate().toISOString() : null;
    const data = raw.schemaVersion === 2 ? {
      importance_score: raw.intelligence?.importanceScore, last_viewed_at: iso(raw.intelligence?.lastViewedAt),
      created_at: iso(raw.createdAt), cluster_id: raw.intelligence?.clusterId, title: raw.media?.title,
    } : raw;
    return {
      bookmark_id: d.id,
      importance_score: typeof data.importance_score === "number" ? data.importance_score : 0,
      last_viewed_at: typeof data.last_viewed_at === "string" ? data.last_viewed_at : null,
      created_at: typeof data.created_at === "string" ? data.created_at : null,
      cluster_id: typeof data.cluster_id === "string" ? data.cluster_id : null,
      title: typeof data.title === "string" ? data.title : "",
    };
  });
}

function decayedScore(c: ResurfaceCandidate, now: number): number {
  const lastSeen = c.last_viewed_at ?? c.created_at;
  const days = daysSince(lastSeen, now);
  return c.importance_score * Math.exp(-days / 90);
}

export async function resurfaceForUser(uid: string, now = Date.now()): Promise<{ surfaced: number }> {
  const suppressed = await recentEventBookmarkIds(uid, now);
  const candidates = await loadCandidates(uid);

  const eligible = candidates
    .filter((c) => !suppressed.has(c.bookmark_id))
    .filter((c) => daysSince(c.last_viewed_at ?? c.created_at, now) >= FORGOTTEN_DAYS)
    .map((c) => ({ candidate: c, score: decayedScore(c, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_USER_LIMIT);

  if (!eligible.length) return { surfaced: 0 };

  const db = getFirestore();
  const batch = db.batch();
  const eventsCol = db.collection("users").doc(uid).collection("resurfaceEvents");
  const feedCol = db.collection("feed").doc(uid).collection("items");
  const surfacedAt = new Date(now).toISOString();

  for (const { candidate } of eligible) {
    const eventRef = eventsCol.doc();
    batch.set(eventRef, {
      id: eventRef.id,
      bookmark_id: candidate.bookmark_id,
      reason: "forgotten_high_value",
      surfaced_at: surfacedAt,
      dismissed_at: null,
      opened_at: null,
    });
    const feedRef = feedCol.doc();
    batch.set(feedRef, {
      id: feedRef.id,
      actor_uid: uid,
      action: "resurfaced",
      bookmark_id: candidate.bookmark_id,
      created_at: surfacedAt,
      resurface_reason: "forgotten_high_value",
      resurface_event_id: eventRef.id,
    });
  }
  await batch.commit();
  await incrementMetric("resurface.events.created", eligible.length);
  return { surfaced: eligible.length };
}

export async function resurfaceAllUsers(maxUsers = 200): Promise<{ users: number; surfaced: number }> {
  const usersSnap = await scheduledUsers("resurface", maxUsers);
  let users = 0;
  let surfaced = 0;
  for (const u of usersSnap.docs) {
    const r = await resurfaceForUser(u.id).catch((err) => {
      console.warn("[resurface] user failed", u.id, err);
      return { surfaced: 0 };
    });
    users++;
    surfaced += r.surfaced;
  }
  await incrementMetric("resurface.run.completed");
  await usersSnap.complete();
  return { users, surfaced };
}


