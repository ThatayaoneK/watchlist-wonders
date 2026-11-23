import { getMessaging, getToken, deleteToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getApps } from 'firebase/app';

// Re-use the already-initialized Firebase app
function getMessagingInstance() {
  const apps = getApps();
  if (apps.length === 0) {
    throw new Error('[FCM] Firebase app has not been initialized. Call initializeApp() first.');
  }
  return getMessaging(apps[0]);
}

export const fcmService = {
  /**
   * Request notification permission and retrieve the FCM registration token.
   * Stores the token in users/{uid}/profile so the backend can send pushes.
   * Returns the token, or null if permission was denied or FCM is unavailable.
   */
  async requestPermissionAndGetToken(): Promise<string | null> {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is not set');
      return null;
    }

    if (!('Notification' in window) || !navigator.serviceWorker) {
      console.warn('[FCM] Push notifications not supported in this environment');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;

      const token = await getToken(getMessagingInstance(), {
        vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
        ),
      });

      if (!token) return null;

      // Persist token for backend use
      const user = auth.currentUser;
      if (user) {
        await setDoc(
          doc(db, 'users', user.uid, 'profile', 'private'),
          { fcm_token: token, push_enabled: true },
          { merge: true },
        );
      }

      return token;
    } catch (err) {
      console.error('[FCM] Failed to get token:', err);
      return null;
    }
  },

  /**
   * Disable push notifications for the current user.
   * Clears the stored FCM token.
   */
  async disablePushNotifications(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteToken(getMessagingInstance());
    } catch (err) {
      console.error('[FCM] Failed to delete FCM token:', err);
    }
    await setDoc(
      doc(db, 'users', user.uid, 'profile', 'private'),
      { fcm_token: null, push_enabled: false },
      { merge: true },
    );
  },

  /**
   * Register a handler for foreground push messages.
   * Returns an unsubscribe function.
   */
  onForegroundMessage(cb: (payload: MessagePayload) => void): () => void {
    return onMessage(getMessagingInstance(), cb);
  },
};
