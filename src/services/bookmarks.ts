import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Bookmark } from '@/types/database';

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function bookmarksCol(uid: string) {
  return collection(db, 'users', uid, 'bookmarks');
}

function docToBookmark(snap: any): Bookmark {
  return { id: snap.id, ...snap.data() } as Bookmark;
}

export const bookmarkService = {
  /**
   * Get all bookmarks for the current user
   */
  async getBookmarks(): Promise<Bookmark[]> {
    const uid = getUid();
    const q = query(bookmarksCol(uid), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(docToBookmark);
  },

  /**
   * Get bookmarks by status
   */
  async getBookmarksByStatus(status: Bookmark['status']): Promise<Bookmark[]> {
    const uid = getUid();
    const q = query(
      bookmarksCol(uid),
      where('status', '==', status),
      orderBy('created_at', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(docToBookmark);
  },

  /**
   * Get a single bookmark by ID
   */
  async getBookmark(id: string): Promise<Bookmark> {
    const uid = getUid();
    const snap = await getDoc(doc(db, 'users', uid, 'bookmarks', id));
    if (!snap.exists()) throw new Error('Bookmark not found');
    return docToBookmark(snap);
  },

  /**
   * Create a new bookmark
   */
  async createBookmark(bookmark: Partial<Bookmark> & { title: string }): Promise<Bookmark> {
    const uid = getUid();
    const now = new Date().toISOString();
    const data = {
      title: bookmark.title,
      type: bookmark.type || 'movie',
      provider: bookmark.provider || 'generic',
      source_url: bookmark.source_url ?? null,
      canonical_url: bookmark.canonical_url ?? null,
      platform_label: bookmark.platform_label ?? null,
      status: bookmark.status || 'backlog',
      runtime_minutes: bookmark.runtime_minutes ?? null,
      release_year: bookmark.release_year ?? null,
      poster_url: bookmark.poster_url ?? null,
      backdrop_url: bookmark.backdrop_url ?? null,
      tags: bookmark.tags || [],
      mood_tags: bookmark.mood_tags || [],
      notes: bookmark.notes ?? null,
      metadata: bookmark.metadata || {},
      user_id: uid,
      last_shown_at: null,
      shown_count: 0,
      created_at: now,
      updated_at: now,
    };
    const ref = await addDoc(bookmarksCol(uid), data);
    return { id: ref.id, ...data } as Bookmark;
  },

  /**
   * Update an existing bookmark
   */
  async updateBookmark(id: string, updates: Partial<Bookmark>): Promise<Bookmark> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'bookmarks', id);
    await updateDoc(ref, { ...updates, updated_at: new Date().toISOString() });
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Bookmark not found after update');
    return docToBookmark(snap);
  },

  /**
   * Delete a bookmark
   */
  async deleteBookmark(id: string): Promise<void> {
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'bookmarks', id));
  },

  /**
   * Update bookmark status, setting watched_at when first marked done
   */
  async updateStatus(id: string, status: Bookmark['status']): Promise<Bookmark> {
    const updates: Partial<Bookmark> = { status };
    if (status === 'done') {
      const current = await this.getBookmark(id);
      if (!current.watched_at) {
        updates.watched_at = new Date().toISOString();
      }
    }
    return this.updateBookmark(id, updates);
  },

  /**
   * Rate a bookmark (1–5 stars) with optional personal review
   */
  async rateBookmark(id: string, rating: number | null, review?: string | null): Promise<Bookmark> {
    // Validate rating: must be null or an integer between 1 and 5
    if (rating !== null) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Rating must be null or an integer between 1 and 5');
      }
    }
    return this.updateBookmark(id, {
      user_rating: rating,
      ...(review !== undefined ? { user_review: review } : {}),
    });
  },

  /**
   * Search bookmarks by title or notes (client-side filtering)
   */
  async searchBookmarks(queryStr: string): Promise<Bookmark[]> {
    const bookmarks = await this.getBookmarks();
    const lower = queryStr.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(lower) ||
        (b.notes && b.notes.toLowerCase().includes(lower)),
    );
  },

  /**
   * Get backlog items for Tonight Pick (runtime <= 90 minutes)
   */
  async getTonightCandidates(): Promise<Bookmark[]> {
    const uid = getUid();
    const q = query(
      bookmarksCol(uid),
      where('status', '==', 'backlog'),
    );
    const snap = await getDocs(q);
    const bookmarks = snap.docs.map(docToBookmark);
    return bookmarks
      .filter((b) => b.runtime_minutes === null || b.runtime_minutes <= 90)
      .sort((a, b) => (a.shown_count || 0) - (b.shown_count || 0))
      .slice(0, 20);
  },

  /**
   * Update shown tracking for Tonight Pick
   */
  async markAsShown(id: string): Promise<void> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'bookmarks', id);
    await updateDoc(ref, {
      last_shown_at: new Date().toISOString(),
      shown_count: increment(1),
    });
  },

  /**
   * Get bookmarks grouped by mood tags
   */
  async getBookmarksByMood(): Promise<Record<string, Bookmark[]>> {
    const bookmarks = await this.getBookmarks();
    const byMood: Record<string, Bookmark[]> = {};
    bookmarks.forEach((bookmark) => {
      (bookmark.mood_tags || []).forEach((mood) => {
        if (!byMood[mood]) byMood[mood] = [];
        byMood[mood].push(bookmark);
      });
    });
    return byMood;
  },

  /**
   * Get statistics about user's bookmarks
   */
  async getStats() {
    const bookmarks = await this.getBookmarks();
    return {
      total: bookmarks.length,
      backlog: bookmarks.filter((b) => b.status === 'backlog').length,
      watching: bookmarks.filter((b) => b.status === 'watching').length,
      done: bookmarks.filter((b) => b.status === 'done').length,
      dropped: bookmarks.filter((b) => b.status === 'dropped').length,
      totalWatchedMinutes: bookmarks
        .filter((b) => b.status === 'done' && b.runtime_minutes)
        .reduce((sum, b) => sum + (b.runtime_minutes || 0), 0),
    };
  },
};
