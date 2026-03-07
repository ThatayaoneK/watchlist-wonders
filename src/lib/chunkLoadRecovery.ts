const CHUNK_RELOAD_GUARD_KEY = "__watchmarks_chunk_reload_once__";
const CACHE_BUSTER_QUERY_KEY = "__wm_reload";

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk [^\s]+ failed/i,
];

export function isChunkLoadError(message: string): boolean {
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function withReloadBuster(url: URL): URL {
  const next = new URL(url.toString());
  next.searchParams.set(CACHE_BUSTER_QUERY_KEY, Date.now().toString());
  return next;
}

function cleanupReloadBuster() {
  const current = new URL(window.location.href);
  if (!current.searchParams.has(CACHE_BUSTER_QUERY_KEY)) return;
  current.searchParams.delete(CACHE_BUSTER_QUERY_KEY);
  window.history.replaceState({}, "", current.toString());
}

async function clearRuntimeCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (registration) => {
          await registration.update();
          await registration.unregister();
        }),
      );
    }
  } catch (error) {
    console.warn("[ChunkRecovery] Failed to reset service workers.", error);
  }

  try {
    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("[ChunkRecovery] Failed to clear Cache Storage.", error);
  }
}

export async function hardReloadApp(reason?: string) {
  if (reason) {
    console.warn("[ChunkRecovery] Hard reload requested:", reason);
  }
  await clearRuntimeCaches();
  window.location.replace(withReloadBuster(new URL(window.location.href)).toString());
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
  await hardReloadApp(message);
}

export function installChunkLoadRecovery() {
  if (typeof window === "undefined") return;
  cleanupReloadBuster();

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
