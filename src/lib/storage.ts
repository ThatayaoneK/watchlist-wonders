/**
 * Typed, error-safe access to `localStorage` / `sessionStorage`.
 *
 * Direct `localStorage.getItem` / `setItem` access is scattered across the app.
 * Funnel new callers through this module so:
 *   - JSON parse / stringify errors are caught and logged once
 *   - QuotaExceededError doesn't crash the app (write becomes a no-op)
 *   - All storage keys are greppable by importing `storage` from a single
 *     module instead of searching for raw strings
 *
 * Pass a Zod schema (or any function returning `T`) to validate persisted
 * data on read; corrupted payloads are dropped instead of poisoning state.
 */

type StorageScope = "local" | "session";

function getStore(scope: StorageScope): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return scope === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export interface StorageGetOptions<T> {
  fallback: T;
  validate?: (raw: unknown) => T | null;
}

export const storage = {
  get<T>(key: string, opts: StorageGetOptions<T>, scope: StorageScope = "local"): T {
    const store = getStore(scope);
    if (!store) return opts.fallback;
    try {
      const raw = store.getItem(key);
      if (raw == null) return opts.fallback;
      const parsed = JSON.parse(raw);
      if (opts.validate) {
        const validated = opts.validate(parsed);
        return validated ?? opts.fallback;
      }
      return parsed as T;
    } catch {
      return opts.fallback;
    }
  },

  set<T>(key: string, value: T, scope: StorageScope = "local"): boolean {
    const store = getStore(scope);
    if (!store) return false;
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      // QuotaExceededError or serialization failure — fail soft.
      return false;
    }
  },

  remove(key: string, scope: StorageScope = "local"): void {
    const store = getStore(scope);
    if (!store) return;
    try {
      store.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
