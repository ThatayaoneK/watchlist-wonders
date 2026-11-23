import { scheduledUsers } from "./scheduledUsers";
import { getFirestore } from "firebase-admin/firestore";
import { incrementMetric } from "../admin/metrics";

interface BookmarkLite {
  id: string;
  view_count: number;
  has_canonical: boolean;
  tags: string[];
  has_note: boolean;
  has_rating: boolean;
  user_id: string;
  isV2: boolean;
}

function normalizeViews(views: number, maxViews: number): number {
  if (maxViews <= 0) return 0;
  return Math.min(1, Math.log(views + 1) / Math.log(maxViews + 1));
}

function tagOverlap(tags: string[], userTopTags: Set<string>): number {
  if (!tags.length || userTopTags.size === 0) return 0;
  let hits = 0;
  for (const t of tags) if (userTopTags.has(t.toLowerCase())) hits++;
  return Math.min(1, hits / Math.max(1, tags.length));
}

function topUserTags(bookmarks: BookmarkLite[], n = 20): Set<string> {
  const counts: Record<string, number> = {};
  for (const b of bookmarks) {
    for (const t of b.tags) {
      const key = t.toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return new Set(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([t]) => t),
  );
}

async function loadUserBookmarks(uid: string): Promise<BookmarkLite[]> {
  const snap = await getFirestore()
    .collection("users")
    .doc(uid)
    .collection("bookmarks")
    .limit(1000)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    const isV2 = data.schemaVersion === 2;
    const library = data.library && typeof data.library === "object" && !Array.isArray(data.library)
      ? data.library as Record<string, unknown> : {};
    const resolution = data.resolution && typeof data.resolution === "object" && !Array.isArray(data.resolution)
      ? data.resolution as Record<string, unknown> : {};
    const intelligence = data.intelligence && typeof data.intelligence === "object" && !Array.isArray(data.intelligence)
      ? data.intelligence as Record<string, unknown> : {};
    return {
      id: d.id,
      user_id: uid,
      view_count: typeof (isV2 ? intelligence.viewCount : data.view_count) === "number" ? Number(isV2 ? intelligence.viewCount : data.view_count) : 0,
      has_canonical: isV2 ? resolution.status === "matched" : !!data.canonical_entity,
      tags: [
        ...(Array.isArray(isV2 ? library.tags : data.tags) ? (isV2 ? library.tags : data.tags) as string[] : []),
        ...(Array.isArray(isV2 ? intelligence.autoTags : data.auto_tags) ? (isV2 ? intelligence.autoTags : data.auto_tags) as string[] : []),
      ],
      has_note: typeof (isV2 ? library.notes : data.notes) === "string" && String(isV2 ? library.notes : data.notes).trim().length > 0,
      has_rating: typeof (isV2 ? library.rating : data.user_rating) === "number" && Number(isV2 ? library.rating : data.user_rating) > 0,
      isV2,
    };
  });
}

export async function recomputeImportance(uid: string): Promise<{ updated: number }> {
  const bookmarks = await loadUserBookmarks(uid);
  if (!bookmarks.length) return { updated: 0 };

  const maxViews = bookmarks.reduce((m, b) => Math.max(m, b.view_count), 0);
  const userTopTags = topUserTags(bookmarks);
  const db = getFirestore();
  let batch = db.batch();
  let updated = 0;

  for (const b of bookmarks) {
    const score =
      0.4 * normalizeViews(b.view_count, maxViews) +
      0.3 * (b.has_canonical ? 1 : 0.3) +
      0.2 * tagOverlap(b.tags, userTopTags) +
      0.1 * (b.has_note || b.has_rating ? 1 : 0);

    const ref = db.collection("users").doc(uid).collection("bookmarks").doc(b.id);
    batch.update(ref, b.isV2
      ? { "intelligence.importanceScore": Math.round(score * 1000) / 1000 }
      : { importance_score: Math.round(score * 1000) / 1000 });
    updated++;
    if (updated % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (updated % 400 !== 0) await batch.commit();
  await incrementMetric("importance.user.recomputed");
  return { updated };
}

export async function recomputeAllImportance(maxUsers = 200): Promise<{ users: number; bookmarks: number }> {
  const usersSnap = await scheduledUsers("importance", maxUsers);
  let users = 0;
  let bookmarks = 0;
  for (const u of usersSnap.docs) {
    const r = await recomputeImportance(u.id).catch((err) => {
      console.warn("[importance] user failed", u.id, err);
      return { updated: 0 };
    });
    users++;
    bookmarks += r.updated;
  }
  await incrementMetric("importance.run.completed");
  await usersSnap.complete();
  return { users, bookmarks };
}

