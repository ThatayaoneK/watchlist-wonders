/** Stable React Query keys. Keep cache identity changes in one place. */
export const queryKeys = {
  bookmarks: {
    all: ["bookmarks"] as const,
    pages: (pageSize: number) => ["bookmarks", "pages", pageSize] as const,
    detail: (id: string) => ["bookmarks", "detail", id] as const,
    duplicate: (tmdbId: number | null) => ["bookmarks", "duplicate", tmdbId] as const,
  },
  tonight: {
    candidates: ["tonight", "candidates"] as const,
  },
  profile: {
    current: ["profile", "current"] as const,
  },
} as const;
