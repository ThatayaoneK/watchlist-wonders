import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { AuthGate } from "../components/AuthGate";

export default function RootLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {user === undefined ? null : user ? (
          <Stack key={user.uid}
            screenOptions={{
              headerStyle: { backgroundColor: "#09090b" },
              headerTintColor: "#fafafa",
              contentStyle: { backgroundColor: "#09090b" },
            }}
          >
            <Stack key={user.uid}.Screen name="index" options={{ title: "Watchmarks" }} />
            <Stack key={user.uid}.Screen name="bookmark/[id]" options={{ title: "Bookmark" }} />
            <Stack key={user.uid}.Screen
              name="capture/[status]"
              options={{ title: "Choose title", presentation: "modal" }}
            />
          </Stack>
        ) : (
          <AuthGate />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

