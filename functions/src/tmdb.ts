import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { redactError } from './lib/logSafety';

const tmdbApiKey = defineSecret('TMDB_API_KEY');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const LOGO_BASE = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';

type TmdbMediaType = 'movie' | 'tv';
type TmdbAction =
  | 'searchId'
  | 'watchProviders'
  | 'similarTitles'
  | 'details'
  | 'trailer';

interface TmdbProxyRequest {
  action?: string;
  title?: string;
  mediaType?: string;
  overview?: string;
  tmdbId?: number | string;
  preferredRegion?: string;
}

type FetchJsonResult = Record<string, unknown>;

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

function normalizeMediaType(value: string | undefined): TmdbMediaType {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'movie') return 'movie';
  if (normalized === 'tv' || normalized === 'series' || normalized === 'episode') return 'tv';
  throw new HttpsError('invalid-argument', 'mediaType must be movie or tv');
}

function normalizeTmdbId(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const truncated = Math.trunc(value);
    if (truncated >= 1) return truncated;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const truncated = Math.trunc(parsed);
      if (truncated >= 1) return truncated;
    }
  }
  throw new HttpsError('invalid-argument', 'tmdbId must be a positive number');
}

function buildRegionFallbackList(preferredRegion?: string): string[] {
  const candidates = [preferredRegion, 'BW', 'ZA', 'US'];
  const deduped = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.trim().toUpperCase();
    if (!normalized) continue;
    deduped.add(normalized);
  }

  return Array.from(deduped);
}

async function fetchTmdbJson(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<FetchJsonResult> {
  const search = new URLSearchParams({
    ...params,
    api_key: apiKey,
  });
  const url = `${TMDB_BASE}${path}?${search.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HttpsError(
        'unavailable',
        `TMDB request failed (${response.status}).`,
        text.slice(0, 300),
      );
    }

    const json = (await response.json()) as unknown;
    if (!json || typeof json !== 'object') {
      throw new HttpsError('data-loss', 'TMDB returned a malformed response.');
    }
    return json as FetchJsonResult;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('unavailable', 'TMDB request failed.');
  } finally {
    clearTimeout(timeout);
  }
}

async function handleSearchId(
  title: string,
  mediaType: TmdbMediaType,
  overview: string | undefined,
  apiKey: string,
) {
  const data = await fetchTmdbJson(`/search/${mediaType}`, { query: title }, apiKey);
  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length === 0) return { tmdbId: null };

  let best = results[0] as Record<string, unknown>;
  if (results.length > 1 && overview) {
    let bestScore = overlapScore(
      overview,
      typeof best.overview === 'string' ? best.overview : '',
    );
    for (let index = 1; index < results.length; index += 1) {
      const candidate = results[index] as Record<string, unknown>;
      const score = overlapScore(
        overview,
        typeof candidate.overview === 'string' ? candidate.overview : '',
      );
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  const id = best.id;
  if (typeof id !== 'number' || !Number.isFinite(id)) return { tmdbId: null };
  return { tmdbId: Math.trunc(id) };
}

async function handleWatchProviders(
  tmdbId: number,
  mediaType: TmdbMediaType,
  preferredRegion: string | undefined,
  apiKey: string,
) {
  const data = await fetchTmdbJson(
    `/${mediaType}/${tmdbId}/watch/providers`,
    {},
    apiKey,
  );

  const results = (data.results && typeof data.results === 'object'
    ? data.results
    : {}) as Record<string, unknown>;
  const regionCandidates = buildRegionFallbackList(preferredRegion);

  const hasOffers = (regionData: unknown): boolean => {
    if (!regionData || typeof regionData !== 'object') return false;
    const r = regionData as Record<string, unknown>;
    const flatrate = Array.isArray(r.flatrate) ? r.flatrate.length : 0;
    const rent = Array.isArray(r.rent) ? r.rent.length : 0;
    const buy = Array.isArray(r.buy) ? r.buy.length : 0;
    return flatrate + rent + buy > 0;
  };

  const resolvedRegion = regionCandidates.find((region) => hasOffers(results[region]));
  const firstAvailableRegion = Object.keys(results)[0];
  const chosenRegion = resolvedRegion ?? firstAvailableRegion;
  const chosenData = (chosenRegion ? results[chosenRegion] : {}) as Record<string, unknown>;
  const fallbackLink = firstAvailableRegion
    ? ((results[firstAvailableRegion] as Record<string, unknown>)?.link as string | undefined)
    : undefined;

  const mapProviders = (items: unknown) => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const provider = item as Record<string, unknown>;
        const providerId = provider.provider_id;
        const providerName = provider.provider_name;
        const logoPath = provider.logo_path;
        if (
          typeof providerId !== 'number' ||
          typeof providerName !== 'string' ||
          (typeof logoPath !== 'string' && logoPath !== null && logoPath !== undefined)
        ) {
          return null;
        }
        return {
          provider_id: providerId,
          provider_name: providerName,
          logo_path: logoPath ?? null,
          logoUrl: typeof logoPath === 'string' ? `${LOGO_BASE}${logoPath}` : null,
        };
      })
      .filter((provider): provider is NonNullable<typeof provider> => provider !== null);
  };

  return {
    flatrate: mapProviders(chosenData.flatrate),
    rent: mapProviders(chosenData.rent),
    buy: mapProviders(chosenData.buy),
    link:
      (typeof chosenData.link === 'string' ? chosenData.link : undefined) ??
      fallbackLink,
    resolvedRegion: chosenRegion,
  };
}

async function handleSimilarTitles(
  tmdbId: number,
  mediaType: TmdbMediaType,
  apiKey: string,
) {
  const data = await fetchTmdbJson(
    `/${mediaType}/${tmdbId}/recommendations`,
    { page: '1' },
    apiKey,
  );
  const results = Array.isArray(data.results) ? data.results : [];

  return {
    items: results.slice(0, 12).map((item) => {
      const record = (item && typeof item === 'object'
        ? item
        : {}) as Record<string, unknown>;
      const rawDate =
        (typeof record.release_date === 'string' ? record.release_date : '') ||
        (typeof record.first_air_date === 'string' ? record.first_air_date : '');
      const parsedYear = rawDate ? parseInt(rawDate.slice(0, 4), 10) : NaN;

      return {
        id: typeof record.id === 'number' ? record.id : null,
        title:
          (typeof record.title === 'string' && record.title) ||
          (typeof record.name === 'string' && record.name) ||
          'Untitled',
        poster_path: typeof record.poster_path === 'string' ? record.poster_path : null,
        posterUrl:
          typeof record.poster_path === 'string'
            ? `${POSTER_BASE}${record.poster_path}`
            : null,
        release_year: Number.isFinite(parsedYear) ? parsedYear : null,
        vote_average:
          typeof record.vote_average === 'number' ? record.vote_average : 0,
        media_type: mediaType,
      };
    }).filter((item) => typeof item.id === 'number'),
  };
}

async function handleDetails(tmdbId: number, mediaType: TmdbMediaType, apiKey: string) {
  const data = await fetchTmdbJson(
    `/${mediaType}/${tmdbId}`,
    { append_to_response: 'credits' },
    apiKey,
  );
  const credits =
    data.credits && typeof data.credits === 'object'
      ? (data.credits as Record<string, unknown>)
      : {};
  const cast = Array.isArray(credits.cast) ? credits.cast : [];
  const crew = Array.isArray(credits.crew) ? credits.crew : [];

  const directorEntry =
    mediaType === 'movie'
      ? crew.find((entry) => {
          if (!entry || typeof entry !== 'object') return false;
          const record = entry as Record<string, unknown>;
          return record.job === 'Director' && typeof record.name === 'string';
        })
      : undefined;

  return {
    genres: Array.isArray(data.genres) ? data.genres : [],
    cast: cast.slice(0, 4).map((entry) => {
      const record = (entry && typeof entry === 'object'
        ? entry
        : {}) as Record<string, unknown>;
      const profilePath =
        typeof record.profile_path === 'string' ? record.profile_path : null;
      return {
        name: typeof record.name === 'string' ? record.name : '',
        character: typeof record.character === 'string' ? record.character : '',
        profileUrl: profilePath ? `${PROFILE_BASE}${profilePath}` : null,
      };
    }),
    director:
      directorEntry && typeof directorEntry === 'object'
        ? (((directorEntry as Record<string, unknown>).name as string | undefined) ?? null)
        : null,
  };
}

function toYoutubeEmbedUrl(videoKey: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    loop: '1',
    playlist: videoKey,
  });
  return `https://www.youtube.com/embed/${videoKey}?${params.toString()}`;
}

async function handleTrailer(tmdbId: number, mediaType: TmdbMediaType, apiKey: string) {
  const data = await fetchTmdbJson(`/${mediaType}/${tmdbId}/videos`, {}, apiKey);
  const results = Array.isArray(data.results) ? data.results : [];

  const findMatch = (
    expectedType: 'Trailer' | 'Teaser' | 'Clip',
    requireOfficial: boolean,
  ) =>
    results.find((item) => {
      if (!item || typeof item !== 'object') return false;
      const record = item as Record<string, unknown>;
      if (record.site !== 'YouTube') return false;
      if (record.type !== expectedType) return false;
      if (requireOfficial && record.official !== true) return false;
      return typeof record.key === 'string' && record.key.length > 0;
    });

  const selected =
    findMatch('Trailer', true) ??
    findMatch('Trailer', false) ??
    findMatch('Teaser', false) ??
    findMatch('Clip', false);

  const videoKey =
    selected && typeof selected === 'object'
      ? ((selected as Record<string, unknown>).key as string | undefined)
      : undefined;

  return {
    embedUrl: videoKey ? toYoutubeEmbedUrl(videoKey) : null,
  };
}

function assertAction(value: string | undefined): TmdbAction {
  const action = (value ?? '').trim();
  switch (action) {
    case 'searchId':
    case 'watchProviders':
    case 'similarTitles':
    case 'details':
    case 'trailer':
      return action;
    default:
      throw new HttpsError('invalid-argument', 'Unsupported tmdbProxy action.');
  }
}

export const tmdbProxy = onCall(
  { memory: '256MiB', timeoutSeconds: 20, secrets: [tmdbApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const payload = (request.data ?? {}) as TmdbProxyRequest;
    const action = assertAction(payload.action);
    const apiKey = tmdbApiKey.value();

    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'TMDB API key is not configured.');
    }

    try {
      switch (action) {
        case 'searchId': {
          const title = typeof payload.title === 'string' ? payload.title.trim() : '';
          if (!title) throw new HttpsError('invalid-argument', 'title is required');
          const mediaType = normalizeMediaType(payload.mediaType);
          const overview =
            typeof payload.overview === 'string' && payload.overview.trim()
              ? payload.overview.trim()
              : undefined;
          return await handleSearchId(title, mediaType, overview, apiKey);
        }
        case 'watchProviders': {
          const tmdbId = normalizeTmdbId(payload.tmdbId);
          const mediaType = normalizeMediaType(payload.mediaType);
          const preferredRegion =
            typeof payload.preferredRegion === 'string'
              ? payload.preferredRegion
              : undefined;
          return await handleWatchProviders(
            tmdbId,
            mediaType,
            preferredRegion,
            apiKey,
          );
        }
        case 'similarTitles': {
          const tmdbId = normalizeTmdbId(payload.tmdbId);
          const mediaType = normalizeMediaType(payload.mediaType);
          return await handleSimilarTitles(tmdbId, mediaType, apiKey);
        }
        case 'details': {
          const tmdbId = normalizeTmdbId(payload.tmdbId);
          const mediaType = normalizeMediaType(payload.mediaType);
          return await handleDetails(tmdbId, mediaType, apiKey);
        }
        case 'trailer': {
          const tmdbId = normalizeTmdbId(payload.tmdbId);
          const mediaType = normalizeMediaType(payload.mediaType);
          return await handleTrailer(tmdbId, mediaType, apiKey);
        }
        default:
          throw new HttpsError('invalid-argument', 'Unsupported tmdbProxy action.');
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('[tmdbProxy] Unexpected error:', redactError(error));
      throw new HttpsError('internal', 'Unable to fetch TMDB data.');
    }
  },
);
