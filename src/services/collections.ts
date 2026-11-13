import { addDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
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

export const collectionService = {
  async getCollections(): Promise<BookmarkCollection[]> {
    const uid = getUid();
    const snapshot = await getDocs(query(collectionsCol(uid), orderBy("created_at", "asc")));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as BookmarkCollection));
  },

  async createCollection(name: string): Promise<BookmarkCollection> {
    const uid = getUid();
    const normalizedName = name.trim().replace(/\\s+/g, " ");
    if (!normalizedName) throw new Error("Collection name is required");
    if (normalizedName.length > 40) throw new Error("Collection names must be 40 characters or fewer");

    const existing = await this.getCollections();
    const match = existing.find((item) => item.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase());
    if (match) return match;

    const now = new Date().toISOString();
    const data = { user_id: uid, name: normalizedName, created_at: now, updated_at: now };
    const ref = await addDoc(collectionsCol(uid), data);
    return { id: ref.id, ...data };
  },
};
