import { CaptureBookmarkRequestSchema, type CaptureBookmarkRequest } from "@watchmarks/shared/capture";
import { storage } from "@/lib/storage";
import { auth } from "@/lib/firebase";
import { captureAndWait } from "@/services/captureShare";

const queueKey = (uid: string) => `watchmarks.capture.offline.v2.${uid}`;
const flushes = new Map<string, Promise<number>>();

export function getOfflineCaptures(uid = auth.currentUser?.uid): CaptureBookmarkRequest[] {
  if (!uid) return [];
  return storage.get(queueKey(uid), { fallback: [], validate: (raw) => {
    const parsed = CaptureBookmarkRequestSchema.array().safeParse(raw);
    return parsed.success ? parsed.data : null;
  } });
}

export function queueOfflineCapture(request: CaptureBookmarkRequest): void {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in before saving offline.");
  const validated = CaptureBookmarkRequestSchema.parse(request);
  const queued = getOfflineCaptures(uid);
  if (!queued.some((item) => item.requestId === validated.requestId)
    && !storage.set(queueKey(uid), [...queued, validated])) {
    throw new Error("Could not store this capture on your device. Please try again online.");
  }
}

export function flushOfflineCaptures(): Promise<number> {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.resolve(0);
  const active = flushes.get(uid);
  if (active) return active;
  const run = async () => {
    let completed = 0;
    for (const request of getOfflineCaptures(uid)) {
      if (auth.currentUser?.uid !== uid) break;
      try {
        await captureAndWait(request, uid);
        const latest = getOfflineCaptures(uid).filter((item) => item.requestId !== request.requestId);
        if (!storage.set(queueKey(uid), latest)) break;
        completed++;
      } catch { break; }
    }
    return completed;
  };
  const pending = run().finally(() => flushes.delete(uid));
  flushes.set(uid, pending);
  return pending;
}
