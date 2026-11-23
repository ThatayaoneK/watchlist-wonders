import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  writeBatch,
  documentId,
  deleteField,
  type DocumentData,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { WatchPlan, Bookmark } from '@/types/database';
import { normalizeBookmark } from '@/services/bookmarkNormalizer';

type WatchPlanBookmarkRow = {
  plan_id: string;
  bookmark_id: string;
  user_id: string;
  position: number;
  bookmarks: Bookmark | null;
};

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function plansCol(uid: string) {
  return collection(db, 'users', uid, 'watchPlans');
}

function planBookmarksCol(uid: string, planId: string) {
  return collection(db, 'users', uid, 'watchPlans', planId, 'bookmarks');
}

function docToWatchPlan(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): WatchPlan {
  return { id: snap.id, ...snap.data() } as WatchPlan;
}

export const watchPlanService = {
  /**
   * Get all watch plans for the current user
   */
  async getWatchPlans(): Promise<WatchPlan[]> {
    const uid = getUid();
    const q = query(plansCol(uid), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(docToWatchPlan);
  },

  /**
   * Get a single watch plan by ID
   */
  async getWatchPlan(id: string): Promise<WatchPlan> {
    const uid = getUid();
    const snap = await getDoc(doc(db, 'users', uid, 'watchPlans', id));
    if (!snap.exists()) throw new Error('Watch plan not found');
    return docToWatchPlan(snap);
  },

  /**
   * Create a new watch plan
   */
  async createWatchPlan(
    plan: Omit<WatchPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  ): Promise<WatchPlan> {
    const uid = getUid();
    const now = new Date().toISOString();
    const data = {
      ...plan,
      user_id: uid,
      preferred_days: plan.preferred_days || [],
      mood_tags: plan.mood_tags || [],
      platforms_allowed: plan.platforms_allowed || [],
      created_at: now,
      updated_at: now,
    };
    const ref = await addDoc(plansCol(uid), data);
    return { id: ref.id, ...data } as WatchPlan;
  },

  /**
   * Update a watch plan
   */
  async updateWatchPlan(id: string, updates: Partial<WatchPlan>): Promise<WatchPlan> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'watchPlans', id);
    await updateDoc(ref, { ...updates, updated_at: new Date().toISOString() });
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`WatchPlan ${id} not found after update`);
    return docToWatchPlan(snap);
  },

  /**
   * Delete a watch plan
   */
  async deleteWatchPlan(id: string): Promise<void> {
    const uid = getUid();
    // Delete all bookmarks subcollection docs first
    const bookmarksSnap = await getDocs(planBookmarksCol(uid, id));
    const CHUNK = 500;
    for (let i = 0; i < bookmarksSnap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      bookmarksSnap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'users', uid, 'watchPlans', id));
  },

  /**
   * Get bookmarks in a watch plan
   */
  async getPlanBookmarks(planId: string): Promise<WatchPlanBookmarkRow[]> {
    const uid = getUid();
    const q = query(planBookmarksCol(uid, planId), orderBy('position', 'asc'));
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const planDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    const bookmarkIds = planDocs.map((d) => d.data.bookmark_id as string);

    // Fetch all bookmarks in chunks of 30 (Firestore 'in' limit)
    const CHUNK = 30;
    const bookmarkMap = new Map<string, Bookmark>();
    for (let i = 0; i < bookmarkIds.length; i += CHUNK) {
      const chunk = bookmarkIds.slice(i, i + CHUNK);
      const bq = query(
        collection(db, 'users', uid, 'bookmarks'),
        where(documentId(), 'in', chunk),
      );
      const bSnap = await getDocs(bq);
      bSnap.docs.forEach((d) => {
        bookmarkMap.set(d.id, normalizeBookmark(d.id, d.data()));
      });
    }

    return planDocs.map((pd) => ({
      plan_id: planId,
      bookmark_id: pd.data.bookmark_id as string,
      user_id: uid,
      position: pd.data.position as number,
      bookmarks: bookmarkMap.get(pd.data.bookmark_id as string) ?? null,
    } as WatchPlanBookmarkRow));
  },

  /**
   * Add a bookmark to a watch plan
   */
  async addBookmarkToPlan(planId: string, bookmarkId: string, position?: number): Promise<void> {
    const uid = getUid();
    await addDoc(planBookmarksCol(uid, planId), {
      bookmark_id: bookmarkId,
      user_id: uid,
      position: position ?? 0,
    });
  },

  /**
   * Remove a bookmark from a watch plan
   */
  async removeBookmarkFromPlan(planId: string, bookmarkId: string): Promise<void> {
    const uid = getUid();
    const q = query(planBookmarksCol(uid, planId), where('bookmark_id', '==', bookmarkId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },

  /**
   * Reorder bookmarks in a watch plan
   */
  async reorderPlanBookmarks(planId: string, bookmarkIds: string[]): Promise<void> {
    const uid = getUid();
    const existingSnap = await getDocs(planBookmarksCol(uid, planId));
    const totalOps = existingSnap.docs.length + bookmarkIds.length;
    const CHUNK = 500;

    if (totalOps <= CHUNK) {
      // Single atomic batch
      const batch = writeBatch(db);
      existingSnap.docs.forEach((d) => batch.delete(d.ref));
      bookmarkIds.forEach((bookmarkId, index) => {
        batch.set(doc(planBookmarksCol(uid, planId)), {
          bookmark_id: bookmarkId,
          user_id: uid,
          position: index,
        });
      });
      await batch.commit();
    } else {
      // Chunked insert-before-delete to prevent data loss if inserts fail.
      // Phase 1: Insert new docs with a pending marker.
      const newRefs: ReturnType<typeof doc>[] = [];
      try {
        for (let i = 0; i < bookmarkIds.length; i += CHUNK) {
          const batch = writeBatch(db);
          bookmarkIds.slice(i, i + CHUNK).forEach((bookmarkId, idx) => {
            const ref = doc(planBookmarksCol(uid, planId));
            newRefs.push(ref);
            batch.set(ref, {
              bookmark_id: bookmarkId,
              user_id: uid,
              position: i + idx,
              pending: true,
            });
          });
          await batch.commit();
        }

        // Phase 2: Delete old docs now that new ones are safely written.
        for (let i = 0; i < existingSnap.docs.length; i += CHUNK) {
          const batch = writeBatch(db);
          existingSnap.docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }

        // Phase 3: Remove the pending marker from new docs.
        for (let i = 0; i < newRefs.length; i += CHUNK) {
          const batch = writeBatch(db);
          newRefs.slice(i, i + CHUNK).forEach((ref) => {
            batch.update(ref, { pending: deleteField() });
          });
          await batch.commit();
        }
      } catch (err) {
        // Rollback: delete any pending docs that were already inserted.
        console.error('reorderPlanBookmarks failed, attempting rollback:', err);
        try {
          for (let i = 0; i < newRefs.length; i += CHUNK) {
            const batch = writeBatch(db);
            newRefs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
            await batch.commit();
          }
        } catch (rollbackErr) {
          const pendingIds = newRefs.map((r) => r.id);
          console.error(
            'Rollback of pending inserts also failed. Orphaned pending doc IDs:',
            pendingIds,
            rollbackErr,
          );
        }
        throw err;
      }
    }
  },
};
