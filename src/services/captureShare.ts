import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, fbFunctions } from "@/lib/firebase";
import {
  CaptureBookmarkResponseSchema,
  type CaptureBookmarkRequest,
  type CaptureBookmarkResponse,
  type CaptureShareRequest,
  type CaptureShareResult,
  type ConfirmCaptureCandidateRequest,
} from "@watchmarks/shared/capture";

export async function captureShare(input: CaptureShareRequest): Promise<CaptureShareResult> {
  const callable = httpsCallable<CaptureShareRequest, CaptureShareResult>(fbFunctions, "captureShare");
  const result = await callable(input);
  return result.data;
}

export async function captureBookmark(input: CaptureBookmarkRequest): Promise<CaptureBookmarkResponse> {
  const callable = httpsCallable<CaptureBookmarkRequest, CaptureBookmarkResponse>(fbFunctions, "captureBookmark");
  return CaptureBookmarkResponseSchema.parse((await callable(input)).data);
}

export function waitForCaptureResult(captureId: string, timeoutMs = 45_000): Promise<CaptureBookmarkResponse> {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error("Authentication required."));
  return new Promise((resolve, reject) => {
    let unsubscribe: () => void = () => undefined;
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("Capture is still processing."));
    }, timeoutMs);
    unsubscribe = onSnapshot(doc(db, "users", uid, "captures", captureId), (snapshot) => {
      if (snapshot.data()?.status === "failed") {
        window.clearTimeout(timeout);
        unsubscribe();
        reject(new Error("Capture failed after retries. Please save it again."));
        return;
      }
      const parsed = CaptureBookmarkResponseSchema.safeParse(snapshot.data()?.response);
      if (!parsed.success || parsed.data.status === "processing") return;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(parsed.data);
    }, (error) => {
      window.clearTimeout(timeout);
      unsubscribe();
      reject(error);
    });
  });
}

export async function captureAndWait(input: CaptureBookmarkRequest, expectedUid = auth.currentUser?.uid): Promise<CaptureBookmarkResponse> {
  if (!expectedUid || auth.currentUser?.uid !== expectedUid) throw new Error("Account changed. Please retry your capture.");
  const acknowledged = await captureBookmark({ ...input, expectedOwnerId: expectedUid });
  if (auth.currentUser?.uid !== expectedUid) throw new Error("Account changed. Please retry your capture.");
  return acknowledged.status === "processing" ? waitForCaptureResult(acknowledged.captureId) : acknowledged;
}

export async function confirmCaptureCandidate(input: ConfirmCaptureCandidateRequest) {
  const callable = httpsCallable<ConfirmCaptureCandidateRequest, CaptureBookmarkResponse>(fbFunctions, "confirmCandidate");
  return CaptureBookmarkResponseSchema.parse((await callable(input)).data);
}
