import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';

const youtubeApiKey = defineSecret('YOUTUBE_API_KEY');
const tmdbApiKey = defineSecret('TMDB_API_KEY');

interface EnrichResponse {
  title?: string;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  runtimeMinutes?: number;
  releaseYear?: number;
  mediaType?: 'movie' | 'tv' | 'unknown';
  provider?: string;
  tmdbId?: number;
  error?: { message: string };
}

// --- URL Sanitization ---

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Return URL without query string and fragment
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    // If URL parsing fails, return URL as-is
    return url;
  }
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
    .replace(/[-–]\s*(trailer|teaser|season\s*\d+).*/gi, '')
    .replace(/[^\w\s']/g, ' ') // strip emoji/symbols
    .replace(/\s+/g, ' ')
    .trim();
}

// --- YouTube ---

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {}
  return null;
}

async function enrichYouTube(videoId: string): Promise<EnrichResponse> {
  const apiKey = youtubeApiKey.value();
  if (!apiKey) return { provider: 'youtube' };

  try {
    const params = new URLSearchParams({ id: videoId, part: 'snippet,contentDetails', key: apiKey });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) return { provider: 'youtube' };

    const data = (await res.json()) as any;
    const item = data.items?.[0];
    if (!item) return { provider: 'youtube' };

    const snippet = item.snippet ?? {};
    const thumbs = snippet.thumbnails ?? {};
    const posterUrl = thumbs.maxres?.url ?? thumbs.high?.url ?? thumbs.medium?.url;

    const durationMatch = (item.contentDetails?.duration ?? '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    let runtimeMinutes: number | undefined;
    if (durationMatch) {
      const h = parseInt(durationMatch[1] || '0', 10);
      const m = parseInt(durationMatch[2] || '0', 10);
      const s = parseInt(durationMatch[3] || '0', 10);
      runtimeMinutes = h * 60 + m + (s > 0 ? 1 : 0);
    }

    // Cross-enrich: use cleaned YouTube title to get TMDB metadata
    const tmdbData = await enrichTMDB(cleanTitleForTMDB(snippet.title ?? ''));

    return {
      title: tmdbData.title ?? snippet.title,
      description: tmdbData.description ?? snippet.description,
      posterUrl: tmdbData.posterUrl ?? posterUrl,
      backdropUrl: tmdbData.backdropUrl,
      runtimeMinutes: tmdbData.runtimeMinutes ?? runtimeMinutes,
      releaseYear: tmdbData.releaseYear,
      mediaType: tmdbData.mediaType,
      tmdbId: tmdbData.tmdbId,
      provider: 'youtube',
    };
  } catch (error) {
    logger.error('YouTube error:', error);
    return { provider: 'youtube' };
  }
}

// --- oEmbed (Twitter, TikTok) ---

async function fetchOEmbed(oembedUrl: string): Promise<{ title?: string; html?: string } | null> {
  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

async function enrichTwitter(url: string): Promise<EnrichResponse> {
  const oembed = await fetchOEmbed(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`);
  const rawText = oembed?.html?.replace(/<[^>]+>/g, '') ?? '';
  const cleaned = cleanTitleForTMDB(rawText.split('\n')[0]);
  if (!cleaned) return { provider: 'x' };
  const tmdb = await enrichTMDB(cleaned);
  return { ...tmdb, provider: 'x' };
}

async function enrichTikTok(url: string): Promise<EnrichResponse> {
  const oembed = await fetchOEmbed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!oembed?.title) return { provider: 'tiktok' };
  const tmdb = await enrichTMDB(cleanTitleForTMDB(oembed.title));
  return { ...tmdb, provider: 'tiktok' };
}

// --- OpenGraph ---

async function fetchOpenGraph(url: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WatchWondersBot/1.0)',
      },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const og: Record<string, string> = {};
    const matches = html.matchAll(/<meta[^>]+property=["']og:(\w+)["'][^>]+content=["']([^"']+)["']/gi);
    for (const m of matches) og[m[1]] = m[2];
    if (!og['title']) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) og['title'] = titleMatch[1];
    }
    return og;
  } catch {
    return {};
  }
}

async function enrichViaOG(url: string, provider: string): Promise<EnrichResponse> {
  const og = await fetchOpenGraph(url);
  if (!og['title']) return { provider };

  const cleaned = cleanTitleForTMDB(og['title']);
  const tmdb = await enrichTMDB(cleaned);

  return {
    title: tmdb.title ?? og['title'],
    description: tmdb.description ?? og['description'],
    posterUrl: tmdb.posterUrl ?? og['image'],
    backdropUrl: tmdb.backdropUrl,
    releaseYear: tmdb.releaseYear,
    mediaType: tmdb.mediaType,
    tmdbId: tmdb.tmdbId,
    provider,
  };
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
    const res = await fetch(
      `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${apiKey}`
    );
    if (!res.ok) return enrichViaOG(url, 'imdb');

    const data = (await res.json()) as any;
    const isTV = !!data.tv_results?.[0];
    const result = isTV ? data.tv_results[0] : data.movie_results?.[0];
    if (!result) return enrichViaOG(url, 'imdb');

    const rawDate = isTV ? result.first_air_date : result.release_date;
    let runtimeMinutes: number | undefined;
    try {
      const mediaType = isTV ? 'tv' : 'movie';
      const detailRes = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${result.id}?api_key=${apiKey}`
      );
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as any;
        runtimeMinutes = isTV ? detail.episode_run_time?.[0] : detail.runtime ?? undefined;
      }
    } catch {}

    return {
      title: result.title ?? result.name,
      description: result.overview,
      posterUrl: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : undefined,
      backdropUrl: result.backdrop_path ? `https://image.tmdb.org/t/p/original${result.backdrop_path}` : undefined,
      releaseYear: rawDate ? parseInt(rawDate.slice(0, 4), 10) || undefined : undefined,
      mediaType: isTV ? 'tv' : 'movie',
      tmdbId: result.id,
      runtimeMinutes,
      provider: 'imdb',
    };
  } catch (error) {
    logger.error('IMDb enrichment error:', error);
    return enrichViaOG(url, 'imdb');
  }
}

// --- Letterboxd ---

async function enrichLetterboxd(url: string): Promise<EnrichResponse> {
  try {
    const match = new URL(url).pathname.match(/^\/film\/([^/]+)/);
    if (!match) return enrichViaOG(url, 'letterboxd');
    const title = match[1].replace(/-/g, ' ');
    const tmdb = await enrichTMDB(title);
    if (tmdb.title) return { ...tmdb, provider: 'letterboxd' };
  } catch {}
  return enrichViaOG(url, 'letterboxd');
}

// --- Rotten Tomatoes ---

async function enrichRottenTomatoes(url: string): Promise<EnrichResponse> {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/^\/(?:m|tv)\/([^/]+)/);
    if (!match) return enrichViaOG(url, 'rottentomatoes');
    const title = match[1].replace(/[_-]/g, ' ');
    const tmdb = await enrichTMDB(title);
    if (tmdb.title) return { ...tmdb, provider: 'rottentomatoes' };
  } catch {}
  return enrichViaOG(url, 'rottentomatoes');
}

// --- Reddit ---

async function enrichReddit(url: string): Promise<EnrichResponse> {
  try {
    const jsonUrl = url.replace(/\?.*$/, '').replace(/\/$/, '') + '.json';
    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': 'WatchWondersBot/1.0' },
    });
    if (!res.ok) return { provider: 'reddit' };
    const data = (await res.json()) as any;
    const post = data?.[0]?.data?.children?.[0]?.data;
    if (!post?.title) return { provider: 'reddit' };
    const tmdb = await enrichTMDB(cleanTitleForTMDB(post.title));
    return { ...tmdb, provider: 'reddit' };
  } catch {
    return { provider: 'reddit' };
  }
}

// --- TMDB ---

async function enrichTMDB(title: string): Promise<EnrichResponse> {
  const apiKey = tmdbApiKey.value();
  if (!apiKey || !title) return { provider: 'generic' };

  try {
    const params = new URLSearchParams({ api_key: apiKey, query: title });
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`);
    if (!res.ok) return { provider: 'generic' };

    const data = (await res.json()) as any;
    const result = data.results?.find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
    if (!result) return { provider: 'generic' };

    const isTV = result.media_type === 'tv';
    const rawDate = isTV ? result.first_air_date : result.release_date;

    let runtimeMinutes: number | undefined;
    try {
      const detailRes = await fetch(
        `https://api.themoviedb.org/3/${result.media_type}/${result.id}?api_key=${apiKey}`
      );
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as any;
        runtimeMinutes = isTV ? detail.episode_run_time?.[0] : detail.runtime ?? undefined;
      }
    } catch {}

    return {
      title: result.title ?? result.name,
      description: result.overview,
      posterUrl: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : undefined,
      backdropUrl: result.backdrop_path ? `https://image.tmdb.org/t/p/original${result.backdrop_path}` : undefined,
      releaseYear: rawDate ? parseInt(rawDate.slice(0, 4), 10) || undefined : undefined,
      mediaType: isTV ? 'tv' : 'movie',
      tmdbId: result.id,
      runtimeMinutes,
      provider: 'generic',
    };
  } catch (error) {
    logger.error('TMDB error:', error);
    return { provider: 'generic' };
  }
}

// --- Main Handler ---

export const enrich = onCall(
  { memory: '256MiB', timeoutSeconds: 30, secrets: [youtubeApiKey, tmdbApiKey] },
  async (request: any) => {
    try {
      const { url } = request.data;
      if (!url || typeof url !== 'string') {
        throw new Error('URL is required');
      }

      const sanitizedUrl = sanitizeUrl(url);
      logger.info('Enriching URL:', sanitizedUrl);
      const provider = detectProvider(url);
      let result: EnrichResponse = { provider };

      switch (provider) {
        case 'youtube': {
          const videoId = extractYouTubeVideoId(url);
          if (videoId) result = await enrichYouTube(videoId);
          break;
        }
        case 'x':
          result = await enrichTwitter(url);
          break;
        case 'tiktok':
          result = await enrichTikTok(url);
          break;
        case 'reddit':
          result = await enrichReddit(url);
          break;
        case 'imdb':
          result = await enrichIMDb(url);
          break;
        case 'letterboxd':
          result = await enrichLetterboxd(url);
          break;
        case 'rottentomatoes':
          result = await enrichRottenTomatoes(url);
          break;
        case 'instagram':
        case 'facebook':
        case 'netflix':
        case 'generic':
          result = await enrichViaOG(url, provider);
          break;
      }

      return result;
    } catch (error) {
      logger.error('Enrichment error:', error);
      throw error;
    }
  }
);
