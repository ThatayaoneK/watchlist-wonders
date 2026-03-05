import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export const authService = {
  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return credential.user;
  },

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    return credential.user;
  },

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    await signOut(auth);
  },

  /**
   * Get the current user
   */
  async getUser(): Promise<User | null> {
    await auth.authStateReady();
    return auth.currentUser;
  },

  /**
   * Reset password via email
   */
  async resetPassword(email: string) {
    const origin =
      import.meta.env.VITE_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    if (!origin) {
      throw new Error('App URL is not configured. Cannot send password reset email.');
    }
    await sendPasswordResetEmail(auth, email, {
      url: `${origin}/auth`,
    });
  },

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    await updatePassword(user, newPassword);
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },
};
