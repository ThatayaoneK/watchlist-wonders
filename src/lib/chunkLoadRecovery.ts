const CHUNK_RELOAD_GUARD_KEY = "__watchmarks_chunk_reload_once__";

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [^\s]+ failed/i,
];

function isChunkLoadError(message: string): boolean {
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function recoverFromChunkLoadError(message: string) {
  // Prevent infinite refresh loops if recovery doesn't solve the issue.
  if (sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === "1") {
    sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
    console.error("[ChunkRecovery] Reload already attempted; leaving page as-is.", message);
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, "1");
  console.warn("[ChunkRecovery] Detected dynamic chunk load failure. Reloading page once.", message);

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));
    }
  } catch (error) {
    console.warn("[ChunkRecovery] Failed to update service worker registrations.", error);
  }

  window.location.reload();
}

export function installChunkLoadRecovery() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    const message = event.message || (event.error && event.error.message) || "";
    if (isChunkLoadError(message)) {
      void recoverFromChunkLoadError(message);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = typeof reason === "string" ? reason : reason?.message || "";
    if (isChunkLoadError(message)) {
      event.preventDefault();
      void recoverFromChunkLoadError(message);
    }
  });
}

