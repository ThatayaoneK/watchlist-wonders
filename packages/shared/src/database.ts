import type { CaptureStatus, CaptureSurface } from "./capture";
import type { BookmarkAvailability } from "./availability";

export interface TmdbStreamingProvider {
  id: number;
  name: string;
  logoPath: string | null;
  logoUrl: string | null;
}

export interface TmdbStreamingAvailability {
  flatrate: TmdbStreamingProvider[];
  rent: TmdbStreamingProvider[];
  buy: TmdbStreamingProvider[];
  free: TmdbStreamingProvider[];
  link: string;
}

export interface TmdbEnrichment {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  originalTitle: string;
  overview: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  backdropPath: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  rating: number | null;
  voteCount: number | null;
  popularity: number | null;
  genreIds: number[];
  genres: string[];
  runtimeMinutes: number | null;
  trailerUrl: string | null;
  canonicalUrl: string | null;
  streaming: Record<string, TmdbStreamingAvailability>;
  enrichedAt: string;
}

/** All documented keys stored in the bookmark metadata bag.
 *  Add new keys here rather than sprinkling raw strings throughout the codebase.
 *  The index signature allows service-specific extension while keeping known keys typed.
 */
export interface BookmarkMetadata {
  // Lifecycle tracking
  lifecycle_state?: unknown;
  lifecycle_updated_at?: string;
  // Episode tracking (series only)
  episodes_watched?: number;
  total_episodes?: number;
  // Trailer / video links
  trailer_url?: string;
  youtube_trailer_url?: string;
  // TMDB identifier — tmdb_id is canonical; tmdbId is a legacy alias, do not write new values to it
  tmdb_id?: number;
  /** @deprecated use tmdb_id */
  tmdbId?: number;
  // Streaming availability snapshot (mirrors top-level availability field)
  availability?: unknown;
  match_candidates?: unknown[];
  resolution_status?: "matched" | "needs_selection" | "unresolved";
  resolution_confidence?: number;
  resolution_confidence_band?: "high" | "medium" | "low";
  resolution_requires_selection?: boolean;
  resolution_selected_by?: "auto" | "user" | "manual";
  resolution_selected_rank?: number;
  resolution_candidate_history?: unknown[];
  raw_title?: string;
  share_target?: boolean;
  share_raw_title?: string | null;
  share_raw_text?: string | null;
  share_received_at?: string;
  capture_surface?: CaptureSurface;
  capture_received_at?: string;
  capture_status?: CaptureStatus;
  capture_source_platform?: string;
  capture_client_timestamp?: string | null;
  capture_latency_ms?: number | null;
  capture_device_id?: string | null;
  duplicate_of_bookmark_id?: string | null;
  [key: string]: unknown;
}

export interface Bookmark {
  id: string;
  user_id: string;
  title: string;
  type: "movie" | "series" | "episode" | "video" | "doc" | "other";
  provider: "youtube" | "imdb" | "netflix" | "instagram" | "facebook" | "x" | "letterboxd" | "tiktok" | "reddit" | "rottentomatoes" | "generic";
  source_url: string | null;
  canonical_url: string | null;
  platform_label: string | null;
  status: "backlog" | "scheduled" | "watching" | "done" | "dropped";
  runtime_minutes: number | null;
  release_year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  tags: string[];
  mood_tags: string[];
  notes: string | null;
  metadata: BookmarkMetadata;
  last_shown_at: string | null;
  shown_count: number;
  created_at: string;
  updated_at: string;
  // Personal rating & review
  user_rating?: number | null;     // 1–5 stars
  user_review?: string | null;
  // Watch tracking
  watched_at?: string | null;      // ISO date first marked as done
  // Sharing
  is_public?: boolean;
  share_token?: string;
  // Privacy vault
  is_vaulted?: boolean;
  // Queue engine (Phase 2)
  priority?: number;               // float — higher value = sooner in queue (default 100)
  queue_status?: "queued" | "up_next" | "in_progress" | "completed";
  progress_percent?: number;       // 0–100 watch progress
  availability?: BookmarkAvailability | null;
  enriched?: boolean;
  enriched_at?: string | null;
  enrich_fail_reason?: string | null;
  tmdb?: TmdbEnrichment | null;
  // ── Memory + retrieval layer ──
  context?: BookmarkContext;
  auto_tags?: string[];
  embedding_ref?: string | null;
  fingerprint?: BookmarkFingerprint | null;
  canonical_entity?: CanonicalEntity | null;
  cluster_id?: string | null;
  last_viewed_at?: string | null;
  view_count?: number;
  importance_score?: number;
  pending_cluster_assignment?: boolean;
  pipeline_version?: number;
}

export interface BookmarkContext {
  note?: string | null;
  reason?: string | null;
  mood?: string | null;
  inferred_tags?: string[];
  domain_type?: "video" | "article" | "social" | "product" | "media" | "other";
}

export interface BookmarkFingerprint {
  text_embedding_id: string;
  image_embedding_id?: string | null;
  extracted_keywords: string[];
  platform: string;
}

export type CanonicalEntitySource = "tmdb" | "imdb" | "youtube" | "spotify" | "unresolved";
export type CanonicalEntityType =
  | "movie" | "tv" | "anime" | "music" | "clip" | "meme" | "article" | "unknown";

export interface CanonicalEntity {
  source: CanonicalEntitySource;
  id: string;
  type: CanonicalEntityType;
  title: string;
  year?: number | null;
  genres?: string[];
  runtime?: number | null;
  poster?: string | null;
  confidence: number;
  matched_at: string;
  suggested?: boolean;
}

export interface BookmarkCluster {
  id: string;
  name: string;
  centroid_ref: string;
  centroid_embedding?: number[];
  member_count: number;
  last_updated: string;
  emerging_trend?: boolean;
  top_titles?: string[];
}

export interface ResurfaceEvent {
  id: string;
  bookmark_id: string;
  reason: "forgotten_high_value" | "cluster_dormant" | "similar_to_recent";
  surfaced_at: string;
  dismissed_at?: string | null;
  opened_at?: string | null;
}

export interface EntityCacheEntry {
  url_hash: string;
  canonical_entity: CanonicalEntity;
  cached_at: string;
}

export interface AnalyticsDaily {
  date: string;
  counters: Record<string, number>;
}

export interface Attachment {
  id: string;
  user_id: string;
  bookmark_id: string;
  file_url: string;
  file_type: string;
  file_name: string;
  size: number | null;
  created_at: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  bookmark_id: string;
  scheduled_for: string;
  reminder_offset_minutes: number;
  recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly';
  state: "scheduled" | "fired" | "snoozed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  bookmark_id: string | null;
  schedule_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface WatchPlan {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  preferred_days: number[];
  time_windows: { start: string; end: string }[];
  max_runtime_minutes: number | null;
  mood_tags: string[];
  platforms_allowed: string[];
  auto_suggest: boolean;
  created_at: string;
  updated_at: string;
}

export interface WatchPlanBookmark {
  plan_id: string;
  bookmark_id: string;
  user_id: string;
  position: number;
}

export interface EnrichmentResult {
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  runtime_minutes: number | null;
  release_year: number | null;
  type: Bookmark["type"];
  provider: Bookmark["provider"];
  canonical_url: string | null;
  platform_label: string | null;
  metadata: Record<string, unknown>;
}

export interface PublicProfile {
  uid: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  bookmarks_count?: number;
}

export interface PrivatePreferences {
  fcm_token?: string | null;
  push_enabled?: boolean;
  email_reminders_enabled?: boolean;
}

export interface UserFollow {
  follower_uid: string;
  following_uid: string;
  created_at: string;
}

export interface FeedItem {
  id: string;
  actor_uid: string;
  action: 'added' | 'done' | 'shared';
  bookmark_id: string | null;
  created_at: string;
}

