import { collection, query, orderBy, limit, startAfter, getDocs, getDoc, doc, type QueryDocumentSnapshot } from "firebase/firestore";
import { normalizeBookmark } from "@watchmarks/shared/bookmarkNormalizer";
import type { Bookmark } from "@watchmarks/shared/database";
import { auth, db } from "./firebase";
import { selectResolutionCandidate, skipResolutionSelection } from "./functions";

export type MobileBookmark = Bookmark;
export interface MobileBookmarkCursor {
  legacy?: QueryDocumentSnapshot;
  v2?: QueryDocumentSnapshot;
  legacyDone?: boolean;
  v2Done?: boolean;
}
function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.uid;
}
export async function getSavedBookmarksPage(count = 40, cursor?: MobileBookmarkCursor) {
  const owner = uid();
  const col = collection(db, "users", owner, "bookmarks");
  const read = (field: string, after?: QueryDocumentSnapshot, done?: boolean) => done
    ? Promise.resolve(null)
    : getDocs(query(col, orderBy(field, "desc"), limit(Math.max(1, Math.floor(count / 2))), ...(after ? [startAfter(after)] : [])));
  const [legacy, v2] = await Promise.all([read("created_at", cursor?.legacy, cursor?.legacyDone), read("createdAt", cursor?.v2, cursor?.v2Done)]);
  if (auth.currentUser?.uid !== owner) throw new Error("Account changed");
  const pageSize = Math.max(1, Math.floor(count / 2));
  const next = {
    legacy: legacy?.docs.at(-1) ?? cursor?.legacy, v2: v2?.docs.at(-1) ?? cursor?.v2,
    legacyDone: !legacy || legacy.size < pageSize, v2Done: !v2 || v2.size < pageSize,
  };
  return {
    bookmarks: [...new Map([...(legacy?.docs ?? []), ...(v2?.docs ?? [])].map(d => [d.id, normalizeBookmark(d.id, d.data())])).values()]
      .filter(b => !b.is_vaulted).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    nextCursor: next.legacyDone && next.v2Done ? undefined : next,
  };
}
export async function getSavedBookmarks(count = 40): Promise<MobileBookmark[]> {
  return (await getSavedBookmarksPage(count)).bookmarks;
}
export async function getBookmark(id: string): Promise<MobileBookmark | null> {
  const owner = uid();
  const snap = await getDoc(doc(db, "users", owner, "bookmarks", id));
  if (auth.currentUser?.uid !== owner) throw new Error("Account changed");
  return snap.exists() ? normalizeBookmark(snap.id, snap.data()) : null;
}
export async function selectCandidate(bookmarkId: string, candidate: unknown): Promise<void> {
  await selectResolutionCandidate(bookmarkId, candidate);
}
export async function skipSelection(bookmarkId: string): Promise<void> {
  await skipResolutionSelection(bookmarkId);
}
