import { createHash, randomUUID } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { BookmarkV2Schema } from "@watchmarks/shared";
import { convertBookmarkToV2, legacyBookmarkHash } from "../bookmarkV2";

const RequestSchema = z.object({
  jobId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
  cursor: z.string().max(1500).nullable().optional(),
  batchSize: z.number().int().min(1).max(250).default(200),
  dryRun: z.boolean().default(true),
}).strict();

function documentKey(path: string): string {
  return createHash("sha256").update(path).digest("hex");
}

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(":", 1)[0].replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "unknown";
}

export interface MigrationBatchSummary {
  jobId: string;
  dryRun: boolean;
  scanned: number;
  migrated: number;
  alreadyV2: number;
  invalid: number;
  nextCursor: string | null;
  complete: boolean;
  invalidDocuments: Array<{ pathHash: string; errorCode: string }>;
}

export async function migrateBookmarkV2Batch(input: z.input<typeof RequestSchema>): Promise<MigrationBatchSummary> {
  const parsed = RequestSchema.parse(input);
  const db = getFirestore();
  const jobId = parsed.jobId ?? `bookmark-v2-${randomUUID()}`;
  let query = db.collectionGroup("bookmarks")
    .orderBy(FieldPath.documentId())
    .limit(parsed.batchSize);
  if (parsed.cursor) query = query.startAfter(parsed.cursor);
  const snapshot = await query.get();

  const summary: MigrationBatchSummary = {
    jobId,
    dryRun: parsed.dryRun,
    scanned: snapshot.size,
    migrated: 0,
    alreadyV2: 0,
    invalid: 0,
    nextCursor: snapshot.docs.at(-1)?.ref.path ?? null,
    complete: snapshot.size < parsed.batchSize,
    invalidDocuments: [],
  };
  const jobRef = db.collection("adminJobs").doc(jobId);

  for (const document of snapshot.docs) {
    const data = document.data();
    const ownerId = document.ref.parent.parent?.id;
    const key = documentKey(document.ref.path);
    const statusRef = jobRef.collection("documents").doc(key);

    if (!ownerId) {
      summary.invalid += 1;
      summary.invalidDocuments.push({ pathHash: key, errorCode: "missing_owner" });
      if (!parsed.dryRun) await statusRef.set({ status: "invalid", errorCode: "missing_owner", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }
    if (BookmarkV2Schema.safeParse(data).success) {
      summary.alreadyV2 += 1;
      if (!parsed.dryRun) await statusRef.set({ status: "already_v2", sourceHash: legacyBookmarkHash(data), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }

    try {
      const converted = convertBookmarkToV2(data, ownerId, Timestamp.now());
      if (parsed.dryRun) {
        summary.migrated += 1;
        continue;
      }

      const sourceHash = legacyBookmarkHash(data);
      const backupRef = db.collection("bookmarkMigrationBackups").doc(key);
      await db.runTransaction(async (transaction) => {
        const [current, backup] = await Promise.all([
          transaction.get(document.ref),
          transaction.get(backupRef),
        ]);
        if (!current.exists) throw new Error("source_deleted");
        const currentData = current.data() ?? {};
        if (BookmarkV2Schema.safeParse(currentData).success) return;
        if (legacyBookmarkHash(currentData) !== sourceHash) throw new Error("source_changed");
        if (!backup.exists) {
          transaction.create(backupRef, {
            sourcePath: document.ref.path,
            sourceHash,
            data: currentData,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        transaction.set(document.ref, converted);
        transaction.set(statusRef, {
          status: "migrated",
          sourceHash,
          migrationVersion: 2,
          retryCount: 0,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      summary.migrated += 1;
    } catch (error) {
      summary.invalid += 1;
      summary.invalidDocuments.push({ pathHash: key, errorCode: errorCode(error) });
      if (!parsed.dryRun) {
        const code = errorCode(error);
        const previous = await statusRef.get();
        const retryCount = typeof previous.data()?.retryCount === "number" ? previous.data()!.retryCount + 1 : 1;
        await statusRef.set({ status: "failed", errorCode: code, retryCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await db.collection("migrationDeadLetters").doc(key).set({
          jobId,
          sourcePathHash: key,
          errorCode: code,
          retryCount,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  }

  await jobRef.set({
    type: "bookmark_v2",
    dryRun: parsed.dryRun,
    checkpoint: summary.nextCursor,
    complete: summary.complete,
    lastBatch: summary,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return summary;
}

export const migrateBookmarksV2 = onRequest(
  { invoker: "private", timeoutSeconds: 540, memory: "1GiB" },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }
    const parsed = RequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid migration request" });
      return;
    }
    try {
      response.status(200).json(await migrateBookmarkV2Batch(parsed.data));
    } catch (error) {
      console.error("[migrateBookmarksV2] failed", { code: errorCode(error) });
      response.status(500).json({ error: "Migration batch failed" });
    }
  },
);
