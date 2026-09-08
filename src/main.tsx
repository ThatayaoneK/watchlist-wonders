import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installChunkLoadRecovery } from "@/lib/chunkLoadRecovery";

installChunkLoadRecovery();
// Remove caches written by older service workers that stored private responses.
if ("caches" in window) {
  void Promise.all(["firestore-cache", "firebase-storage"].map(name => caches.delete(name))).catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(<App />);


