import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";

export function captureBookmarkId(input: {
  url: string | null;
  title: string | null;
  tmdbId?: number;
  mediaType?: string;
}): string {
  if (input.tmdbId && (input.mediaType === "movie" || input.mediaType === "tv")) {
    return `tmdb_${input.mediaType}_${input.tmdbId}`;
  }
  const basis = input.url ?? input.title?.trim().toLowerCase() ?? "unresolved";
  return `capture_${createHash("sha256").update(basis).digest("hex").slice(0, 28)}`;
}

export async function findExistingBookmark(uid: string, url: string | null, tmdbId?: number, mediaType?: string) {
  const bookmarks = getFirestore().collection("users").doc(uid).collection("bookmarks");
  if (url) {
    const [v2, legacy] = await Promise.all([
      bookmarks.where("source.originalUrl", "==", url).limit(1).get(),
      bookmarks.where("source_url", "==", url).limit(1).get(),
    ]);
    if (v2.docs[0]) return v2.docs[0].id;
    if (legacy.docs[0]) return legacy.docs[0].id;
  }
  if (tmdbId && (mediaType === "movie" || mediaType === "tv")) {
    const [v2, legacy] = await Promise.all([
      bookmarks.where("resolution.externalId", "==", String(tmdbId)).where("resolution.provider", "==", "tmdb").where("media.type", "==", mediaType === "tv" ? "series" : "movie").limit(1).get(),
      bookmarks.where("metadata.tmdb_id", "==", tmdbId).where("type", "==", mediaType === "tv" ? "series" : "movie").limit(1).get(),
    ]);
    if (v2.docs[0]) return v2.docs[0].id;
    if (legacy.docs[0]) return legacy.docs[0].id;
  }
  return null;
}

