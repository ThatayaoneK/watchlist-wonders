import { collection, doc, getDocs, orderBy, query, runTransaction } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { BookmarkCollection } from "@/types/database";

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.uid;
}

function collectionsCol(uid: string) {
  return collection(db, "users", uid, "bookmarkCollections");
}

function collectionId(name: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < name.length; index++) {
    const code = name.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x85ebca6b);
  }
  return `name_${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

export const collectionService = {
  async getCollections(): Promise<BookmarkCollection[]> {
    const uid = getUid();
    const snapshot = await getDocs(query(collectionsCol(uid), orderBy("created_at", "asc")));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as BookmarkCollection));
  },

  async createCollection(name: string): Promise<BookmarkCollection> {
    const uid = getUid();
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (!normalizedName) throw new Error("Collection name is required");
    if (normalizedName.length > 40) throw new Error("Collection names must be 40 characters or fewer");

    const key = normalizedName.toLocaleLowerCase();
    const ref = doc(db, "users", uid, "bookmarkCollections", collectionId(key));
    const now = new Date().toISOString();

    return runTransaction(db, async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists()) return { id: existing.id, ...existing.data() } as BookmarkCollection;

      const data = { user_id: uid, name: normalizedName, created_at: now, updated_at: now };
      transaction.set(ref, data);
      return { id: ref.id, ...data };
    });
  },
};
