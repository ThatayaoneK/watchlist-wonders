export interface PipelineBookmark {
  id: string;
  userId: string;
  title?: string;
  source_url?: string | null;
  canonical_url?: string | null;
  provider?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown>;
  poster_url?: string | null;
  tags?: string[];
  notes?: string | null;
  user_rating?: number | null;
  enriched?: boolean;
  tmdb?: unknown;
  view_count?: number;
  importance_score?: number;
}

export interface ExtractedSignals {
  rawTitle: string;
  description: string;
  thumbnailUrl: string | null;
  hashtags: string[];
  username: string | null;
  platform: string;
  fullText: string;
  domainType: "video" | "article" | "social" | "product" | "media" | "other";
}

export interface FingerprintResult {
  textEmbedding: number[];
  textEmbeddingId: string;
  imageEmbedding: number[] | null;
  imageEmbeddingId: string | null;
  extractedKeywords: string[];
  platform: string;
}

export interface ClassifyResult {
  contentType: "movie" | "tv" | "anime" | "music" | "clip" | "meme" | "article" | "unknown";
  candidateTitles: string[];
  possibleFranchise: string | null;
  year: number | null;
  characters: string[];
  confidence: number;
}

export interface ResolveResult {
  source: "tmdb" | "imdb" | "youtube" | "spotify" | "unresolved";
  id: string;
  type: ClassifyResult["contentType"];
  title: string;
  year: number | null;
  genres: string[];
  runtime: number | null;
  poster: string | null;
  confidence: number;
  suggested: boolean;
  status?: "matched" | "needs_selection" | "unresolved";
  confidenceBand?: "high" | "medium" | "low";
  candidates?: ResolutionCandidate[];
  requiresUserSelection?: boolean;
}

export interface ResolutionCandidate {
  source: "tmdb";
  id: string;
  tmdbId: number;
  type: "movie" | "tv";
  title: string;
  year: number | null;
  poster: string | null;
  confidence: number;
  scoreBreakdown: {
    title: number;
    year: number;
    popularity: number;
    embedding: number;
    total: number;
  };
}

export interface AutoTagResult {
  tags: string[];
  inferredMood: string | null;
  topics: string[];
}

export interface ClusterAssignment {
  clusterId: string | null;
  pending: boolean;
}

export interface PipelineContext {
  bookmark: PipelineBookmark;
  tmdbApiKey: string | null;
  extracted?: ExtractedSignals;
  fingerprint?: FingerprintResult;
  classify?: ClassifyResult;
  resolve?: ResolveResult;
  autoTags?: AutoTagResult;
  cluster?: ClusterAssignment;
  errors: Record<string, string>;
}

export const PIPELINE_VERSION = 2;
