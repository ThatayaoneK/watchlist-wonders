import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getFriendlyFirebaseError } from '@/lib/firebaseErrorMessages';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Avoid permanent loading state if auth bootstrap errors or hangs.
    const authInitTimeout = window.setTimeout(() => {
      console.error('[Auth] Timed out waiting for Firebase auth initialization.');
      setAuthError('Authentication timed out. Please check your connection and reload.');
      setLoading(false);
    }, 8000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        window.clearTimeout(authInitTimeout);
        setUser(firebaseUser);
        setAuthError(null);
        setLoading(false);
      },
      (error) => {
        window.clearTimeout(authInitTimeout);
        console.error('[Auth] Firebase auth initialization failed:', error);
        setAuthError(
          getFriendlyFirebaseError(error, 'Authentication failed. Please reload and try again.'),
        );
        setUser(null);
        setLoading(false);
      },
    );

    return () => {
      window.clearTimeout(authInitTimeout);
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, signIn, signUp, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
