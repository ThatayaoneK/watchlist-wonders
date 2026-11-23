export type MatchConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type ResolutionStatus = 'matched' | 'needs_selection' | 'unresolved' | 'unknown';

export interface EnrichmentMatchCandidate {
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
  scoreBreakdown?: {
    title?: number;
    year?: number;
    type?: number;
    overview?: number;
    popularity?: number;
    embedding?: number;
    total?: number;
  };
}

export interface SmartFillData {
  description: string | null;
  tags: string[];
  moodTags: string[];
  releaseYear: number | null;
  canonicalUrl: string | null;
  metadata: Record<string, unknown>;
  matchCandidates: EnrichmentMatchCandidate[];
  matchConfidence: MatchConfidence;
  resolutionStatus: ResolutionStatus;
  resolutionConfidence: number | null;
  resolutionConfidenceBand: MatchConfidence;
  requiresUserSelection: boolean;
}

const GENRE_ALIASES: Record<string, string> = {
  "science fiction": "scifi",
  "sci-fi": "scifi",
  "sci-fi & fantasy": "scifi",
  "action & adventure": "action",
  "war & politics": "war",
  "tv movie": "movie",
  "kids": "family",
};

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').toLowerCase();
}

export function normalizeHashtags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 16) break;
  }
  return tags;
}

export function normalizeGenres(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const genres: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const genre = raw.trim();
    if (!genre) continue;
    const key = genre.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    genres.push(genre);
  }
  return genres;
}

function normalizeGenreTag(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s&-]/g, "")
    .replace(/\s+/g, " ");
  return GENRE_ALIASES[normalized] ?? normalized;
}

export function mapGenresToMoodTags(genres: string[]): string[] {
  const normalizedGenres: string[] = [];
  const seen = new Set<string>();
  for (const genre of genres) {
    const value = normalizeGenreTag(genre);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalizedGenres.push(value);
    if (normalizedGenres.length >= 8) break;
  }
  return normalizedGenres;
}

function normalizeMatchConfidence(value: unknown): MatchConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'unknown';
}

function normalizeResolutionStatus(value: unknown): ResolutionStatus {
  if (value === 'matched' || value === 'needs_selection' || value === 'unresolved') return value;
  return 'unknown';
}

export function parseMatchCandidates(input: unknown): EnrichmentMatchCandidate[] {
  if (!Array.isArray(input)) return [];
  const candidates: EnrichmentMatchCandidate[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const tmdbId = asNumber(item.tmdbId);
    const title = asString(item.title);
    const mediaType = item.mediaType === 'tv' ? 'tv' : item.mediaType === 'movie' ? 'movie' : null;
    if (!tmdbId || !title || !mediaType) continue;

    const genres = normalizeGenres(item.genres);
    candidates.push({
      tmdbId,
      title,
      mediaType,
      contentType:
        item.contentType === "episode" || item.contentType === "series" || item.contentType === "movie"
          ? item.contentType
          : undefined,
      releaseYear: asNumber(item.releaseYear) ?? undefined,
      posterUrl: asString(item.posterUrl) ?? undefined,
      backdropUrl: asString(item.backdropUrl) ?? undefined,
      description: asString(item.description) ?? undefined,
      voteAverage: asNumber(item.voteAverage) ?? undefined,
      runtimeMinutes: asNumber(item.runtimeMinutes) ?? undefined,
      genres: genres.length ? genres : undefined,
      score: asNumber(item.score) ?? undefined,
      scoreBreakdown:
        item.scoreBreakdown && typeof item.scoreBreakdown === "object" && !Array.isArray(item.scoreBreakdown)
          ? (item.scoreBreakdown as EnrichmentMatchCandidate["scoreBreakdown"])
          : undefined,
    });
  }
  return candidates;
}

function deriveResolutionStatus(
  explicitStatus: ResolutionStatus,
  confidence: MatchConfidence,
  candidates: EnrichmentMatchCandidate[],
  tmdbId: number | null,
): ResolutionStatus {
  if (explicitStatus !== "unknown") return explicitStatus;
  if (confidence === "high" && tmdbId) return "matched";
  if (candidates.length > 0) return "needs_selection";
  return "unresolved";
}

export function buildSmartFillData(raw: Record<string, unknown>): SmartFillData {
  const description = asString(raw.description);
  const releaseYear = asNumber(raw.releaseYear);
  const canonicalUrl = asString(raw.canonicalUrl);
  const genres = normalizeGenres(raw.genres);
  const moodTags = mapGenresToMoodTags(genres);
  const tags = normalizeHashtags(raw.hashtags);
  const matchCandidates = parseMatchCandidates(raw.matchCandidates);
  const matchConfidence = normalizeMatchConfidence(raw.matchConfidence);
  const resolutionConfidence = asNumber(raw.confidenceScore ?? raw.resolutionConfidence ?? raw.resolution_confidence);
  const resolutionConfidenceBand = normalizeMatchConfidence(
    raw.confidenceBand ?? raw.resolutionConfidenceBand ?? raw.resolution_confidence_band ?? raw.matchConfidence,
  );

  const tmdbId = asNumber(raw.tmdbId);
  const backdropUrl = asString(raw.backdropUrl);
  const posterUrl = asString(raw.posterUrl);
  const voteAverage = asNumber(raw.voteAverage);
  const resolutionStatus = deriveResolutionStatus(
    normalizeResolutionStatus(raw.resolutionStatus ?? raw.resolution_status),
    matchConfidence,
    matchCandidates,
    tmdbId,
  );
  const requiresUserSelection =
    typeof raw.requiresUserSelection === "boolean"
      ? raw.requiresUserSelection
      : resolutionStatus !== "matched";

  const metadata: Record<string, unknown> = {
    ...(tmdbId ? { tmdb_id: tmdbId } : {}),
    ...(backdropUrl ? { backdrop_url: backdropUrl } : {}),
    ...(posterUrl ? { poster_url: posterUrl } : {}),
    ...(description ? { overview: description } : {}),
    ...(voteAverage !== null ? { vote_average: voteAverage } : {}),
    ...(genres.length ? { genres } : {}),
    ...(matchConfidence !== 'unknown' ? { match_confidence: matchConfidence } : {}),
    ...(matchCandidates.length ? { match_candidates: matchCandidates } : {}),
    resolution_status: resolutionStatus,
    resolution_requires_selection: requiresUserSelection,
    ...(resolutionConfidence !== null ? { resolution_confidence: resolutionConfidence } : {}),
    ...(resolutionConfidenceBand !== 'unknown' ? { resolution_confidence_band: resolutionConfidenceBand } : {}),
    ...(resolutionStatus === 'matched' ? { resolution_selected_by: 'auto' } : {}),
  };

  return {
    description,
    tags,
    moodTags,
    releaseYear: releaseYear !== null ? releaseYear : null,
    canonicalUrl,
    metadata,
    matchCandidates,
    matchConfidence,
    resolutionStatus,
    resolutionConfidence,
    resolutionConfidenceBand,
    requiresUserSelection,
  };
}
