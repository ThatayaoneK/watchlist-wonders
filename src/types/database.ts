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
  metadata: Record<string, unknown>;
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
  push_enabled?: boolean;
  bookmarks_count?: number;
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
