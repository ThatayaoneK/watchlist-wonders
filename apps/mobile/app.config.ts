import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Watchmarks",
  slug: "watchmarks",
  version: "1.0.0",
  scheme: "watchmarks",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#09090b",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.watchmarks.app",
    infoPlist: {
      NSPhotoLibraryUsageDescription: "Used for profile pictures",
    },
  },
  android: {
    adaptiveIcon: { backgroundColor: "#09090b" },
    package: "com.watchmarks.app",
    intentFilters: [
      {
        action: "android.intent.action.SEND",
        data: [{ mimeType: "text/plain" }],
        category: ["android.intent.category.DEFAULT"],
      },
    ],
  },
  plugins: ["expo-router"],
  experiments: { typedRoutes: true },
  extra: {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
  },
};

export default config;
