/**
 * Feature flags — MVP focus mode.
 *
 * Core product loop: Capture → Recall → Act
 * Customer problem: "I see something I want to watch, I lose it, I can't find it later."
 *
 * Features set to `false` are intentionally dimmed down so we can ship a tight,
 * focused product. Re-enable them individually when the time is right.
 */
export const FEATURES = {
  // ─── Core (always on) ────────────────────────────────────────────────────────
  /** Quick-add bar, URL enrichment, new bookmark page */
  capture: true,
  /** Dashboard, search, mood/status filtering, bookmark detail */
  recall: true,
  /** Watch provider detection, clear CTAs */
  act: true,
  /** "What do you feel like tonight?" intent-first entry */
  tonightPick: true,

  // ─── Dimmed down (non-MVP) ───────────────────────────────────────────────────
  /** Public profiles, follow/unfollow, social graph, share links */
  socialFeatures: false,
  /** Calendar view, recurring schedules, email reminders */
  scheduling: false,
  /** Watch plans ("Friday Night Movies", plan-based recommendations) */
  watchPlans: false,
  /** Stats & analytics dashboard */
  stats: false,
  /** Activity / audit trail */
  activityLog: false,
  /** Vault (private/hidden bookmarks) */
  vault: false,
  /** Bookmark import */
  importBookmarks: false,
  /** Real-time notification system */
  notifications: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;
