import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import Constants from "expo-constants";

const cfg = Constants.expoConfig?.extra as Record<string, string> | undefined;

const requiredKeys = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
] as const;

const missingKeys = requiredKeys.filter((key) => !cfg?.[key]);
if (missingKeys.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingKeys.join(", ")}. Please check your .env and Constants.expoConfig.extra.`,
  );
}

const firebaseConfig = {
  apiKey: cfg!.FIREBASE_API_KEY,
  authDomain: cfg!.FIREBASE_AUTH_DOMAIN,
  projectId: cfg!.FIREBASE_PROJECT_ID,
  storageBucket: cfg!.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: cfg!.FIREBASE_MESSAGING_SENDER_ID,
  appId: cfg!.FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
