import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  runTransaction,
  getCountFromServer,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Bookmark } from '@/types/database';
import { semanticSearchBookmarks, selectResolutionCandidate, skipResolutionSelection, recordBookmarkView } from '@/services/functions';
import { buildLifecycleUpdate, deriveLifecycleState } from "@/engine/lifecycle";
import { normalizeBookmark } from '@/services/bookmarkNormalizer';
import {
  validateBookmarkCreateVisibility,
  validateBookmarkUpdateVisibility,
} from "@/services/bookmarkVisibility";
import type { EnrichmentMatchCandidate } from "@/lib/enrichmentSmartFill";
import { BookmarkV2Schema } from "@watchmarks/shared/bookmark";

export interface SemanticSearchResult {
  id: string;
  title: string;
  poster_url: string | null;
  type: string;
  provider: string;
  tags: string[];
  auto_tags: string[];
  canonical_entity: unknown;
  cluster_id: string | null;
  score: number;
  breakdown: { semantic: number; recency: number; engagement: number; importance: number };
  reason: string;
}

function getUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function bookmarksCol(uid: string) {
  return collection(db, 'users', uid, 'bookmarks');
}

function docToBookmark(snap: { id: string; data(): Record<string, unknown> }): Bookmark {
  return normalizeBookmark(snap.id, snap.data());
}

export interface BookmarkPageCursor {
  legacy?: QueryDocumentSnapshot;
  v2?: QueryDocumentSnapshot;
  legacyDone?: boolean;
  v2Done?: boolean;
}

function newestFirst(left: Bookmark, right: Bookmark): number {
  return Date.parse(right.created_at) - Date.parse(left.created_at);
}

function toTimestamp(value: string | null | undefined): Timestamp | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? Timestamp.fromDate(date) : null;
}

function toLibraryState(status: Bookmark["status"] | undefined): "saved" | "watching" | "watched" | "dropped" {
  if (status === "watching") return "watching";
  if (status === "done") return "watched";
  if (status === "dropped") return "dropped";
  return "saved";
}

function toV2MediaType(type: Bookmark["type"] | undefined) {
  return type === "doc" ? "documentary" as const : (type ?? "other");
}

const CLIENT_METADATA_FIELDS = new Set([
  "episodes_watched",
  "total_episodes",
  "trailer_url",
  "youtube_trailer_url",
  "watched_with",
  "lifecycle_state",
  "lifecycle_updated_at",
]);

function clientOwnedMetadata(metadata: Bookmark["metadata"] | undefined): Bookmark["metadata"] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => CLIENT_METADATA_FIELDS.has(key)),
  );
}

export const bookmarkService = {
  /**
   * Get bookmarks for the current user, capped at safetyLimit to avoid
   * unbounded reads. Use getBookmarksPage() for cursor-based pagination.
   */
  async getBookmarks(safetyLimit = 500): Promise<Bookmark[]> {
    const uid = getUid();
    try {
      const [legacySnap, v2Snap] = await Promise.all([
        getDocs(query(bookmarksCol(uid), orderBy('created_at', 'desc'), limit(safetyLimit))),
        getDocs(query(bookmarksCol(uid), orderBy('createdAt', 'desc'), limit(safetyLimit))),
      ]);
      return [...legacySnap.docs, ...v2Snap.docs]
        .map(docToBookmark)
        .sort(newestFirst)
        .slice(0, safetyLimit);
    } catch (error) {
      console.error('[bookmarkService] getBookmarks failed', error);
      throw error;
    }
  },

  /**
   * Lightweight count of vaulted bookmarks for the current user. Avoids
   * downloading the full bookmark list when only the badge total is needed.
   */
  async getVaultedCount(): Promise<number> {
    const uid = getUid();
    const [legacy, v2] = await Promise.all([
      getCountFromServer(query(bookmarksCol(uid), where('is_vaulted', '==', true))),
      getCountFromServer(query(bookmarksCol(uid), where('visibility.isVaulted', '==', true))),
    ]);
    return legacy.data().count + v2.data().count;
  },

  /**
   * Cursor-based paginated fetch. Returns bookmarks and an opaque cursor
   * for the next page (undefined when the last page has been reached).
   */
  async getBookmarksPage(
    pageSize = 50,
    cursor?: BookmarkPageCursor,
  ): Promise<{ bookmarks: Bookmark[]; nextCursor?: BookmarkPageCursor }> {
    const uid = getUid();
    try {
      // Split each page between schemas. Fetching a full page from both and
      // advancing both cursors discarded half of the merged documents.
      const activeLegacy = !cursor?.legacyDone;
      const activeV2 = !cursor?.v2Done;
      const legacyLimit = activeLegacy ? (activeV2 ? Math.ceil(pageSize / 2) : pageSize) : 1;
      const v2Limit = activeV2 ? (activeLegacy ? Math.max(1, Math.floor(pageSize / 2)) : pageSize) : 1;
      const legacyConstraints = cursor?.legacy
        ? [orderBy('created_at', 'desc'), limit(legacyLimit), startAfter(cursor.legacy)]
        : [orderBy('created_at', 'desc'), limit(legacyLimit)];
      const v2Constraints = cursor?.v2
        ? [orderBy('createdAt', 'desc'), limit(v2Limit), startAfter(cursor.v2)]
        : [orderBy('createdAt', 'desc'), limit(v2Limit)];
      const [legacySnap, v2Snap] = await Promise.all([
        activeLegacy ? getDocs(query(bookmarksCol(uid), ...legacyConstraints)) : Promise.resolve(null),
        activeV2 ? getDocs(query(bookmarksCol(uid), ...v2Constraints)) : Promise.resolve(null),
      ]);
      const legacyDocs = legacySnap?.docs ?? [];
      const v2Docs = v2Snap?.docs ?? [];
      const bookmarks = [...new Map(
        [...legacyDocs, ...v2Docs].map((snapshot) => [snapshot.id, docToBookmark(snapshot)]),
      ).values()].sort(newestFirst);
      const legacyDone = !activeLegacy || legacyDocs.length < legacyLimit;
      const v2Done = !activeV2 || v2Docs.length < v2Limit;
      const hasMore = !legacyDone || !v2Done;
      const nextCursor = hasMore
        ? {
            legacy: (legacyDocs.at(-1) as QueryDocumentSnapshot | undefined) ?? cursor?.legacy,
            v2: (v2Docs.at(-1) as QueryDocumentSnapshot | undefined) ?? cursor?.v2,
            legacyDone,
            v2Done,
          }
        : undefined;
      return { bookmarks, nextCursor };
    } catch (error) {
      console.error('[bookmarkService] getBookmarksPage failed', error);
      throw error;
    }
  },

  /** Explicit bulk export path; regular screens must use getBookmarksPage. */
  async getAllBookmarksPaginated(pageSize = 100): Promise<Bookmark[]> {
    const bookmarks: Bookmark[] = [];
    let cursor: BookmarkPageCursor | undefined;
    do {
      const page = await this.getBookmarksPage(pageSize, cursor);
      bookmarks.push(...page.bookmarks);
      cursor = page.nextCursor;
    } while (cursor);
    return [...new Map(bookmarks.map((bookmark) => [bookmark.id, bookmark])).values()].sort(newestFirst);
  },

  async findDuplicateByTmdbId(tmdbId: number, mediaType: "movie" | "tv"): Promise<Bookmark | null> {
    const collectionRef = bookmarksCol(getUid());
    const snapshots = await Promise.all([
      getDocs(query(collectionRef, where("metadata.tmdb_id", "==", tmdbId), where("type", "==", mediaType === "tv" ? "series" : "movie"), limit(1))),
      getDocs(query(collectionRef, where("metadata.tmdbId", "==", tmdbId), where("type", "==", mediaType === "tv" ? "series" : "movie"), limit(1))),
      getDocs(query(collectionRef, where("resolution.externalId", "==", String(tmdbId)), where("resolution.provider", "==", "tmdb"), where("media.type", "==", mediaType === "tv" ? "series" : "movie"), limit(1))),
    ]);
    const match = snapshots.flatMap((snapshot) => snapshot.docs).at(0);
    return match ? docToBookmark(match) : null;
  },

  /**
   * Get bookmarks by status
   */
  async getBookmarksByStatus(status: Bookmark['status']): Promise<Bookmark[]> {
    const uid = getUid();
    try {
      const [legacySnap, v2Snap] = await Promise.all([
        getDocs(query(bookmarksCol(uid), where('status', '==', status), orderBy('created_at', 'desc'))),
        getDocs(query(
          bookmarksCol(uid),
          where('library.state', '==', toLibraryState(status)),
          orderBy('createdAt', 'desc'),
        )),
      ]);
      return [...legacySnap.docs, ...v2Snap.docs]
        .map(docToBookmark)
        .filter((bookmark) => bookmark.status === status)
        .sort(newestFirst);
    } catch (error) {
      console.error('[bookmarkService] getBookmarksByStatus failed', { status, error });
      throw error;
    }
  },

  /**
   * Get a single bookmark by ID
   */
  async getBookmark(id: string): Promise<Bookmark> {
    const uid = getUid();
    const snap = await getDoc(doc(db, 'users', uid, 'bookmarks', id));
    if (!snap.exists()) throw new Error('Bookmark not found');
    return docToBookmark(snap);
  },

  /**
   * Create a new bookmark
   */
  async createBookmark(bookmark: Partial<Bookmark> & { title: string }): Promise<Bookmark> {
    const uid = getUid();
    const now = new Date().toISOString();
    const baseMetadata = clientOwnedMetadata(bookmark.metadata);
    const initialStatus = bookmark.status || "backlog";
    const initialQueueStatus = bookmark.queue_status ?? "queued";
    validateBookmarkCreateVisibility({
      is_vaulted: bookmark.is_vaulted,
      is_public: bookmark.is_public,
    });
    const lifecycleSeed = deriveLifecycleState({
      id: bookmark.id ?? "pending-create",
      user_id: uid,
      title: bookmark.title,
      type: bookmark.type || "movie",
      provider: bookmark.provider || "generic",
      source_url: bookmark.source_url ?? null,
      canonical_url: bookmark.canonical_url ?? null,
      platform_label: bookmark.platform_label ?? null,
      status: initialStatus,
      runtime_minutes: bookmark.runtime_minutes ?? null,
      release_year: bookmark.release_year ?? null,
      poster_url: bookmark.poster_url ?? null,
      backdrop_url: bookmark.backdrop_url ?? null,
      tags: bookmark.tags || [],
      mood_tags: bookmark.mood_tags || [],
      notes: bookmark.notes ?? null,
      metadata: baseMetadata,
      last_shown_at: null,
      shown_count: 0,
      created_at: now,
      updated_at: now,
      is_public: false,
      is_vaulted: bookmark.is_vaulted ?? false,
      priority: bookmark.priority ?? 100,
      queue_status: initialQueueStatus,
      progress_percent: bookmark.progress_percent ?? 0,
    });
    const capturedAt = Timestamp.fromDate(new Date(now));
    const data = {
      schemaVersion: 2 as const,
      ownerId: uid,
      source: {
        originalUrl: bookmark.source_url ?? null,
        canonicalUrl: bookmark.canonical_url ?? null,
        platform: bookmark.provider ?? "generic",
        rawTitle: bookmark.title,
        capturedAt,
        captureId: null,
      },
      media: {
        type: toV2MediaType(bookmark.type),
        title: bookmark.title,
        posterUrl: bookmark.poster_url ?? null,
        backdropUrl: bookmark.backdrop_url ?? null,
        releaseYear: bookmark.release_year ?? null,
        runtimeMinutes: bookmark.runtime_minutes ?? null,
      },
      resolution: {
        status: "pending" as const,
        provider: null,
        externalId: null,
        confidence: null,
        version: 1,
      },
      library: {
        state: toLibraryState(initialStatus),
        scheduledAt: null,
        progressPercent: bookmark.progress_percent ?? 0,
        priority: bookmark.priority ?? 100,
        queueState: initialQueueStatus,
        tags: bookmark.tags ?? [],
        moodTags: bookmark.mood_tags ?? [],
        notes: bookmark.notes ?? null,
        rating: bookmark.user_rating ?? null,
        review: bookmark.user_review ?? null,
        watchedAt: toTimestamp(bookmark.watched_at),
        lastShownAt: null,
        shownCount: 0,
        episodesWatched: typeof baseMetadata.episodes_watched === "number" ? baseMetadata.episodes_watched : null,
        totalEpisodes: typeof baseMetadata.total_episodes === "number" ? baseMetadata.total_episodes : null,
        trailerUrl: typeof baseMetadata.trailer_url === "string" ? baseMetadata.trailer_url : null,
        watchedWith: typeof baseMetadata.watched_with === "string" ? baseMetadata.watched_with : null,
      },
      visibility: { isPublic: false, isVaulted: bookmark.is_vaulted ?? false, shareToken: null },
      availability: null,
      intelligence: {
        autoTags: [], embeddingRef: null, fingerprint: null, clusterId: null,
        importanceScore: null, pendingClusterAssignment: false, pipelineVersion: 0,
        lastViewedAt: null, viewCount: 0,
      },
      createdAt: capturedAt,
      updatedAt: capturedAt,
    };
    const validated = BookmarkV2Schema.parse(data);
    const ref = await addDoc(bookmarksCol(uid), validated);
    void lifecycleSeed;
    return normalizeBookmark(ref.id, validated);
  },

  /**
   * Update an existing bookmark
   */
  async updateBookmark(id: string, updates: Partial<Bookmark>): Promise<Bookmark> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'bookmarks', id);
    const currentSnap = await getDoc(ref);
    if (!currentSnap.exists()) throw new Error('Bookmark not found');
    const isV2 = currentSnap.data().schemaVersion === 2;
    const { metadata, ...restUpdates } = updates;

    const allowedUpdateFields = new Set<string>([
      'title', 'status', 'tags', 'mood_tags', 'notes',
      'last_shown_at', 'shown_count', 'user_rating', 'user_review',
      'watched_at', 'is_vaulted', 'priority',
      'queue_status', 'progress_percent',
    ]);

    const filteredUpdates = Object.entries(restUpdates)
      .filter(([key, value]) => allowedUpdateFields.has(key) && value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    const nextUpdates: UpdateData<DocumentData> = isV2
      ? { updatedAt: Timestamp.now() }
      : { ...filteredUpdates, updated_at: new Date().toISOString() };
    if (isV2) {
      const v2Paths: Record<string, string> = {
        title: 'media.title', status: 'library.state', tags: 'library.tags', mood_tags: 'library.moodTags',
        notes: 'library.notes', last_shown_at: 'library.lastShownAt', shown_count: 'library.shownCount',
        user_rating: 'library.rating', user_review: 'library.review', watched_at: 'library.watchedAt',
        is_vaulted: 'visibility.isVaulted', priority: 'library.priority', queue_status: 'library.queueState',
        progress_percent: 'library.progressPercent',
      };
      for (const [key, value] of Object.entries(filteredUpdates)) {
        const path = v2Paths[key];
        if (!path) continue;
        nextUpdates[path] = key === 'status'
          ? toLibraryState(value as Bookmark['status'])
          : key === 'watched_at' || key === 'last_shown_at'
            ? toTimestamp(value as string | null)
            : value;
      }
    }
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const owned = clientOwnedMetadata(metadata);
      if (isV2) {
        const metadataPaths: Record<string, string> = {
          episodes_watched: 'library.episodesWatched', total_episodes: 'library.totalEpisodes',
          trailer_url: 'library.trailerUrl', youtube_trailer_url: 'library.trailerUrl',
          watched_with: 'library.watchedWith',
        };
        for (const [key, value] of Object.entries(owned)) {
          if (metadataPaths[key] && value !== undefined) nextUpdates[metadataPaths[key]] = value;
        }
      } else {
        for (const [key, value] of Object.entries(owned)) {
          nextUpdates[`metadata.${key}`] = value;
        }
      }
    }

    const needsVisibilityCheck = updates.is_vaulted !== undefined;

    if (needsVisibilityCheck) {
      // Read + validate + write atomically so concurrent edits can't slip an
      // invalid visibility state (e.g. is_vaulted=true AND is_public=true) past
      // the check between the getDoc and updateDoc calls.
      await runTransaction(db, async (transaction) => {
        const transactionSnap = await transaction.get(ref);
        if (!transactionSnap.exists()) throw new Error('Bookmark not found');
        const currentData = normalizeBookmark(transactionSnap.id, transactionSnap.data());
        validateBookmarkUpdateVisibility(
          { is_vaulted: currentData.is_vaulted, is_public: currentData.is_public },
          { is_vaulted: updates.is_vaulted },
        );
        transaction.update(ref, nextUpdates);
      });
    } else {
      await updateDoc(ref, nextUpdates);
    }

    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Bookmark not found after update');
    return docToBookmark(snap);
  },

  async selectResolutionCandidate(
    id: string,
    candidate: EnrichmentMatchCandidate,
  ): Promise<Bookmark> {
    await selectResolutionCandidate(id, 'selected', candidate);
    return this.getBookmark(id);
  },

  async skipResolutionSelection(id: string): Promise<void> {
    await skipResolutionSelection(id);
  },

  /**
   * Delete a bookmark
   */
  async deleteBookmark(id: string): Promise<void> {
    const uid = getUid();
    await deleteDoc(doc(db, 'users', uid, 'bookmarks', id));
  },

  /**
   * Update bookmark status, setting watched_at when first marked done
   */
  async updateStatus(id: string, status: Bookmark['status']): Promise<Bookmark> {
    const current = await this.getBookmark(id);
    const updates = buildLifecycleUpdate(current, status, new Date());
    return this.updateBookmark(id, updates);
  },

  /**
   * Rate a bookmark (1–5 stars) with optional personal review
   */
  async rateBookmark(id: string, rating: number | null, review?: string | null): Promise<Bookmark> {
    // Validate rating: must be null or an integer between 1 and 5
    if (rating !== null) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Rating must be null or an integer between 1 and 5');
      }
    }
    return this.updateBookmark(id, {
      user_rating: rating,
      ...(review !== undefined ? { user_review: review } : {}),
    });
  },

  /**
   * Search bookmarks by title or notes (client-side filtering — legacy fallback)
   */
  async searchBookmarks(queryStr: string): Promise<Bookmark[]> {
    const bookmarks = await this.getBookmarks();
    const lower = queryStr.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(lower) ||
        (b.notes && b.notes.toLowerCase().includes(lower)),
    );
  },

  /**
   * Semantic + ranked search via Cloud Function. Falls back to client-side
   * keyword filter when the callable is unavailable (offline, missing config).
   */
  async semanticSearch(
    queryStr: string,
    opts?: { topK?: number; mode?: 'auto' | 'semantic' | 'keyword' | 'temporal' | 'context' },
  ): Promise<SemanticSearchResult[]> {
    try {
      const result = await semanticSearchBookmarks(queryStr, {
        topK: opts?.topK ?? 20,
        mode: opts?.mode ?? 'auto',
      });
      return result.results ?? [];
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[bookmarkService] semanticSearch fallback to client filter', err);
      }
      const bookmarks = await this.searchBookmarks(queryStr);
      return bookmarks.slice(0, opts?.topK ?? 20).map((b) => ({
        id: b.id,
        title: b.title,
        poster_url: b.poster_url ?? null,
        type: b.type,
        provider: b.provider,
        tags: b.tags ?? [],
        auto_tags: (b as Bookmark & { auto_tags?: string[] }).auto_tags ?? [],
        canonical_entity: (b as Bookmark & { canonical_entity?: unknown }).canonical_entity ?? null,
        cluster_id: (b as Bookmark & { cluster_id?: string | null }).cluster_id ?? null,
        score: 0,
        breakdown: { semantic: 0, recency: 0, engagement: 0, importance: 0 },
        reason: 'fallback_keyword',
      }));
    }
  },

  /**
   * Record that the current user opened this bookmark. Cheap fire-and-forget
   * for view-count + last_viewed_at tracking that feeds importance scoring.
   */
  async recordView(bookmarkId: string): Promise<void> {
    try {
      await recordBookmarkView(bookmarkId);
    } catch (err) {
      // Non-fatal — view tracking must never break the UI.
      if (import.meta.env.DEV) console.warn('[bookmarkService] recordView failed', err);
    }
  },

  /**
   * Get backlog items for Tonight Pick (runtime <= 90 minutes or unknown).
   * Capped at 200 server-side; null-runtime items can't be excluded by Firestore
   * so client-side filtering is intentional here.
   */
  async getTonightCandidates(): Promise<Bookmark[]> {
    const uid = getUid();
    const [legacy, v2] = await Promise.all([
      getDocs(query(bookmarksCol(uid), where('status', '==', 'backlog'), limit(100))),
      getDocs(query(bookmarksCol(uid), where('library.state', '==', 'saved'), limit(100))),
    ]);
    const bookmarks = [...new Map(
      [...legacy.docs, ...v2.docs].map((snapshot) => [snapshot.id, docToBookmark(snapshot)]),
    ).values()];
    return bookmarks
      .filter((b) => b.runtime_minutes === null || b.runtime_minutes <= 90)
      .sort((a, b) => (a.shown_count || 0) - (b.shown_count || 0))
      .slice(0, 20);
  },

  /**
   * Update shown tracking for Tonight Pick
   */
  async markAsShown(id: string): Promise<void> {
    const uid = getUid();
    const ref = doc(db, 'users', uid, 'bookmarks', id);
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      tx.update(ref, snap.data().schemaVersion === 2
        ? { "library.lastShownAt": Timestamp.now(), "library.shownCount": increment(1), updatedAt: Timestamp.now() }
        : { last_shown_at: new Date().toISOString(), shown_count: increment(1) });
    });
  },

  /**
   * Get bookmarks grouped by mood tags
   */
  async getBookmarksByMood(): Promise<Record<string, Bookmark[]>> {
    const bookmarks = await this.getBookmarks();
    const byMood: Record<string, Bookmark[]> = {};
    bookmarks.forEach((bookmark) => {
      (bookmark.mood_tags || []).forEach((mood) => {
        if (!byMood[mood]) byMood[mood] = [];
        byMood[mood].push(bookmark);
      });
    });
    return byMood;
  },

  /**
   * Get statistics about user's bookmarks
   */
  async getStats() {
    const bookmarks = await this.getBookmarks();
    return {
      total: bookmarks.length,
      backlog: bookmarks.filter((b) => b.status === 'backlog').length,
      watching: bookmarks.filter((b) => b.status === 'watching').length,
      done: bookmarks.filter((b) => b.status === 'done').length,
      dropped: bookmarks.filter((b) => b.status === 'dropped').length,
      totalWatchedMinutes: bookmarks
        .filter((b) => b.status === 'done' && b.runtime_minutes)
        .reduce((sum, b) => sum + (b.runtime_minutes || 0), 0),
    };
  },
};


