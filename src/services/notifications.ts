import {
  collection,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  documentId,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Notification, Bookmark } from '@/types/database';

type NotificationWithBookmark = Notification & { bookmarks?: Bookmark };

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function notificationsCol(uid: string) {
  return collection(db, 'users', uid, 'notifications');
}

async function batchAttachBookmarks(uid: string, notifications: Notification[]): Promise<NotificationWithBookmark[]> {
  const ids = [...new Set(notifications.map((n) => n.bookmark_id).filter(Boolean))] as string[];
  if (ids.length === 0) return notifications;
  const CHUNK = 30;
  const bookmarkMap = new Map<string, Bookmark>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const bq = query(collection(db, 'users', uid, 'bookmarks'), where(documentId(), 'in', chunk));
      const bSnap = await getDocs(bq);
      bSnap.docs.forEach((d) => {
        bookmarkMap.set(d.id, { id: d.id, ...d.data() } as Bookmark);
      });
    } catch (error) {
      console.error(
        `Failed to fetch bookmark chunk [${chunk.join(', ')}]:`,
        error instanceof Error ? error.message : error
      );
      // Continue processing remaining chunks; missing bookmarks will be absent from bookmarkMap
    }
  }
  return notifications.map((n) =>
    n.bookmark_id && bookmarkMap.has(n.bookmark_id)
      ? { ...n, bookmarks: bookmarkMap.get(n.bookmark_id) }
      : n,
  );
}

function docToNotification(snap: any): Notification {
  return { id: snap.id, ...snap.data() } as Notification;
}

export const notificationService = {
  /**
   * Get all notifications for the current user
   */
  async getNotifications(lim = 50): Promise<NotificationWithBookmark[]> {
    const uid = getUid();
    const q = query(notificationsCol(uid), orderBy('created_at', 'desc'), limit(lim));
    const snap = await getDocs(q);
    return batchAttachBookmarks(uid, snap.docs.map(docToNotification));
  },

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(): Promise<NotificationWithBookmark[]> {
    const uid = getUid();
    const q = query(
      notificationsCol(uid),
      where('read_at', '==', null),
      orderBy('created_at', 'desc'),
    );
    const snap = await getDocs(q);
    return batchAttachBookmarks(uid, snap.docs.map(docToNotification));
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    const uid = getUid();
    const q = query(notificationsCol(uid), where('read_at', '==', null));
    const snap = await getDocs(q);
    return snap.size;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'notifications', id);
    await updateDoc(ref, { read_at: new Date().toISOString() });
    const snap = await getDoc(ref);
    return docToNotification(snap);
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    const uid = getUid();
    const q = query(notificationsCol(uid), where('read_at', '==', null));
    const snap = await getDocs(q);
    const now = new Date().toISOString();
    const CHUNK_SIZE = 500;
    for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
      const chunk = snap.docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.update(d.ref, { read_at: now }));
      await batch.commit();
    }
  },

  /**
   * Delete a notification
   */
  async deleteNotification(id: string): Promise<void> {
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'notifications', id));
  },

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(callback: (notification: Notification) => void) {
    const uid = getUid();
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('created_at', 'desc'),
      limit(1),
    );

    let initialLoad = true;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (initialLoad) {
        initialLoad = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notif = { id: change.doc.id, ...change.doc.data() } as Notification;
          callback(notif);
        }
      });
    });

    return unsubscribe;
  },
};
