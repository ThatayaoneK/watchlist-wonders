import { randomUUID } from "node:crypto";
import { getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

const sharingRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), bookmarkId: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal("revoke"), bookmarkId: z.string().min(1).max(128) }).strict(),
]);

const listRequestSchema = z.object({ uid: z.string().min(1).max(128), limit: z.number().int().min(1).max(50).optional() }).strict();

export interface PublicBookmarkProjection {
  schemaVersion: 1;
  ownerDisplayName: string | null;
  title: string;
  mediaType: "movie" | "series" | "video" | "other";
  posterUrl: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  canonicalUrl: string | null;
  createdAt: Timestamp;
}

function optionalBoundedString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function safePublicUrl(value: unknown): string | null {
  const candidate = optionalBoundedString(value, 2048);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function mediaType(value: unknown): PublicBookmarkProjection["mediaType"] {
  if (value === "movie" || value === "series" || value === "video") return value;
  return "other";
}

function publicCreatedAt(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  if (typeof value === "string") {
    const millis = Date.parse(value);
    if (Number.isFinite(millis)) return Timestamp.fromMillis(millis);
  }
  return Timestamp.now();
}

export function buildPublicBookmarkProjection(
  bookmark: DocumentData,
  ownerDisplayName: unknown,
): PublicBookmarkProjection {
  const media = bookmark.media && typeof bookmark.media === "object" && !Array.isArray(bookmark.media)
    ? bookmark.media as Record<string, unknown>
    : {};
  const source = bookmark.source && typeof bookmark.source === "object" && !Array.isArray(bookmark.source)
    ? bookmark.source as Record<string, unknown>
    : {};
  const isV2 = bookmark.schemaVersion === 2;
  const titleValue = isV2 ? media.title : bookmark.title;
  const title = typeof titleValue === "string" ? titleValue.trim().slice(0, 300) : "";
  if (!title) throw new HttpsError("failed-precondition", "Bookmark has no publishable title.");
  return {
    schemaVersion: 1,
    ownerDisplayName: optionalBoundedString(ownerDisplayName, 80),
    title,
    mediaType: mediaType(isV2 ? media.type : bookmark.type),
    posterUrl: safePublicUrl(isV2 ? media.posterUrl : bookmark.poster_url),
    releaseYear: Number.isInteger(isV2 ? media.releaseYear : bookmark.release_year) ? Number(isV2 ? media.releaseYear : bookmark.release_year) : null,
    runtimeMinutes: Number.isInteger(isV2 ? media.runtimeMinutes : bookmark.runtime_minutes) ? Number(isV2 ? media.runtimeMinutes : bookmark.runtime_minutes) : null,
    canonicalUrl: safePublicUrl(isV2 ? source.canonicalUrl : bookmark.canonical_url),
    createdAt: publicCreatedAt(isV2 ? bookmark.createdAt : bookmark.created_at),
  };
}

export const setBookmarkSharing = onCall(
  { enforceAppCheck: false },
  async (request): Promise<{ shareToken: string | null }> => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
    const parsed = sharingRequestSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid sharing request.");

    const uid = request.auth.uid;
    const db = getFirestore();
    const bookmarkRef = db.doc(`users/${uid}/bookmarks/${parsed.data.bookmarkId}`);
    const profileRef = db.doc(`users/${uid}/profile/public`);

    return db.runTransaction(async (transaction) => {
      const bookmarkSnap = await transaction.get(bookmarkRef);
      if (!bookmarkSnap.exists) throw new HttpsError("not-found", "Bookmark not found.");
      const bookmark = bookmarkSnap.data() ?? {};
      const visibility = bookmark.visibility && typeof bookmark.visibility === "object" && !Array.isArray(bookmark.visibility)
        ? bookmark.visibility as Record<string, unknown>
        : {};
      const isV2 = bookmark.schemaVersion === 2;
      const existingTokenValue = isV2 ? visibility.shareToken : bookmark.share_token;
      const existingToken = typeof existingTokenValue === "string" ? existingTokenValue : null;

      if (parsed.data.action === "revoke") {
        if (existingToken) {
          transaction.delete(db.doc(`publicBookmarks/${existingToken}`));
          transaction.delete(db.doc(`publicBookmarkOwners/${existingToken}`));
        }
        transaction.update(bookmarkRef, isV2
          ? { "visibility.isPublic": false, "visibility.shareToken": null, updatedAt: Timestamp.now() }
          : { is_public: false, share_token: null, updated_at: new Date().toISOString() });
        return { shareToken: null };
      }

      if ((isV2 ? visibility.isVaulted : bookmark.is_vaulted) === true) {
        throw new HttpsError("failed-precondition", "Vaulted bookmarks cannot be shared.");
      }
      const profileSnap = await transaction.get(profileRef);
      const token = existingToken ?? randomUUID();
      const projection = buildPublicBookmarkProjection(bookmark, profileSnap.data()?.display_name);
      transaction.set(db.doc(`publicBookmarks/${token}`), projection);
      transaction.set(db.doc(`publicBookmarkOwners/${token}`), { uid, bookmarkId: parsed.data.bookmarkId });
      transaction.update(bookmarkRef, isV2
        ? { "visibility.isPublic": true, "visibility.shareToken": token, updatedAt: Timestamp.now() }
        : { is_public: true, share_token: token, updated_at: new Date().toISOString() });
      return { shareToken: token };
    });
  },
);

export const listPublicBookmarks = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const parsed = listRequestSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid public profile request.");
    const db = getFirestore();
    const [profileSnap, legacySnap, v2Snap] = await Promise.all([
      db.doc(`users/${parsed.data.uid}/profile/public`).get(),
      db.collection(`users/${parsed.data.uid}/bookmarks`)
        .where("is_public", "==", true)
        .limit(parsed.data.limit ?? 50)
        .get(),
      db.collection(`users/${parsed.data.uid}/bookmarks`)
        .where("visibility.isPublic", "==", true)
        .limit(parsed.data.limit ?? 50)
        .get(),
    ]);
    const ownerDisplayName = profileSnap.data()?.display_name;
    return {
      bookmarks: [...legacySnap.docs, ...v2Snap.docs].slice(0, parsed.data.limit ?? 50).flatMap((snapshot) => {
        try {
          const data = snapshot.data();
          const visibility = data.visibility && typeof data.visibility === "object" && !Array.isArray(data.visibility)
            ? data.visibility as Record<string, unknown>
            : {};
          const tokenValue = data.schemaVersion === 2 ? visibility.shareToken : data.share_token;
          const token = typeof tokenValue === "string" ? tokenValue : null;
          if (!token) return [];
          return [{ shareToken: token, ...buildPublicBookmarkProjection(data, ownerDisplayName) }];
        } catch {
          return [];
        }
      }),
    };
  },
);
