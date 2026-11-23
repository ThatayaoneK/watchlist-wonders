import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

const reportSchema = z.object({
  fingerprint: z.string().min(1).max(200),
  url: z.string().max(500).nullable().optional(),
  error: z.unknown(),
  context: z.record(z.unknown()).optional(),
}).strict();

const WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 10;
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|email)/i;

function redactText(value: string, maxLength: number): string {
  return value
    .replace(/([?&])[^=&#\s]+=[^&#\s]*/g, "$1[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .slice(0, maxLength);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (typeof value === "string") return redactText(value, 1000);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitizeValue(entry, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, entry]) => [key.slice(0, 100), SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeValue(entry, depth + 1)]),
    );
  }
  return redactText(String(value), 1000);
}

export const reportClientError = onCall(
  { enforceAppCheck: false },
  async (request): Promise<{ accepted: true }> => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
    const parsed = reportSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid error report.");
    if (!request.app) logger.warn("[reportClientError] missing App Check token", { uid: request.auth.uid });

    const db = getFirestore();
    const now = Timestamp.now();
    const rateRef = db.doc(`clientErrorRateLimits/${request.auth.uid}`);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(rateRef);
      const data = snapshot.data();
      const windowStartedAt = data?.windowStartedAt instanceof Timestamp
        ? data.windowStartedAt.toMillis()
        : 0;
      const withinWindow = now.toMillis() - windowStartedAt < WINDOW_MS;
      const count = withinWindow && typeof data?.count === "number" ? data.count : 0;
      if (count >= MAX_REPORTS_PER_WINDOW) {
        throw new HttpsError("resource-exhausted", "Too many error reports.");
      }
      transaction.set(rateRef, {
        windowStartedAt: withinWindow ? data?.windowStartedAt : now,
        count: count + 1,
        updatedAt: now,
      });
    });

    await db.collection("errorReports").add({
      uid: request.auth.uid,
      ts: now,
      appCheckVerified: Boolean(request.app),
      fingerprint: redactText(parsed.data.fingerprint, 200),
      url: parsed.data.url ? redactText(parsed.data.url, 500) : null,
      error: sanitizeValue(parsed.data.error),
      context: sanitizeValue(parsed.data.context ?? {}),
    });
    return { accepted: true };
  },
);
