/**
 * Simple in-memory TTL cache for admin query responses.
 *
 * Admin dashboards refresh several callables in quick succession (often every
 * tab change). On a warm Cloud Function instance we can serve the second hit
 * from memory instead of re-running expensive `collectionGroup().count()`
 * queries against Firestore.
 *
 * Cold starts and instance scale-out still incur a full fetch — that's the
 * tradeoff. Set TTLs short enough that staleness is acceptable but long
 * enough to meaningfully cut read costs.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 100; // Bounded cache to prevent unbounded growth

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  insertedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Validates that a cache key is safe for global admin use.
 * Rejects keys that look like user-specific data (e.g., "user:", session IDs, request IDs).
 */
function validateAdminKey(key: string): void {
  if (
    key.includes('user:') ||
    key.includes('session:') ||
    key.includes('request:') ||
    key.match(/^[a-z0-9]{20,}$/) // Likely an ID or token
  ) {
    throw new Error(
      `Invalid admin cache key: "${key}". Cache keys must be global admin queries, not user/request-specific.`,
    );
  }
}

/**
 * Evicts the oldest entry (FIFO) when cache reaches max capacity.
 */
function evictOldestIfNeeded(): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, entry] of cache.entries()) {
      if (entry.insertedAt < oldestTime) {
        oldestTime = entry.insertedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
}

/**
 * Memoizes admin query results with TTL, in-flight deduplication, and bounded cache.
 * @param key Global admin query key (validated; must not be user/request-specific)
 * @param loader Async function returning admin-safe data
 * @param ttlMs Cache TTL in milliseconds
 */
export async function memoizeAdminQuery<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  validateAdminKey(key);

  const now = Date.now();

  // Check in-flight first to deduplicate concurrent requests
  const inFlightPromise = inFlight.get(key);
  if (inFlightPromise) {
    return inFlightPromise as Promise<T>;
  }

  // Check cache
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  // Invoke loader and track in-flight
  const promise = loader().then((value) => {
    inFlight.delete(key);
    evictOldestIfNeeded();
    cache.set(key, { value, expiresAt: now + ttlMs, insertedAt: now });
    return value;
  });

  inFlight.set(key, promise);
  return promise as Promise<T>;
}

/** Manual invalidation hook (handy for tests). */
export function clearAdminCache(): void {
  cache.clear();
}
