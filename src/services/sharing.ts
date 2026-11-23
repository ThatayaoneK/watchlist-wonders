import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Bookmark } from "@/types/database";
import {
  listPublicBookmarks,
  setBookmarkSharing,
  type PublicBookmarkResult,
} from "@/services/functions";

function toIsoString(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") return (toDate.call(value) as Date).toISOString();
  }
  return typeof value === "string" ? value : new Date(0).toISOString();
}

function projectionToBookmark(projection: PublicBookmarkResult): Bookmark {
  return {
    id: projection.shareToken,
    user_id: "",
    title: projection.title,
    type: projection.mediaType,
    provider: "generic",
    source_url: projection.canonicalUrl,
    canonical_url: projection.canonicalUrl,
    platform_label: null,
    status: "backlog",
    runtime_minutes: projection.runtimeMinutes,
    release_year: projection.releaseYear,
    poster_url: projection.posterUrl,
    backdrop_url: null,
    tags: [],
    mood_tags: [],
    notes: null,
    metadata: {},
    last_shown_at: null,
    shown_count: 0,
    created_at: toIsoString(projection.createdAt),
    updated_at: toIsoString(projection.createdAt),
    is_public: true,
    is_vaulted: false,
    share_token: projection.shareToken,
  };
}

export const sharingService = {
  async makeBookmarkPublic(bookmarkId: string): Promise<string> {
    const result = await setBookmarkSharing(bookmarkId, "publish");
    if (!result.shareToken) throw new Error("Sharing did not return a token");
    return result.shareToken;
  },

  async makeBookmarkPrivate(bookmarkId: string): Promise<void> {
    await setBookmarkSharing(bookmarkId, "revoke");
  },

  async getPublicBookmarkByToken(token: string): Promise<(Bookmark & { owner_uid: string }) | null> {
    const snapshot = await getDoc(doc(db, "publicBookmarks", token));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as Omit<PublicBookmarkResult, "shareToken">;
    return { ...projectionToBookmark({ shareToken: token, ...data }), owner_uid: "" };
  },

  async getPublicBookmarksByUser(uid: string, limit = 50): Promise<Bookmark[]> {
    return (await listPublicBookmarks(uid, limit)).map(projectionToBookmark);
  },
};
