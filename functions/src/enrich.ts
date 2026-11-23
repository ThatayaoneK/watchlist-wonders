import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import {
  confidenceFromScores,
  requiresUserSelection,
  resolutionStatusFromConfidence,
  type ConfidenceBand,
  type ResolutionStatus,
} from './resolution/scoring';
import { redactUrlForLog as sharedRedactUrlForLog, redactError } from './lib/logSafety';
import { fetchUrl } from './enrichment/fetchUrl';

export const youtubeApiKey = defineSecret('YOUTUBE_API_KEY');
export const tmdbApiKey = defineSecret('TMDB_API_KEY');

export interface EnrichResponse {
  title?: string;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  runtimeMinutes?: number;
  releaseYear?: number;
  contentType?: 'movie' | 'series' | 'episode' | 'video';
  mediaType?: 'movie' | 'tv' | 'unknown';
  provider?: string;
  tmdbId?: number;
  canonicalUrl?: string;
  hashtags?: string[];
  genres?: string[];
  voteAverage?: number;
  matchConfidence?: ConfidenceBand;
  matchCandidates?: TmdbMatchCandidate[];
  resolutionStatus?: ResolutionStatus;
  confidenceScore?: number;
  confidenceBand?: ConfidenceBand;
  requiresUserSelection?: boolean;
  primaryCandidate?: TmdbMatchCandidate;
  alternatives?: TmdbMatchCandidate[];
  matchedBy?: 'tmdb' | 'metadata';
  error?: { message: string };
}

export interface TmdbMatchCandidate {
  tmdbId: number;
  title: string;
  mediaType: 'movie' | 'tv';
  contentType?: 'movie' | 'series' | 'episode';
  releaseYear?: number;
  posterUrl?: string;
  backdropUrl?: string;
  description?: string;
  voteAverage?: number;
  runtimeMinutes?: number;
  genres?: string[];
  score?: number;
  scoreBreakdown?: TmdbScoreBreakdown;
}

interface TmdbScoreBreakdown {
  title: number;
  year: number;
  type: number;
  overview: number;
  total: number;
}

interface OEmbedResponse {
  title?: string;
  html?: string;
  thumbnail_url?: string;
  author_name?: string;
  provider_name?: string;
}

interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  canonicalUrl?: string;
  siteName?: string;
}

// --- URL helpers ---

const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DISALLOWED_HOSTS = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  '169.254.169.254',
]);

/** Re-exported from ./lib/logSafety for backwards-compat with existing call sites. */
const redactUrlForLog = sharedRedactUrlForLog;

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function extractIpv4FromMappedIpv6(hostname: string): string | null {
  const mapped = hostname.match(/^::ffff:(.+)$/);
  if (!mapped) return null;

  const embedded = mapped[1];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(embedded)) {
    const parts = embedded.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    return parts.join('.');
  }

  const hexMatch = embedded.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hexMatch) return null;

  const high = Number.parseInt(hexMatch[1], 16);
  const low = Number.parseInt(hexMatch[2], 16);
  const octets = [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff];
  return octets.join('.');
}

function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const mappedIpv4 = extractIpv4FromMappedIpv6(h);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

  return (
    h === '::1' ||
    h === '::' ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80:')
  );
}

function isIpLiteral(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':');
}

function isDisallowedHostname(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (DISALLOWED_HOSTS.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.local')) return true;

  if (!isIpLiteral(h)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return isPrivateIpv4(h);
  return isPrivateIpv6(h);
}

function normalizeAndValidateUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new HttpsError('invalid-argument', 'A valid absolute URL is required.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpsError('invalid-argument', 'Only http:// and https:// URLs are supported.');
  }

  if (parsed.username || parsed.password) {
    throw new HttpsError('invalid-argument', 'URLs with embedded credentials are not allowed.');
  }

  if (!parsed.hostname || isDisallowedHostname(parsed.hostname)) {
    throw new HttpsError('invalid-argument', 'Private or local network URLs are not allowed.');
  }

  return parsed;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  if (init.method && init.method !== 'GET') {
    throw new HttpsError('invalid-argument', 'Only GET requests are supported for enrichment fetches.');
  }
  const fetched = await fetchUrl(url, { totalTimeoutMs: timeoutMs });
  const headers = new Headers();
  for (const [name, value] of Object.entries(fetched.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (typeof value === 'string') headers.set(name, value);
  }
  return new Response(fetched.body, {
    status: fetched.status,
    headers,
  });
}

// --- Platform Detection ---

function detectProvider(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
    if (h.includes('netflix.com')) return 'netflix';
    if (h.includes('imdb.com')) return 'imdb';
    if (h.includes('letterboxd.com')) return 'letterboxd';
    if (h.includes('instagram.com')) return 'instagram';
    if (h.includes('facebook.com') || h.includes('fb.watch')) return 'facebook';
    if (h.includes('twitter.com') || h.includes('x.com')) return 'x';
    if (h.includes('tiktok.com')) return 'tiktok';
    if (h.includes('reddit.com')) return 'reddit';
    if (h.includes('rottentomatoes.com')) return 'rottentomatoes';
    return 'generic';
  } catch {
    return 'generic';
  }
}

// --- Title Cleaning ---

function cleanTitleForTMDB(raw: string): string {
  return raw
    .replace(/\(?\d{4}\)?/g, '') // remove years
    .replace(/official\s*(trailer|teaser|clip|video)/gi, '')
    .replace(/\|\s*.+$/i, '') // strip "| Netflix" suffixes
    .replace(/[-\u2013]\s*(trailer|teaser|season\s*\d+).*/gi, '')
    .replace(/[^\w\s']/g, ' ') // strip emoji/symbols
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x2F;|&#47;/gi, '/');
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickFirstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = normalizeText(value);
      if (normalized) return normalized;
    }
  }
  return undefined;
}

function resolveAbsoluteUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function stripSocialPrefix(value: string): string {
  return value
    .replace(/^.+?\s+on\s+(instagram|facebook|tiktok|x|twitter)\s*:\s*/i, '')
    .replace(/\s*\|\s*(instagram|facebook|tiktok|x|twitter).*/i, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

function cleanSocialText(raw: string): string {
  return normalizeText(stripSocialPrefix(raw))
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.[^\s]+/gi, ' ')
    .replace(/(?:^|\s)[#@][A-Za-z0-9_]+/g, ' ')
    .replace(/\b(link in bio|original sound)\b/gi, ' ')
    .replace(/\b(fyp|foryou|viral|trending|reels|shorts)\b/gi, ' ')
    .replace(/\b(follow|subscribe|like|share|comment)\s+(for\s+)?(more|updates?)\b.*$/i, ' ')
    .replace(/\s*[|\u2022\u00b7]+\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHashtags(...values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const decoded = decodeHtmlEntities(value);
    const matches = decoded.matchAll(/(?:^|\s)#([A-Za-z0-9_]{2,40})/g);
    for (const match of matches) {
      const tag = normalizeText(match[1] ?? '').toLowerCase();
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      if (seen.size >= 16) break;
    }
    if (seen.size >= 16) break;
  }
  return Array.from(seen);
}

function extractUrlsFromText(...values: Array<string | undefined | null>): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const pattern = /https?:\/\/[^\s"'<>]+/gi;

  for (const value of values) {
    if (!value) continue;
    const matches = value.match(pattern);
    if (!matches) continue;
    for (const match of matches) {
      const normalized = match.trim().replace(/[),.!?]+$/, '');
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
      if (urls.length >= 12) return urls;
    }
  }

  return urls;
}

const SCORING_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'over', 'this', 'that', 'your', 'our',
  'you', 'are', 'was', 'were', 'his', 'her', 'their', 'its', 'movie', 'show', 'series',
  'season', 'episode', 'official', 'trailer', 'teaser', 'clip', 'video',
]);

// Hashtags that carry zero signal about specific content — skip when using hashtags as TMDB queries
const SOCIAL_JUNK_TAGS = new Set([
  'fyp', 'foryou', 'foryoupage', 'viral', 'trending', 'explore', 'explorepage',
  'reels', 'reel', 'shorts', 'short', 'instareels', 'instavideo', 'watchthis',
  'movie', 'movies', 'film', 'films', 'cinema', 'watch', 'watching', 'binge', 'bingewatch',
  'netflix', 'disneyplus', 'hbo', 'hulu', 'amazon', 'primevideo', 'appletv',
  'trailer', 'preview', 'official', 'officialtrailer', 'comingsoon', 'nowstreaming',
  'series', 'episode', 'show', 'tvshow', 'webseries', 'newseries',
  'funny', 'comedy', 'meme', 'entertainment', 'fun', 'lol',
  'followme', 'follow', 'like', 'subscribe', 'share', 'comment',
  'mustwatch', 'recommended', 'recommendation', 'review', 'reaction',
]);

function tokensForScore(value: string): string[] {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !SCORING_STOP_WORDS.has(token));
}

function tokenOverlapRatio(left: string, right: string): number {
  const a = tokensForScore(left);
  const b = tokensForScore(right);
  if (!a.length || !b.length) return 0;

  const setA = new Set(a);
  let overlap = 0;
  for (const token of b) {
    if (setA.has(token)) overlap++;
  }
  return overlap / Math.max(setA.size, b.length);
}

function titleSimilarityScore(query: string, candidateTitle: string): number {
  const q = cleanTitleForTMDB(query).toLowerCase();
  const c = cleanTitleForTMDB(candidateTitle).toLowerCase();
  if (!q || !c) return 0;
  if (q === c) return 1;

  const overlap = tokenOverlapRatio(q, c);
  const qCompact = q.replace(/\s+/g, '');
  const cCompact = c.replace(/\s+/g, '');
  const startsWithBonus = c.startsWith(q) || q.startsWith(c) ? 0.2 : 0;
  const containsBonus = c.includes(q) || q.includes(c) ? 0.1 : 0;
  const lengthPenalty = Math.min(0.2, Math.abs(qCompact.length - cCompact.length) / 30);

  return Math.max(0, Math.min(1, overlap * 0.85 + startsWithBonus + containsBonus - lengthPenalty));
}

function extractYearHint(...values: Array<string | undefined | null>): number | undefined {
  for (const value of values) {
    if (!value) continue;
    const matches = value.match(/\b(19\d{2}|20\d{2}|2100)\b/g);
    if (!matches?.length) continue;
    for (const match of matches) {
      const year = parseInt(match, 10);
      if (year >= 1900 && year <= 2100) return year;
    }
  }
  return undefined;
}

function yearMatchScore(sourceYear: number | undefined, candidateYear: number | undefined): number {
  if (!sourceYear || !candidateYear) return 0.5;
  const diff = Math.abs(sourceYear - candidateYear);
  if (diff === 0) return 1;
  if (diff === 1) return 0.7;
  if (diff === 2) return 0.4;
  return 0;
}

function typeMatchScore(
  preferredMediaType: 'movie' | 'tv' | 'unknown' | undefined,
  candidateType: 'movie' | 'tv'
): number {
  if (!preferredMediaType || preferredMediaType === 'unknown') return 0.5;
  return preferredMediaType === candidateType ? 1 : 0;
}

function hasEpisodeSignal(...values: Array<string | undefined | null>): boolean {
  for (const value of values) {
    if (!value) continue;
    if (/\bS\d{1,2}\s*E\d{1,3}\b/i.test(value)) return true;
    if (/\bSeason\s*\d{1,2}\b.*\bEpisode\s*\d{1,3}\b/i.test(value)) return true;
    if (/\bEpisode\s*\d{1,3}\b/i.test(value)) return true;
  }
  return false;
}

function toContentType(
  mediaType: 'movie' | 'tv' | 'unknown' | undefined,
  isEpisode: boolean
): 'movie' | 'series' | 'episode' | undefined {
  if (mediaType === 'movie') return 'movie';
  if (mediaType === 'tv') return isEpisode ? 'episode' : 'series';
  return undefined;
}

function uniqueSearchQueries(primaryTitle: string, alternates: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    const cleaned = cleanTitleForTMDB(value);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  add(primaryTitle);
  for (const alt of alternates) add(alt);
  return out;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeHashtagList(list: string[] | undefined): string[] | undefined {
  if (!list || list.length === 0) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of list) {
    const value = normalizeText(tag).replace(/^#+/, '').toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= 16) break;
  }
  return out.length ? out : undefined;
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength + 1);
  const cut = slice.lastIndexOf(' ');
  return (cut > 0 ? slice.slice(0, cut) : value.slice(0, maxLength)).trim();
}

function firstSentence(value: string): string {
  const part = value.split(/(?<=[.!?])\s+/)[0] ?? value;
  return part.trim();
}

function getSocialTitleAndDescription(rawTitle?: string, rawDescription?: string): {
  title?: string;
  description?: string;
  hashtags?: string[];
} {
  const hashtags = extractHashtags(rawTitle, rawDescription);
  let title = cleanSocialText(rawTitle ?? '');
  let description = cleanSocialText(rawDescription ?? '');

  if (!title && description) {
    const guessed = truncateAtWord(firstSentence(description), 110);
    title = guessed;
    if (guessed && guessed === description) {
      description = '';
    }
  }

  if (title && !description) {
    const split = title.match(/^(.{4,90}?)\s*(?:\||-|:)\s*(.{15,})$/);
    if (split) {
      title = split[1].trim();
      description = split[2].trim();
    }
  }

  if (title.length > 120) {
    const conciseTitle = truncateAtWord(firstSentence(title), 110);
    if (conciseTitle && conciseTitle !== title) {
      description = description || title;
      title = conciseTitle;
    }
  }

  if (description && description === title) {
    description = '';
  }

  return {
    title: title || undefined,
    description: description || undefined,
    hashtags: hashtags && hashtags.length ? hashtags : undefined,
  };
}

function isLikelyMediaTitle(value: string): boolean {
  const cleaned = cleanTitleForTMDB(value);
  if (!cleaned) return false;
  if (cleaned.length < 2 || cleaned.length > 120) return false;
  if (/[@#]|https?:\/\//i.test(value)) return false;
  if (/\b(follow|subscribe|link in bio|fyp|viral|trending|reels|shorts)\b/i.test(value)) return false;
  return cleaned.split(/\s+/).length <= 12;
}

function isSearchableTmdbTitle(value: string): boolean {
  const cleaned = cleanTitleForTMDB(value);
  if (!cleaned) return false;
  if (cleaned.length < 2 || cleaned.length > 140) return false;
  return cleaned.split(/\s+/).length <= 16;
}

function collectTmdbTitleCandidates(base: EnrichResponse): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | undefined | null): void => {
    if (!value) return;
    const cleanedSource = cleanSocialText(value);
    const cleaned = cleanTitleForTMDB(cleanedSource || value);
    if (!cleaned || !isSearchableTmdbTitle(cleaned)) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  add(base.title);
  add(cleanTitleForTMDB(base.title ?? ""));
  if (base.description) {
    add(firstSentence(base.description));
    add(base.description);
  }

  return out.slice(0, 5);
}

function confidenceRank(value: EnrichResponse["matchConfidence"]): number {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  if (value === "low") return 1;
  return 0;
}

function withResolutionDefaults(result: EnrichResponse): EnrichResponse {
  const candidates = result.matchCandidates ?? [];
  const candidateCount = candidates.length;
  const confidenceBand = result.confidenceBand ?? result.matchConfidence;
  const confidenceScore =
    result.confidenceScore ?? candidates[0]?.score ?? (confidenceBand === "high" ? 1 : undefined);
  const resolutionStatus =
    result.resolutionStatus ??
    resolutionStatusFromConfidence(confidenceBand, result.tmdbId || candidateCount > 0 ? Math.max(candidateCount, 1) : 0);

  return {
    ...result,
    matchConfidence: confidenceBand ?? result.matchConfidence,
    confidenceBand,
    confidenceScore,
    resolutionStatus,
    requiresUserSelection: result.requiresUserSelection ?? requiresUserSelection(resolutionStatus),
    primaryCandidate: result.primaryCandidate ?? candidates[0],
    alternatives: result.alternatives ?? candidates.slice(1),
  };
}

async function maybeMergeTMDB(base: EnrichResponse): Promise<EnrichResponse> {
  const knownSourceCandidates = [
    base.canonicalUrl,
    ...extractUrlsFromText(base.title, base.description),
  ];
  const sourceResolved = await resolveKnownSourceToTmdb(knownSourceCandidates);
  if (sourceResolved?.title) {
    return mergeWithTMDB(base, sourceResolved);
  }

  const titleCandidates = collectTmdbTitleCandidates(base);
  const sourceYear = base.releaseYear ?? extractYearHint(base.title, base.description);
  let fallbackLowConfidence: EnrichResponse | null = null;

  for (const titleCandidate of titleCandidates) {
    const tmdb = await enrichTMDB(titleCandidate, {
      description: base.description,
      preferredMediaType: base.mediaType,
      alternateTitles: titleCandidates,
      sourceYear,
    });
    if (!tmdb.title) continue;

    if (confidenceRank(tmdb.matchConfidence) >= 2) {
      return mergeWithTMDB(base, tmdb);
    }

    if (
      !fallbackLowConfidence ||
      confidenceRank(tmdb.matchConfidence) > confidenceRank(fallbackLowConfidence.matchConfidence)
    ) {
      fallbackLowConfidence = tmdb;
    }
  }

  if (fallbackLowConfidence?.title) {
    return mergeWithTMDB(base, fallbackLowConfidence);
  }

  if (base.hashtags?.length) {
    const hashtagFallback = await tryHashtagTmdbFallback(base);
    if (hashtagFallback.tmdbId) {
      return hashtagFallback;
    }
  }

  // Backward-compatible last pass for simple high-signal social titles.
  if (base.title && isLikelyMediaTitle(base.title)) {
    const tmdb = await enrichTMDB(base.title, {
      description: base.description,
      preferredMediaType: base.mediaType,
      alternateTitles: [cleanTitleForTMDB(base.title)],
      sourceYear,
    });
    if (tmdb.title) return mergeWithTMDB(base, tmdb);
  }

  return base;
}

function mergeWithTMDB(base: EnrichResponse, tmdb: EnrichResponse): EnrichResponse {
  return {
    ...base,
    title: tmdb.title ?? base.title,
    description: tmdb.description ?? base.description,
    posterUrl: tmdb.posterUrl ?? base.posterUrl,
    backdropUrl: tmdb.backdropUrl ?? base.backdropUrl,
    runtimeMinutes: tmdb.runtimeMinutes ?? base.runtimeMinutes,
    releaseYear: tmdb.releaseYear ?? base.releaseYear,
    contentType: tmdb.contentType ?? base.contentType,
    mediaType: tmdb.mediaType ?? base.mediaType,
    tmdbId: tmdb.tmdbId ?? base.tmdbId,
    genres: tmdb.genres ?? base.genres,
    voteAverage: tmdb.voteAverage ?? base.voteAverage,
    matchConfidence: tmdb.matchConfidence ?? base.matchConfidence,
    matchCandidates: tmdb.matchCandidates ?? base.matchCandidates,
    resolutionStatus: tmdb.resolutionStatus ?? base.resolutionStatus,
    confidenceScore: tmdb.confidenceScore ?? base.confidenceScore,
    confidenceBand: tmdb.confidenceBand ?? base.confidenceBand,
    requiresUserSelection: tmdb.requiresUserSelection ?? base.requiresUserSelection,
    primaryCandidate: tmdb.primaryCandidate ?? base.primaryCandidate,
    alternatives: tmdb.alternatives ?? base.alternatives,
    matchedBy: tmdb.matchedBy ?? base.matchedBy,
    hashtags: base.hashtags ?? tmdb.hashtags,
  };
}

// --- YouTube ---

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {
    return null;
  }
  return null;
}

async function enrichYouTube(videoId: string): Promise<EnrichResponse> {
  const apiKey = youtubeApiKey.value();
  if (!apiKey) return { provider: 'youtube' };

  try {
    const params = new URLSearchParams({ id: videoId, part: 'snippet,contentDetails', key: apiKey });
    const res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) return { provider: 'youtube' };

    const data = (await res.json()) as {
      items?: Array<{
        snippet?: {
          title?: string;
          description?: string;
          thumbnails?: {
            maxres?: { url?: string };
            high?: { url?: string };
            medium?: { url?: string };
          };
        };
        contentDetails?: {
          duration?: string;
        };
      }>;
    };
    const item = data.items?.[0];
    if (!item) return { provider: 'youtube' };

    const snippet = item.snippet ?? {};
    const thumbs = snippet.thumbnails ?? {};
    const posterUrl = thumbs.maxres?.url ?? thumbs.high?.url ?? thumbs.medium?.url;

    // Get TMDB data FIRST (provides actual content runtime)
    const tmdbData = await enrichTMDB(snippet.title ?? '', {
      description: snippet.description,
      preferredMediaType: 'unknown',
      alternateTitles: [cleanTitleForTMDB(snippet.title ?? '')],
      sourceYear: extractYearHint(snippet.title, snippet.description),
    });

    // Extract video clip duration as FALLBACK ONLY
    const durationMatch = (item.contentDetails?.duration ?? '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    let videoDurationMinutes: number | undefined;
    if (durationMatch) {
      const h = parseInt(durationMatch[1] || '0', 10);
      const m = parseInt(durationMatch[2] || '0', 10);
      const s = parseInt(durationMatch[3] || '0', 10);
      videoDurationMinutes = h * 60 + m + (s > 0 ? 1 : 0);
    }

    logger.info('[enrichYouTube] tmdb runtime:', tmdbData.runtimeMinutes, 'video duration fallback:', videoDurationMinutes);

    const hashtags = extractHashtags(snippet.title, snippet.description);

    return {
      title: tmdbData.title ?? snippet.title,
      description: tmdbData.description ?? snippet.description,
      posterUrl: tmdbData.posterUrl ?? posterUrl,
      backdropUrl: tmdbData.backdropUrl,
      // TMDB runtime is primary, video duration is fallback
      runtimeMinutes: tmdbData.runtimeMinutes ?? videoDurationMinutes,
      releaseYear: tmdbData.releaseYear,
      contentType: tmdbData.contentType ?? 'video',
      mediaType: tmdbData.mediaType,
      tmdbId: tmdbData.tmdbId,
      genres: tmdbData.genres,
      voteAverage: tmdbData.voteAverage,
      matchConfidence: tmdbData.matchConfidence,
      matchCandidates: tmdbData.matchCandidates,
      resolutionStatus: tmdbData.resolutionStatus,
      confidenceScore: tmdbData.confidenceScore,
      confidenceBand: tmdbData.confidenceBand,
      requiresUserSelection: tmdbData.requiresUserSelection,
      primaryCandidate: tmdbData.primaryCandidate,
      alternatives: tmdbData.alternatives,
      matchedBy: tmdbData.matchedBy,
      hashtags: tmdbData.hashtags ?? (hashtags.length ? hashtags : undefined),
      provider: 'youtube',
    };
  } catch (error) {
    logger.error('YouTube error:', redactError(error));
    return { provider: 'youtube' };
  }
}

// --- oEmbed (Twitter, TikTok) ---

async function fetchOEmbed(oembedUrl: string): Promise<OEmbedResponse | null> {
  try {
    const res = await fetchWithTimeout(oembedUrl, {}, 6000);
    if (!res.ok) return null;
    return (await res.json()) as OEmbedResponse;
  } catch {
    return null;
  }
}

async function fillMissingWithMicrolink(base: EnrichResponse, url: string): Promise<EnrichResponse> {
  if (base.title && base.description && base.posterUrl && base.canonicalUrl) return base;
  const ml = await enrichWithMicrolink(url);
  return {
    ...base,
    title: base.title ?? ml.title,
    description: base.description ?? ml.description,
    posterUrl: base.posterUrl ?? ml.posterUrl,
    releaseYear: base.releaseYear ?? ml.releaseYear,
    canonicalUrl: base.canonicalUrl ?? ml.canonicalUrl,
  };
}

async function enrichTwitter(url: string): Promise<EnrichResponse> {
  const [oembed, og] = await Promise.all([
    fetchOEmbed(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`),
    fetchOpenGraph(url),
  ]);

  const oembedText = normalizeText(stripHtmlTags(oembed?.html ?? ''));
  const social = getSocialTitleAndDescription(
    pickFirstNonEmpty(og.title, oembed?.title, oembedText),
    pickFirstNonEmpty(og.description, oembedText)
  );

  let result: EnrichResponse = {
    title: social.title,
    description: social.description,
    posterUrl: resolveAbsoluteUrl(pickFirstNonEmpty(og.image, oembed?.thumbnail_url), url),
    canonicalUrl: og.canonicalUrl,
    hashtags: social.hashtags,
    provider: 'x',
  };

  result = await maybeMergeTMDB(result);
  return fillMissingWithMicrolink(result, url);
}

async function enrichTikTok(url: string): Promise<EnrichResponse> {
  const [oembed, og] = await Promise.all([
    fetchOEmbed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`),
    fetchOpenGraph(url),
  ]);

  const oembedText = normalizeText(stripHtmlTags(oembed?.html ?? ''));
  const social = getSocialTitleAndDescription(
    pickFirstNonEmpty(og.title, oembed?.title, oembedText),
    pickFirstNonEmpty(og.description, oembedText)
  );

  let result: EnrichResponse = {
    title: social.title,
    description: social.description,
    posterUrl: resolveAbsoluteUrl(pickFirstNonEmpty(oembed?.thumbnail_url, og.image), url),
    canonicalUrl: og.canonicalUrl,
    hashtags: social.hashtags,
    provider: 'tiktok',
  };

  result = await maybeMergeTMDB(result);
  return fillMissingWithMicrolink(result, url);
}

// --- OpenGraph ---

function parseTagAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(attrRegex)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (!value || attrs[key]) continue;
    attrs[key] = decodeHtmlEntities(value);
  }
  return attrs;
}

function collectJsonLdObjects(node: unknown, out: Array<Record<string, unknown>>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdObjects(item, out);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  out.push(obj);
  if (obj['@graph']) collectJsonLdObjects(obj['@graph'], out);
}

const READ_IMAGE_MAX_DEPTH = 10;

function readImageFromValue(
  value: unknown,
  depth: number = READ_IMAGE_MAX_DEPTH
): string | undefined {
  if (depth <= 0) return undefined;
  if (typeof value === 'string') return normalizeText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = readImageFromValue(item, depth - 1);
      if (parsed) return parsed;
    }
    return undefined;
  }
  if (typeof value !== 'object' || !value) return undefined;

  const obj = value as Record<string, unknown>;
  return pickFirstNonEmpty(
    typeof obj.url === 'string' ? obj.url : undefined,
    typeof obj.contentUrl === 'string' ? obj.contentUrl : undefined,
    typeof obj.thumbnailUrl === 'string' ? obj.thumbnailUrl : undefined,
    readImageFromValue(obj.image, depth - 1)
  );
}

function extractJsonLdMetadata(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  const objects: Array<Record<string, unknown>> = [];
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(jsonLdPattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      collectJsonLdObjects(JSON.parse(raw), objects);
    } catch {
      // Skip invalid JSON-LD blocks.
    }
  }

  let title: string | undefined;
  let description: string | undefined;
  let image: string | undefined;

  for (const obj of objects) {
    title =
      title ??
      pickFirstNonEmpty(
        typeof obj.headline === 'string' ? obj.headline : undefined,
        typeof obj.name === 'string' ? obj.name : undefined,
        typeof obj.alternativeHeadline === 'string' ? obj.alternativeHeadline : undefined
      );
    description =
      description ??
      pickFirstNonEmpty(typeof obj.description === 'string' ? obj.description : undefined);
    image = image ?? readImageFromValue(obj.image ?? obj.thumbnailUrl);

    if (title && description && image) break;
  }

  return { title, description, image };
}

async function fetchOpenGraph(url: string): Promise<OpenGraphMetadata> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WatchWondersBot/1.0)',
      },
    });
    if (!res.ok) return {};

    const html = await res.text();
    const og: Record<string, string> = {};
    const twitter: Record<string, string> = {};
    const nameMeta: Record<string, string> = {};
    const itemProp: Record<string, string> = {};

    for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
      const attrs = parseTagAttributes(tag[0]);
      const content = attrs.content ? normalizeText(attrs.content) : '';
      if (!content) continue;

      const property = attrs.property?.toLowerCase();
      if (property?.startsWith('og:')) {
        const key = property.slice(3);
        if (!og[key]) og[key] = content;
      }

      const name = attrs.name?.toLowerCase();
      if (name?.startsWith('twitter:')) {
        const key = name.slice(8);
        if (!twitter[key]) twitter[key] = content;
      }
      if (name && !nameMeta[name]) {
        nameMeta[name] = content;
      }

      const prop = attrs.itemprop?.toLowerCase();
      if (prop && !itemProp[prop]) {
        itemProp[prop] = content;
      }
    }

    let canonicalUrl: string | undefined;
    let imageFromLink: string | undefined;
    for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
      const attrs = parseTagAttributes(tag[0]);
      const rel = attrs.rel?.toLowerCase();
      const href = attrs.href;
      if (!rel || !href) continue;

      const relTokens = rel.split(/\s+/);
      if (!canonicalUrl && relTokens.includes('canonical')) {
        canonicalUrl = href;
      }
      if (!imageFromLink && (relTokens.includes('image_src') || relTokens.includes('thumbnail'))) {
        imageFromLink = href;
      }
    }

    const jsonLd = extractJsonLdMetadata(html);
    const htmlTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

    const title = pickFirstNonEmpty(
      og['title'],
      twitter['title'],
      nameMeta['title'],
      itemProp['name'],
      jsonLd.title,
      htmlTitle
    );
    const description = pickFirstNonEmpty(
      og['description'],
      twitter['description'],
      nameMeta['description'],
      itemProp['description'],
      jsonLd.description
    );
    const image = pickFirstNonEmpty(
      og['image:secure_url'],
      og['image:url'],
      og['image'],
      twitter['image'],
      twitter['image:src'],
      twitter['player:image'],
      nameMeta['image'],
      itemProp['image'],
      itemProp['thumbnailurl'],
      imageFromLink,
      jsonLd.image
    );

    return {
      title,
      description,
      image: resolveAbsoluteUrl(image, url),
      canonicalUrl: resolveAbsoluteUrl(pickFirstNonEmpty(og['url'], canonicalUrl), url),
      siteName: pickFirstNonEmpty(og['site_name']),
    };
  } catch {
    return {};
  }
}

// --- Microlink (headless browser fallback) ---

async function enrichWithMicrolink(url: string): Promise<Partial<EnrichResponse>> {
  try {
    const endpoint = `https://api.microlink.io?url=${encodeURIComponent(url)}&meta=true`;
    const res = await fetchWithTimeout(endpoint);
    if (!res.ok) return {};
    const json = (await res.json()) as {
      status?: string;
      data?: {
        title?: string;
        description?: string;
        image?: { url?: string };
        date?: string;
        url?: string;
      };
    };
    if (json.status !== 'success' || !json.data?.title) return {};
    const d = json.data;
    const year = d.date ? new Date(d.date).getFullYear() : undefined;
    logger.info('[microlink] enriched:', redactUrlForLog(url), d.title);
    return {
      title: d.title ?? undefined,
      description: d.description ?? undefined,
      posterUrl: d.image?.url ?? undefined,
      releaseYear: year || undefined,
      canonicalUrl: typeof d.url === 'string' ? d.url : undefined,
    };
  } catch (err) {
    logger.warn('[microlink] failed for', redactUrlForLog(url), err);
    return {};
  }
}

function extractLetterboxdSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes('letterboxd.com')) return null;
    const match = parsed.pathname.match(/^\/film\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function extractRottenTomatoesSlug(url: string): { title: string; preferredMediaType: 'movie' | 'tv' } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes('rottentomatoes.com')) return null;
    const match = parsed.pathname.match(/^\/(?:m|tv)\/([^/]+)/);
    if (!match) return null;

    return {
      title: match[1],
      preferredMediaType: parsed.pathname.startsWith('/tv/') ? 'tv' : 'movie',
    };
  } catch {
    return null;
  }
}

async function resolveTmdbByImdbId(imdbId: string): Promise<EnrichResponse | null> {
  const apiKey = tmdbApiKey.value();
  if (!apiKey) return null;

  try {
    const res = await fetchWithTimeout(
      `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${apiKey}`
    );
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const tvResults = Array.isArray(data.tv_results) ? data.tv_results : [];
    const movieResults = Array.isArray(data.movie_results) ? data.movie_results : [];
    const isTV = tvResults.length > 0;
    const matchResult = (isTV ? tvResults[0] : movieResults[0]) as Record<string, unknown> | undefined;
    if (!matchResult) return null;

    const tmdbId = toFiniteNumber(matchResult.id);
    if (!tmdbId) return null;

    const mediaType: 'movie' | 'tv' = isTV ? 'tv' : 'movie';
    const rawDate = mediaType === 'tv'
      ? (typeof matchResult.first_air_date === 'string' ? matchResult.first_air_date : undefined)
      : (typeof matchResult.release_date === 'string' ? matchResult.release_date : undefined);

    let runtimeMinutes: number | undefined;
    let genres: string[] | undefined;
    try {
      const detailRes = await fetchWithTimeout(
        `https://api.themoviedb.org/3/${mediaType}/${Math.trunc(tmdbId)}?api_key=${apiKey}`
      );
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as Record<string, unknown>;
        if (mediaType === 'tv') {
          const runTimes = Array.isArray(detail.episode_run_time) ? detail.episode_run_time : [];
          runtimeMinutes = runTimes
            .map((value) => toFiniteNumber(value))
            .find((value): value is number => typeof value === 'number' && value > 0);
        } else {
          runtimeMinutes = toFiniteNumber(detail.runtime);
        }

        genres = Array.isArray(detail.genres)
          ? detail.genres
              .map((genre) => {
                if (!genre || typeof genre !== 'object') return undefined;
                const name = (genre as Record<string, unknown>).name;
                return typeof name === 'string' ? normalizeText(name) : undefined;
              })
              .filter((name): name is string => !!name)
          : undefined;
      }
    } catch {
      // Detail fetch is optional for source-resolver matches.
    }

    const title = pickFirstNonEmpty(
      typeof matchResult.title === 'string' ? matchResult.title : undefined,
      typeof matchResult.name === 'string' ? matchResult.name : undefined
    );
    if (!title) return null;

    const description = typeof matchResult.overview === 'string'
      ? normalizeText(matchResult.overview)
      : undefined;
    const posterPath = typeof matchResult.poster_path === 'string' ? matchResult.poster_path : undefined;
    const backdropPath = typeof matchResult.backdrop_path === 'string' ? matchResult.backdrop_path : undefined;
    const voteAverage = toFiniteNumber(matchResult.vote_average);
    const releaseYear = rawDate ? parseInt(rawDate.slice(0, 4), 10) || undefined : undefined;

    return {
      title,
      description,
      posterUrl: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : undefined,
      backdropUrl: backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : undefined,
      releaseYear,
      contentType: toContentType(mediaType, false),
      mediaType,
      tmdbId: Math.trunc(tmdbId),
      runtimeMinutes,
      genres,
      voteAverage,
      matchConfidence: 'high',
      matchedBy: 'tmdb',
      provider: 'generic',
    };
  } catch (error) {
    logger.warn('Known-source IMDb resolver failed:', error);
    return null;
  }
}

async function resolveKnownSourceToTmdb(candidates: Array<string | undefined>): Promise<EnrichResponse | null> {
  const seen = new Set<string>();
  for (const candidateUrl of candidates) {
    if (!candidateUrl) continue;
    const trimmed = candidateUrl.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);

    const imdbId = extractImdbId(trimmed);
    if (imdbId) {
      const resolved = await resolveTmdbByImdbId(imdbId);
      if (resolved?.title) return resolved;
    }

    const letterboxdSlug = extractLetterboxdSlug(trimmed);
    if (letterboxdSlug) {
      const letterboxdTitle = letterboxdSlug.replace(/-/g, ' ');
      const resolved = await enrichTMDB(letterboxdTitle, {
        preferredMediaType: 'movie',
        alternateTitles: [cleanTitleForTMDB(letterboxdTitle)],
        sourceYear: extractYearHint(letterboxdTitle),
      });
      if (resolved.title) return resolved;
    }

    const rotten = extractRottenTomatoesSlug(trimmed);
    if (rotten) {
      const rottenTitle = rotten.title.replace(/[_-]/g, ' ');
      const resolved = await enrichTMDB(rottenTitle, {
        preferredMediaType: rotten.preferredMediaType,
        alternateTitles: [cleanTitleForTMDB(rottenTitle)],
        sourceYear: extractYearHint(rottenTitle),
      });
      if (resolved.title) return resolved;
    }
  }

  return null;
}

/**
 * When social post text is too noisy to search TMDB directly, try each hashtag
 * as a potential movie/show title. Common junk tags are skipped via SOCIAL_JUNK_TAGS.
 * Only adopts the result if confidence is medium or high.
 */
async function tryHashtagTmdbFallback(base: EnrichResponse): Promise<EnrichResponse> {
  const hashtags = base.hashtags ?? [];
  for (const tag of hashtags.slice(0, 10)) {
    if (tag.length < 3 || SOCIAL_JUNK_TAGS.has(tag)) continue;
    // Treat the hashtag as a potential title query
    const tmdb = await enrichTMDB(tag, { preferredMediaType: 'unknown' });
    if (tmdb.title && tmdb.matchConfidence !== 'low') {
      logger.info('[enrich] hashtag TMDB fallback matched:', tag, '->', tmdb.title);
      return mergeWithTMDB(base, tmdb);
    }
  }
  return base;
}

async function enrichViaOG(url: string, provider: string): Promise<EnrichResponse> {
  const og = await fetchOpenGraph(url);

  const isSocialProvider = provider === 'instagram' || provider === 'facebook';

  // Extract candidates from OG metadata (SIGNAL ONLY, not final data)
  let titleCandidates: string[] = [];
  let primaryDescription: string | undefined;
  let hashtags: string[] = [];

  if (isSocialProvider) {
    // For Instagram/Facebook: extract signal from OG metadata to search TMDB
    // Do NOT trust social metadata as-is (it's noisy)
    const social = getSocialTitleAndDescription(og.title, og.description);
    if (social.title) titleCandidates.push(social.title);
    if (og.title && og.title !== social.title) titleCandidates.push(og.title);
    if (og.description && og.description !== social.description) titleCandidates.push(og.description);
    primaryDescription = social.description;
    hashtags = social.hashtags ?? [];

    logger.info('[enrichViaOG] social provider - extracted candidates:', titleCandidates.length);
  } else {
    // Non-social: trust title/description more
    if (og.title) titleCandidates.push(og.title);
    hashtags = extractHashtags(og.title, og.description);
  }

  // Deduplicate and clean candidate titles
  titleCandidates = Array.from(new Set(
    titleCandidates
      .map((t) => cleanTitleForTMDB(t))
      .filter((t) => t && isLikelyMediaTitle(t))
  ));

  let result: EnrichResponse = {
    canonicalUrl: og.canonicalUrl,
    posterUrl: og.image,
    matchedBy: 'metadata',
    provider,
  };

  // PHASE 1: Try known sources (IMDb links, Letterboxd, Rotten Tomatoes, etc.)
  const knownSourceCandidates = [
    url,
    og.canonicalUrl,
    ...extractUrlsFromText(og.title, og.description),
  ];
  const sourceResolved = await resolveKnownSourceToTmdb(knownSourceCandidates);
  if (sourceResolved?.title) {
    result = mergeWithTMDB(result, sourceResolved);
    result.hashtags = hashtags.length ? hashtags : undefined;
    return result;
  }

  // PHASE 2: TMDB-FIRST search for social + generic providers
  if (titleCandidates.length > 0) {
    let preferredMediaType: 'movie' | 'tv' | 'unknown' = 'unknown';
    if (provider === 'netflix') preferredMediaType = 'movie';

    // Try each cleaned title candidate
    for (const titleCandidate of titleCandidates.slice(0, 3)) {
      const tmdbResult = await enrichTMDB(titleCandidate, {
        description: primaryDescription,
        preferredMediaType,
        alternateTitles: titleCandidates,
        sourceYear: extractYearHint(og.title, og.description, primaryDescription),
      });

      if (tmdbResult.title) {
        // Got a TMDB match!
        if (tmdbResult.matchConfidence === 'high') {
          // HIGH confidence: return TMDB result (ignore social metadata)
          logger.info('[enrichViaOG] high confidence TMDB match for provider:', provider);
          result = {
            ...tmdbResult,
            posterUrl: tmdbResult.posterUrl ?? og.image,
            canonicalUrl: og.canonicalUrl ?? tmdbResult.canonicalUrl,
            hashtags: hashtags.length ? hashtags : tmdbResult.hashtags,
            provider,
          };
          return result;
        } else if (tmdbResult.matchConfidence === 'medium' && tmdbResult.matchCandidates && tmdbResult.matchCandidates.length > 0) {
          // MEDIUM confidence: include candidates for user to pick
          logger.info('[enrichViaOG] medium confidence TMDB match - returning candidates');
          result = {
            ...tmdbResult,
            posterUrl: tmdbResult.posterUrl ?? og.image,
            canonicalUrl: og.canonicalUrl ?? tmdbResult.canonicalUrl,
            hashtags: hashtags.length ? hashtags : tmdbResult.hashtags,
            matchCandidates: tmdbResult.matchCandidates,
            provider,
          };
          return result;
        }
        // Low confidence: try next candidate
        logger.info('[enrichViaOG] low confidence TMDB match - trying next candidate');
        continue;
      }
    }
  }

  // PHASE 3: Hashtag fallback for social providers
  if (isSocialProvider && hashtags.length > 0) {
    logger.info('[enrichViaOG] trying hashtag TMDB fallback');
    const hashtagResult = await tryHashtagTmdbFallback({
      title: titleCandidates[0],
      description: primaryDescription,
      hashtags,
      provider,
    } as EnrichResponse);
    if (hashtagResult.tmdbId) {
      result = mergeWithTMDB(result, hashtagResult);
      return result;
    }
  }

  // PHASE 4: Microlink + OG fallback
  logger.info('[enrichViaOG] no TMDB match found, falling back to OG + Microlink');
  result = await fillMissingWithMicrolink(result, url);

  if (result.title || result.description || result.posterUrl) {
    result.hashtags = hashtags.length ? hashtags : result.hashtags;
    return result;
  }

  return { provider };
}
// --- IMDb ---

function extractImdbId(url: string): string | null {
  const match = url.match(/\/title\/(tt\d+)/i);
  return match ? match[1] : null;
}

async function enrichIMDb(url: string): Promise<EnrichResponse> {
  const apiKey = tmdbApiKey.value();
  if (!apiKey) return enrichViaOG(url, 'imdb');

  const imdbId = extractImdbId(url);
  if (!imdbId) return enrichViaOG(url, 'imdb');

  try {
    const res = await fetchWithTimeout(
      `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${apiKey}`
    );
    if (!res.ok) return enrichViaOG(url, 'imdb');

    const data = (await res.json()) as {
      tv_results?: Array<{
        id?: number;
        name?: string;
        overview?: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
        first_air_date?: string;
        vote_average?: number;
      }>;
      movie_results?: Array<{
        id?: number;
        title?: string;
        overview?: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
        release_date?: string;
        vote_average?: number;
      }>;
    };
    const isTV = !!data.tv_results?.[0];
    const result = isTV ? data.tv_results?.[0] : data.movie_results?.[0];
    if (!result) return enrichViaOG(url, 'imdb');
    if (typeof result.id !== 'number') return enrichViaOG(url, 'imdb');

    const rawDate = isTV
      ? ('first_air_date' in result ? result.first_air_date : undefined)
      : ('release_date' in result ? result.release_date : undefined);
    let runtimeMinutes: number | undefined;
    let genres: string[] | undefined;
    try {
      const mediaType = isTV ? 'tv' : 'movie';
      const detailRes = await fetchWithTimeout(
        `https://api.themoviedb.org/3/${mediaType}/${result.id}?api_key=${apiKey}`
      );
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as {
          episode_run_time?: number[];
          runtime?: number;
          genres?: Array<{ name?: string }>;
        };
        runtimeMinutes = isTV ? detail.episode_run_time?.[0] : detail.runtime ?? undefined;
        genres = Array.isArray(detail.genres)
          ? detail.genres
              .map((genre) => (typeof genre?.name === 'string' ? normalizeText(genre.name) : undefined))
              .filter((name: string | undefined): name is string => !!name)
          : undefined;
      }
    } catch (error) {
      logger.debug('[imdb] detail fetch failed', redactError(error));
    }

    return {
      title: ('title' in result ? result.title : undefined) ?? ('name' in result ? result.name : undefined),
      description: result.overview,
      posterUrl: typeof result.poster_path === 'string' ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : undefined,
      backdropUrl: typeof result.backdrop_path === 'string' ? `https://image.tmdb.org/t/p/original${result.backdrop_path}` : undefined,
      releaseYear: rawDate ? parseInt(rawDate.slice(0, 4), 10) || undefined : undefined,
      contentType: toContentType(isTV ? 'tv' : 'movie', false),
      mediaType: isTV ? 'tv' : 'movie',
      tmdbId: result.id,
      runtimeMinutes,
      genres,
      voteAverage: typeof result.vote_average === 'number' ? result.vote_average : undefined,
      matchConfidence: 'high',
      matchedBy: 'tmdb',
      provider: 'imdb',
    };
  } catch (error) {
    logger.error('IMDb enrichment error:', redactError(error));
    return enrichViaOG(url, 'imdb');
  }
}

// --- Letterboxd ---

async function enrichLetterboxd(url: string): Promise<EnrichResponse> {
  try {
    const match = new URL(url).pathname.match(/^\/film\/([^/]+)/);
    if (!match) return enrichViaOG(url, 'letterboxd');
    const title = match[1].replace(/-/g, ' ');
    const tmdb = await enrichTMDB(title, {
      preferredMediaType: 'movie',
      alternateTitles: [cleanTitleForTMDB(title)],
      sourceYear: extractYearHint(title),
    });
    if (tmdb.title) return { ...tmdb, provider: 'letterboxd' };
  } catch (error) {
    logger.debug('[letterboxd] fallback to OG', error);
  }
  return enrichViaOG(url, 'letterboxd');
}

// --- Rotten Tomatoes ---

async function enrichRottenTomatoes(url: string): Promise<EnrichResponse> {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/^\/(?:m|tv)\/([^/]+)/);
    if (!match) return enrichViaOG(url, 'rottentomatoes');
    const title = match[1].replace(/[_-]/g, ' ');
    const preferredMediaType: 'movie' | 'tv' = pathname.startsWith('/tv/') ? 'tv' : 'movie';
    const tmdb = await enrichTMDB(title, {
      preferredMediaType,
      alternateTitles: [cleanTitleForTMDB(title)],
      sourceYear: extractYearHint(title),
    });
    if (tmdb.title) return { ...tmdb, provider: 'rottentomatoes' };
  } catch (error) {
    logger.debug('[rottentomatoes] fallback to OG', error);
  }
  return enrichViaOG(url, 'rottentomatoes');
}

// --- Reddit ---

async function enrichReddit(url: string): Promise<EnrichResponse> {
  try {
    const jsonUrl = url.replace(/\?.*$/, '').replace(/\/$/, '') + '.json';
    const res = await fetchWithTimeout(jsonUrl, {
      headers: { 'User-Agent': 'WatchWondersBot/1.0' },
    }, 6000);
    if (!res.ok) return { provider: 'reddit' };

    const data = (await res.json()) as Array<{
      data?: {
        children?: Array<{
          data?: {
            title?: string;
            selftext?: string;
            thumbnail?: string;
            preview?: {
              images?: Array<{ source?: { url?: string } }>;
            };
          };
        }>;
      };
    }>;
    const post = data?.[0]?.data?.children?.[0]?.data;
    const og = await fetchOpenGraph(url);

    const previewImage = post?.preview?.images?.[0]?.source?.url;
    const thumbnail = typeof post?.thumbnail === 'string' ? post.thumbnail : undefined;
    const imageCandidate =
      (typeof previewImage === 'string' ? previewImage : undefined) ??
      (/^https?:\/\//i.test(thumbnail ?? '') ? thumbnail : undefined) ??
      og.image;

    const social = getSocialTitleAndDescription(
      pickFirstNonEmpty(post?.title, og.title),
      pickFirstNonEmpty(post?.selftext, og.description)
    );

    let result: EnrichResponse = {
      title: social.title,
      description: social.description,
      posterUrl: resolveAbsoluteUrl(imageCandidate ? decodeHtmlEntities(imageCandidate) : undefined, url),
      canonicalUrl: og.canonicalUrl,
      hashtags: social.hashtags,
      provider: 'reddit',
    };

    result = await maybeMergeTMDB(result);
    return fillMissingWithMicrolink(result, url);
  } catch {
    return { provider: 'reddit' };
  }
}

// --- TMDB ---

interface TmdbSearchHint {
  description?: string;
  preferredMediaType?: 'movie' | 'tv' | 'unknown';
  alternateTitles?: string[];
  sourceYear?: number;
}

interface RankedTmdbResult {
  tmdbId: number;
  title: string;
  description?: string;
  mediaType: 'movie' | 'tv';
  releaseYear?: number;
  posterUrl?: string;
  backdropUrl?: string;
  voteAverage?: number;
  score: number;
  scoreBreakdown: TmdbScoreBreakdown;
}

function getTmdbReleaseYear(item: Record<string, unknown>, mediaType: 'movie' | 'tv'): number | undefined {
  const rawDate = mediaType === 'tv'
    ? (typeof item.first_air_date === 'string' ? item.first_air_date : undefined)
    : (typeof item.release_date === 'string' ? item.release_date : undefined);
  if (!rawDate) return undefined;
  const parsed = parseInt(rawDate.slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toRankedTmdbResult(
  item: Record<string, unknown>,
  queryTitles: string[],
  hint?: TmdbSearchHint
): RankedTmdbResult | null {
  const mediaType = item.media_type === 'tv' ? 'tv' : item.media_type === 'movie' ? 'movie' : null;
  if (!mediaType) return null;

  const tmdbIdValue = toFiniteNumber(item.id);
  const tmdbId = tmdbIdValue ? Math.trunc(tmdbIdValue) : undefined;
  if (!tmdbId) return null;

  const title = normalizeText(
    typeof item.title === 'string'
      ? item.title
      : typeof item.name === 'string'
        ? item.name
        : ''
  );
  if (!title) return null;

  const description = typeof item.overview === 'string' ? normalizeText(item.overview) : undefined;
  const releaseYear = getTmdbReleaseYear(item, mediaType);
  const voteAverage = toFiniteNumber(item.vote_average);
  const sourceYear = hint?.sourceYear ?? extractYearHint(...queryTitles, hint?.description);
  const titleScore = queryTitles.length
    ? Math.max(...queryTitles.map((queryTitle) => titleSimilarityScore(queryTitle, title)))
    : 0;
  const yearScore = yearMatchScore(sourceYear, releaseYear);
  const typeScore = typeMatchScore(hint?.preferredMediaType, mediaType);
  const overviewScore = hint?.description
    ? tokenOverlapRatio(hint.description, description ?? '')
    : 0.5;
  const score = Math.max(
    0,
    Math.min(1, titleScore * 0.55 + yearScore * 0.20 + typeScore * 0.15 + overviewScore * 0.10)
  );
  const scoreBreakdown: TmdbScoreBreakdown = {
    title: titleScore,
    year: yearScore,
    type: typeScore,
    overview: overviewScore,
    total: score,
  };

  return {
    tmdbId,
    title,
    description: description || undefined,
    mediaType,
    releaseYear,
    posterUrl: typeof item.poster_path === 'string' ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
    backdropUrl: typeof item.backdrop_path === 'string' ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : undefined,
    voteAverage,
    score,
    scoreBreakdown,
  };
}

async function fetchTmdbSearchResults(
  apiKey: string,
  queries: string[]
): Promise<Array<Record<string, unknown>>> {
  const deduped = new Map<string, Record<string, unknown>>();

  for (const query of queries.slice(0, 3)) {
    try {
      const params = new URLSearchParams({ api_key: apiKey, query, include_adult: 'false' });
      const res = await fetchWithTimeout(`https://api.themoviedb.org/3/search/multi?${params}`);
      if (!res.ok) continue;

      const data = (await res.json()) as Record<string, unknown>;
      const rawResults = Array.isArray(data.results) ? data.results : [];
      for (const raw of rawResults) {
        if (!raw || typeof raw !== 'object') continue;
        const result = raw as Record<string, unknown>;
        const mediaType = result.media_type;
        const id = toFiniteNumber(result.id);
        if (!id || (mediaType !== 'movie' && mediaType !== 'tv')) continue;
        const key = `${mediaType}:${Math.trunc(id)}`;
        if (!deduped.has(key)) deduped.set(key, result);
      }
    } catch {
      // If one title-query fails, keep trying the rest.
    }
  }

  return Array.from(deduped.values());
}

interface TmdbCandidateDetails {
  runtimeMinutes?: number;
  genres?: string[];
  description?: string;
}

function candidateKey(item: { mediaType: 'movie' | 'tv'; tmdbId: number }): string {
  return `${item.mediaType}:${item.tmdbId}`;
}

async function fetchTmdbCandidateDetails(
  apiKey: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number
): Promise<TmdbCandidateDetails> {
  try {
    const detailRes = await fetchWithTimeout(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`
    );
    if (!detailRes.ok) return {};

    const detail = (await detailRes.json()) as Record<string, unknown>;
    let runtimeMinutes: number | undefined;
    if (mediaType === 'tv') {
      const runTimes = Array.isArray(detail.episode_run_time) ? detail.episode_run_time : [];
      runtimeMinutes = runTimes
        .map((value) => toFiniteNumber(value))
        .find((value): value is number => typeof value === 'number' && value > 0);
    } else {
      runtimeMinutes = toFiniteNumber(detail.runtime);
    }

    const genres = Array.isArray(detail.genres)
      ? detail.genres
          .map((genre) => {
            if (!genre || typeof genre !== 'object') return undefined;
            const name = (genre as Record<string, unknown>).name;
            return typeof name === 'string' ? normalizeText(name) : undefined;
          })
          .filter((name): name is string => !!name)
      : undefined;

    const description = typeof detail.overview === 'string'
      ? normalizeText(detail.overview)
      : undefined;

    return { runtimeMinutes, genres, description };
  } catch {
    return {};
  }
}

async function enrichTMDB(title: string, hint?: TmdbSearchHint): Promise<EnrichResponse> {
  const apiKey = tmdbApiKey.value();
  if (!apiKey || !title) return { provider: 'generic' };

  try {
    const queryTitles = uniqueSearchQueries(title, hint?.alternateTitles);
    if (!queryTitles.length) return { provider: 'generic' };

    const sourceYear = hint?.sourceYear ?? extractYearHint(...queryTitles, hint?.description);
    const searchHint: TmdbSearchHint = { ...hint, sourceYear };

    const rawResults = await fetchTmdbSearchResults(apiKey, queryTitles);
    const ranked = rawResults
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        return toRankedTmdbResult(raw as Record<string, unknown>, queryTitles, searchHint);
      })
      .filter((item): item is RankedTmdbResult => !!item)
      .sort((left, right) => right.score - left.score);

    const best = ranked[0];
    if (!best) return { provider: 'generic' };

    const secondBest = ranked[1];
    const confidence = secondBest
      ? confidenceFromScores(best.score, Math.max(0, best.score - secondBest.score))
      : confidenceFromScores(best.score, 1);

    const episodeHint = hasEpisodeSignal(...queryTitles, hint?.description);
    const topCandidates = ranked.slice(0, 3);
    const detailPairs = await Promise.all(
      topCandidates.map(async (item) => {
        const details = await fetchTmdbCandidateDetails(apiKey, item.mediaType, item.tmdbId);
        return [candidateKey(item), details] as const;
      })
    );
    const detailsByCandidate = new Map<string, TmdbCandidateDetails>(detailPairs);
    const bestDetails = detailsByCandidate.get(candidateKey(best)) ?? {};

    const candidates: TmdbMatchCandidate[] = topCandidates.map((item) => {
      const details = detailsByCandidate.get(candidateKey(item)) ?? {};
      return {
        tmdbId: item.tmdbId,
        title: item.title,
        mediaType: item.mediaType,
        contentType: toContentType(item.mediaType, episodeHint),
        releaseYear: item.releaseYear,
        posterUrl: item.posterUrl,
        backdropUrl: item.backdropUrl,
        description: details.description ?? item.description,
        voteAverage: item.voteAverage,
        runtimeMinutes: details.runtimeMinutes,
        genres: details.genres,
        score: Number(item.score.toFixed(3)),
        scoreBreakdown: {
          title: Number(item.scoreBreakdown.title.toFixed(3)),
          year: Number(item.scoreBreakdown.year.toFixed(3)),
          type: Number(item.scoreBreakdown.type.toFixed(3)),
          overview: Number(item.scoreBreakdown.overview.toFixed(3)),
          total: Number(item.scoreBreakdown.total.toFixed(3)),
        },
      };
    });
    const resolutionStatus = resolutionStatusFromConfidence(confidence, candidates.length);
    const confidenceScore = Number(best.score.toFixed(3));

    return {
      title: best.title,
      description: bestDetails.description ?? best.description,
      posterUrl: best.posterUrl,
      backdropUrl: best.backdropUrl,
      releaseYear: best.releaseYear,
      contentType: toContentType(best.mediaType, episodeHint),
      mediaType: best.mediaType,
      tmdbId: best.tmdbId,
      runtimeMinutes: bestDetails.runtimeMinutes,
      genres: bestDetails.genres,
      voteAverage: best.voteAverage,
      matchConfidence: confidence,
      matchCandidates: candidates,
      resolutionStatus,
      confidenceScore,
      confidenceBand: confidence,
      requiresUserSelection: requiresUserSelection(resolutionStatus),
      primaryCandidate: candidates[0],
      alternatives: candidates.slice(1),
      matchedBy: 'tmdb',
      provider: 'generic',
    };
  } catch (error) {
    logger.error('TMDB error:', redactError(error));
    return { provider: 'generic' };
  }
}

// --- Main Handler ---

export async function runEnrichmentRequest(
  data: { url?: unknown; title?: unknown },
): Promise<EnrichResponse> {
  const { url, title: titleQuery } = data;

  // Title-only path: caller wants a TMDB title search without a source URL
  if (!url && titleQuery && typeof titleQuery === 'string' && titleQuery.trim()) {
    const trimmedTitle = titleQuery.trim();
    logger.info('Enriching by title:', trimmedTitle.slice(0, 60));
    const result = await enrichTMDB(trimmedTitle);
    return withResolutionDefaults(result);
  }

  if (!url || typeof url !== 'string') {
    throw new HttpsError('invalid-argument', 'URL is required.');
  }

  const validatedUrl = normalizeAndValidateUrl(url);
  const normalizedUrl = validatedUrl.toString();

  logger.info('Enriching URL:', redactUrlForLog(normalizedUrl));
  const provider = detectProvider(normalizedUrl);
  let result: EnrichResponse = { provider };

  switch (provider) {
    case 'youtube': {
      const videoId = extractYouTubeVideoId(normalizedUrl);
      if (videoId) result = await enrichYouTube(videoId);
      break;
    }
    case 'x':
      result = await enrichTwitter(normalizedUrl);
      break;
    case 'tiktok':
      result = await enrichTikTok(normalizedUrl);
      break;
    case 'reddit':
      result = await enrichReddit(normalizedUrl);
      break;
    case 'imdb':
      result = await enrichIMDb(normalizedUrl);
      break;
    case 'letterboxd':
      result = await enrichLetterboxd(normalizedUrl);
      break;
    case 'rottentomatoes':
      result = await enrichRottenTomatoes(normalizedUrl);
      break;
    case 'instagram':
    case 'facebook':
    case 'netflix':
    case 'generic':
      result = await enrichViaOG(normalizedUrl, provider);
      break;
  }

  const resultWithResolution = withResolutionDefaults(result);
  const normalizedHashtags = normalizeHashtagList(resultWithResolution.hashtags);
  return {
    ...resultWithResolution,
    provider: resultWithResolution.provider ?? provider,
    canonicalUrl: resultWithResolution.canonicalUrl ?? normalizedUrl,
    hashtags: normalizedHashtags,
  };
}

export const enrich = onCall(
  { memory: '256MiB', timeoutSeconds: 30, secrets: [youtubeApiKey, tmdbApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    try {
      return await runEnrichmentRequest(request.data as { url?: unknown; title?: unknown });
    } catch (error) {
      logger.error('Enrichment error:', redactError(error));
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Unable to enrich URL at this time.');
    }
  }
);


