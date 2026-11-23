import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { TmdbEnrichment } from "@/types/database";

export type BookmarkEnrichmentState =
  | { status: "loading" }
  | { status: "pending" }
  | { status: "enriched"; tmdb: TmdbEnrichment }
  | { status: "no_match"; reason: string | null }
  | { status: "error"; reason: string };

export function useBookmarkEnrichment(
  bookmarkId: string | null | undefined,
  userId?: string | null,
): BookmarkEnrichmentState {
  const [state, setState] = useState<BookmarkEnrichmentState>({ status: "loading" });
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const resolvedUserId = userId ?? currentUser?.uid ?? null;
    if (!bookmarkId || !resolvedUserId) {
      setState({ status: "loading" });
      return;
    }

    const ref = doc(db, "users", resolvedUserId, "bookmarks", bookmarkId);
    return onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ status: "no_match", reason: "missing_document" });
          return;
        }

        const data = snapshot.data();
        const tmdb = data.tmdb as TmdbEnrichment | null | undefined;
        const enriched = data.enriched === true;

        if (enriched && tmdb) {
          setState({ status: "enriched", tmdb });
          return;
        }

        if (enriched) {
          const reason =
            typeof data.enrich_fail_reason === "string"
              ? data.enrich_fail_reason
              : typeof data.enrichFailReason === "string"
                ? data.enrichFailReason
                : null;
          setState({ status: "no_match", reason });
          return;
        }

        setState({ status: "pending" });
      },
      (error) => {
        setState({ status: "error", reason: error.message });
      },
    );
  }, [bookmarkId, userId, currentUser?.uid]);

  return state;
}
