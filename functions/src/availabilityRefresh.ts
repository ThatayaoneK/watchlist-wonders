import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { redactSecretsInText } from './lib/logSafety';

const tmdbApiKey = defineSecret('TMDB_API_KEY');

let firestoreDb: Firestore | null = null;

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  if (!getApps().length) {
    initializeApp();
  }
  firestoreDb = getFirestore();
  return firestoreDb;
}

const TMDB_BASE = 'https://api.themoviedb.org/3';
const LOGO_BASE = 'https://image.tmdb.org/t/p/original';
const DEFAULT_REGION = 'US';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DOCS_PER_RUN = 120;
const FETCH_TIMEOUT_MS = 8000;

type MediaType = 'movie' | 'tv';
type AvailabilityProviderType = 'subscription' | 'rent' | 'buy';
type AvailabilityStatus = 'ok' | 'no_tmdb_match' | 'no_providers' | 'error';

interface BookmarkDocData {
  title?: unknown;
  type?: unknown;
  provider?: unknown;
  metadata?: unknown;
  availability?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  schemaVersion?: unknown;
  source?: unknown;
  media?: unknown;
  resolution?: unknown;
}

interface AvailabilityProvider {
  name: string;
  type: AvailabilityProviderType;
  url: string;
  region: string;
  providerId: number;
  logoUrl: string | null;
  score: number;
}

interface BookmarkAvailability {
  providers: AvailabilityProvider[];
  lastUpdated: string;
  region: string;
  tmdbId: number | null;
  status: AvailabilityStatus;
}

interface TmdbProviderEntry {
  provider_id?: unknown;
  provider_name?: unknown;
  logo_path?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function normalizeMediaType(value: unknown): MediaType | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (normalized === 'movie') return 'movie';
  if (normalized === 'series' || normalized === 'episode' || normalized === 'tv') return 'tv';
  return null;
}

function normalizeRegion(region: unknown): string {
  const parsed = asTrimmedString(region)?.toUpperCase();
  return parsed || DEFAULT_REGION;
}

function normalizeProviderToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function computeScore(type: AvailabilityProviderType, providerName: string, preferences: string[]): number {
  const isAvailableInRegion = 1;
  const subscriptionWeight = type === 'subscription' ? 3 : 1;
  const providerToken = normalizeProviderToken(providerName);
  const userUsesPlatform = preferences.some((item) =>
    providerToken.includes(normalizeProviderToken(item)),
  )
    ? 2
    : 0;
  return isAvailableInRegion * 5 + subscriptionWeight + userUsesPlatform;
}

function overlapScore(left: string, right: string): number {
  const significantTokens = (value: string) =>
    new Set(value.toLowerCase().split(/\W+/).filter((token) => token.length > 3));

  const leftSet = significantTokens(left);
  let overlap = 0;
  for (const token of significantTokens(right)) {
    if (leftSet.has(token)) overlap += 1;
  }
  return overlap;
}

function buildRegionFallbackList(preferredRegion: string): string[] {
  const candidates = [preferredRegion, 'BW', 'ZA', 'US'];
  const deduped = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeRegion(candidate);
    if (normalized) deduped.add(normalized);
  }
  return Array.from(deduped);
}

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTmdbJson(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const search = new URLSearchParams({
    ...params,
    api_key: apiKey,
  });
  const url = `${TMDB_BASE}${path}?${search.toString()}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`TMDB ${path} failed (${response.status}): ${text.slice(0, 160)}`);
  }
  const data = (await response.json()) as unknown;
  if (!data || typeof data !== 'object') throw new Error(`TMDB ${path} returned malformed JSON.`);
  return data as Record<string, unknown>;
}

function getStoredTmdbId(data: BookmarkDocData): number | null {
  if (data.schemaVersion === 2) return readNumber(asRecord(data.resolution).externalId);
  const metadata = asRecord(data.metadata);
  return readNumber(metadata.tmdb_id ?? metadata.tmdbId);
}

async function resolveTmdbId(
  title: string,
  mediaType: MediaType,
  overview: string | null,
  apiKey: string,
): Promise<number | null> {
  const data = await fetchTmdbJson(`/search/${mediaType}`, { query: title }, apiKey);
  const results = Array.isArray(data.results) ? data.results : [];
  if (!results.length) return null;

  let best = asRecord(results[0]);
  if (results.length > 1 && overview) {
    let bestScore = overlapScore(overview, asTrimmedString(best.overview) ?? '');
    for (let index = 1; index < results.length; index += 1) {
      const candidate = asRecord(results[index]);
      const score = overlapScore(overview, asTrimmedString(candidate.overview) ?? '');
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }

  return readNumber(best.id);
}

function mapProviders(
  entries: unknown,
  type: AvailabilityProviderType,
  region: string,
  title: string,
  preferences: string[],
  fallbackUrl?: string,
): AvailabilityProvider[] {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((raw) => {
      const entry = asRecord(raw) as TmdbProviderEntry;
      const providerId = readNumber(entry.provider_id);
      const providerName = asTrimmedString(entry.provider_name);
      if (!providerId || !providerName) return null;
      const logoPath = asTrimmedString(entry.logo_path);

      return {
        name: providerName,
        type,
        url: fallbackUrl || `https://www.google.com/search?q=${encodeURIComponent(`${providerName} ${title}`)}`,
        region,
        providerId,
        logoUrl: logoPath ? `${LOGO_BASE}${logoPath}` : null,
        score: computeScore(type, providerName, preferences),
      } as AvailabilityProvider;
    })
    .filter((provider): provider is AvailabilityProvider => provider !== null);
}

function shouldRefresh(data: BookmarkDocData, nowMs: number): boolean {
  const availability = asRecord(data.availability);
  const metadataAvailability = asRecord(asRecord(data.metadata).availability);
  const source = Object.keys(availability).length ? availability : metadataAvailability;
  if (!Object.keys(source).length) return true;

  const lastUpdated = asTrimmedString(source.lastUpdated);
  if (!lastUpdated) return true;
  const parsed = Date.parse(lastUpdated);
  if (!Number.isFinite(parsed)) return true;
  return nowMs - parsed >= CACHE_TTL_MS;
}

function collectPreferenceProviders(data: BookmarkDocData): string[] {
  const providers: string[] = [];
  const provider = asTrimmedString(data.schemaVersion === 2 ? asRecord(data.source).platform : data.provider);
  if (provider) providers.push(provider);

  const metadata = asRecord(data.metadata);
  if (Array.isArray(metadata.preferred_providers)) {
    for (const item of metadata.preferred_providers) {
      const value = asTrimmedString(item);
      if (value) providers.push(value);
    }
  }
  return providers;
}

async function buildAvailabilityForBookmark(
  data: BookmarkDocData,
  apiKey: string,
): Promise<{ availability: BookmarkAvailability; tmdbId: number | null }> {
  const media = asRecord(data.media);
  const title = asTrimmedString(data.schemaVersion === 2 ? media.title : data.title);
  const mediaType = normalizeMediaType(data.schemaVersion === 2 ? media.type : data.type);
  const metadata = asRecord(data.metadata);
  const overview = asTrimmedString(metadata.overview);
  const regionFromAvailability = asRecord(data.availability).region ?? asRecord(metadata.availability).region;
  const region = normalizeRegion(regionFromAvailability);
  const preferences = collectPreferenceProviders(data);

  if (!title || !mediaType) {
    return {
      tmdbId: null,
      availability: {
        providers: [],
        lastUpdated: new Date().toISOString(),
        region,
        tmdbId: null,
        status: 'error',
      },
    };
  }

  let tmdbId = getStoredTmdbId(data);
  if (!tmdbId) {
    tmdbId = await resolveTmdbId(title, mediaType, overview, apiKey);
  }

  if (!tmdbId) {
    return {
      tmdbId: null,
      availability: {
        providers: [],
        lastUpdated: new Date().toISOString(),
        region,
        tmdbId: null,
        status: 'no_tmdb_match',
      },
    };
  }

  const watchData = await fetchTmdbJson(`/${mediaType}/${tmdbId}/watch/providers`, {}, apiKey);
  const results = asRecord(watchData.results);
  const candidates = buildRegionFallbackList(region);
  const regionWithOffers = candidates.find((candidate) => {
    const regionData = asRecord(results[candidate]);
    const flatrate = Array.isArray(regionData.flatrate) ? regionData.flatrate.length : 0;
    const rent = Array.isArray(regionData.rent) ? regionData.rent.length : 0;
    const buy = Array.isArray(regionData.buy) ? regionData.buy.length : 0;
    return flatrate + rent + buy > 0;
  });

  const firstRegion = Object.keys(results)[0];
  const resolvedRegion = regionWithOffers || firstRegion || region;
  const regionData = asRecord(results[resolvedRegion]);
  const link = asTrimmedString(regionData.link)
    || asTrimmedString(asRecord(results[firstRegion]).link)
    || undefined;

  const providers = [
    ...mapProviders(regionData.flatrate, 'subscription', resolvedRegion, title, preferences, link),
    ...mapProviders(regionData.rent, 'rent', resolvedRegion, title, preferences, link),
    ...mapProviders(regionData.buy, 'buy', resolvedRegion, title, preferences, link),
  ].sort((left, right) => right.score - left.score);

  return {
    tmdbId,
    availability: {
      providers,
      lastUpdated: new Date().toISOString(),
      region: resolvedRegion,
      tmdbId,
      status: providers.length ? 'ok' : 'no_providers',
    },
  };
}

function dedupeDocs(
  docs: QueryDocumentSnapshot<BookmarkDocData>[],
): QueryDocumentSnapshot<BookmarkDocData>[] {
  const seen = new Set<string>();
  const unique: QueryDocumentSnapshot<BookmarkDocData>[] = [];
  for (const doc of docs) {
    if (seen.has(doc.ref.path)) continue;
    seen.add(doc.ref.path);
    unique.push(doc);
  }
  return unique;
}

export const refreshWatchAvailability = onSchedule(
  {
    schedule: 'every 6 hours',
    timeZone: 'Africa/Johannesburg',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: [tmdbApiKey],
  },
  async () => {
    const db = getDb();
    const apiKey = tmdbApiKey.value();
    if (!apiKey) {
      logger.error('[availabilityRefresh] TMDB_API_KEY is not configured.');
      return;
    }

    const nowMs = Date.now();
    const staleIso = new Date(nowMs - CACHE_TTL_MS).toISOString();

    const [staleSnapshot, missingTmdbIdSnapshot, updatedSnapshot, updatedV2Snapshot] = await Promise.all([
      db
        .collectionGroup('bookmarks')
        .where('availability.lastUpdated', '<=', staleIso)
        .orderBy('availability.lastUpdated', 'asc')
        .limit(MAX_DOCS_PER_RUN)
        .get(),
      db
        .collectionGroup('bookmarks')
        .where('metadata.tmdb_id', '>', 0)
        .orderBy('metadata.tmdb_id', 'asc')
        .limit(MAX_DOCS_PER_RUN)
        .get(),
      db
        .collectionGroup('bookmarks')
        .where('updated_at', '<=', staleIso)
        .orderBy('updated_at', 'asc')
        .limit(MAX_DOCS_PER_RUN)
        .get(),
      db
        .collectionGroup('bookmarks')
        .where('updatedAt', '<=', Timestamp.fromDate(new Date(staleIso)))
        .orderBy('updatedAt', 'asc')
        .limit(MAX_DOCS_PER_RUN)
        .get(),
    ]);

    const mergedDocs = dedupeDocs([
      ...staleSnapshot.docs,
      ...missingTmdbIdSnapshot.docs,
      ...updatedSnapshot.docs,
      ...updatedV2Snapshot.docs,
    ]);

    const candidates = mergedDocs.filter((doc) => shouldRefresh(doc.data(), nowMs)).slice(0, MAX_DOCS_PER_RUN);
    if (!candidates.length) {
      logger.info('[availabilityRefresh] No stale bookmarks found.');
      return;
    }

    let refreshed = 0;
    let failed = 0;
    let skipped = 0;

    for (const snapshot of candidates) {
      const data = snapshot.data();
      try {
        const media = asRecord(data.media);
        const title = asTrimmedString(data.schemaVersion === 2 ? media.title : data.title);
        const mediaType = normalizeMediaType(data.schemaVersion === 2 ? media.type : data.type);
        if (!title || !mediaType) {
          skipped += 1;
          continue;
        }

        const { availability, tmdbId } = await buildAvailabilityForBookmark(data, apiKey);
        const payload: Record<string, unknown> = data.schemaVersion === 2
          ? {
              availability: {
                providers: availability.providers.map((provider) => ({ ...provider, leavingDate: null })),
                lastUpdated: availability.lastUpdated,
                region: availability.region,
                externalId: tmdbId ? String(tmdbId) : null,
                status: availability.status === 'no_tmdb_match' ? 'no_match' : availability.status,
              },
              updatedAt: Timestamp.now(),
              ...(!getStoredTmdbId(data) && tmdbId ? {
                'resolution.externalId': String(tmdbId),
                'resolution.provider': 'tmdb',
              } : {}),
            }
          : {
              availability,
              'metadata.availability': availability,
              updated_at: new Date().toISOString(),
              ...(!getStoredTmdbId(data) && tmdbId ? { 'metadata.tmdb_id': tmdbId } : {}),
            };

        await snapshot.ref.update(payload);
        refreshed += 1;
      } catch (error) {
        failed += 1;
        logger.error('[availabilityRefresh] Failed to refresh bookmark', {
          path: snapshot.ref.path,
          error: redactSecretsInText(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    logger.info('[availabilityRefresh] Run complete', {
      scanned: mergedDocs.length,
      candidates: candidates.length,
      refreshed,
      failed,
      skipped,
    });
  },
);
