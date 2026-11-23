import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { removeDatapoint } from "./ai/vectorIndex";

export const onBookmarkDeleted = onDocumentDeleted({
  document: "users/{uid}/bookmarks/{bookmarkId}", retry: true, timeoutSeconds: 120,
}, async event => {
  const { uid, bookmarkId } = event.params;
  const db = getFirestore();
  const deleted = event.data?.data();
  if (!deleted) return;
  const token = deleted.schemaVersion === 2 ? deleted.visibility?.shareToken : deleted.share_token;
  // Never delete a new public projection if the same deterministic ID was saved again.
  if (typeof token === "string") {
    await db.runTransaction(async tx => {
      const current = await tx.get(db.doc(`users/${uid}/bookmarks/${bookmarkId}`));
      const value = current.data();
      const currentToken = value?.schemaVersion === 2 ? value.visibility?.shareToken : value?.share_token;
      if (currentToken === token) return;
      tx.delete(db.doc(`publicBookmarks/${token}`));
      tx.delete(db.doc(`publicBookmarkOwners/${token}`));
    });
  }
  // A recreated bookmark owns its new attachments and index entry.
  if ((await db.doc(`users/${uid}/bookmarks/${bookmarkId}`).get()).exists) return;
  for (const name of ["attachments", "schedules", "notifications", "watch_plan_items"]) {
    const col = db.collection(`users/${uid}/${name}`);
    for (;;) {
      const page = await col.where("bookmark_id", "==", bookmarkId).limit(200).get();
      if (page.empty) break;
      if (name === "attachments") {
        for (const doc of page.docs) {
          const path = doc.get("storage_path");
          if (typeof path === "string" && path.startsWith(`attachments/${uid}/${bookmarkId}/`)) {
            await getStorage().bucket().file(path).delete({ ignoreNotFound: true });
          }
        }
      }
      const batch = db.batch();
      page.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }
  await removeDatapoint(`${uid}:${bookmarkId}`);
});
