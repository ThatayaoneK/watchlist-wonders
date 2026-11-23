import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type {
  CaptureBookmarkRequest,
  CaptureBookmarkResponse,
  ConfirmCaptureCandidateRequest,
} from "@watchmarks/shared";

export async function captureBookmark(input: CaptureBookmarkRequest): Promise<CaptureBookmarkResponse> {
  const callable = httpsCallable<CaptureBookmarkRequest, CaptureBookmarkResponse>(functions, "captureBookmark");
  return (await callable(input)).data;
}

export async function confirmCaptureCandidate(input: ConfirmCaptureCandidateRequest): Promise<CaptureBookmarkResponse> {
  const callable = httpsCallable<ConfirmCaptureCandidateRequest, CaptureBookmarkResponse>(functions, "confirmCandidate");
  return (await callable(input)).data;
}

export async function selectResolutionCandidate(
  bookmarkId: string,
  candidate: unknown,
): Promise<void> {
  const callable = httpsCallable<
    { bookmarkId: string; action: "selected"; candidate: unknown }, 
    unknown
  >(functions, "selectResolutionCandidate");
  await callable({ bookmarkId, action: "selected", candidate });
}

export async function skipResolutionSelection(bookmarkId: string): Promise<void> {
  const callable = httpsCallable<
    { bookmarkId: string; action: "skipped" }, 
    unknown
  >(functions, "selectResolutionCandidate");
  await callable({ bookmarkId, action: "skipped" });
}
