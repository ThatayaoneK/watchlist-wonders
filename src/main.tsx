import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installChunkLoadRecovery } from "@/lib/chunkLoadRecovery";

installChunkLoadRecovery();

createRoot(document.getElementById("root")!).render(<App />);

