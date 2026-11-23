import type { CaptureStatus } from "./capture";

export const APP_SCHEME = "watchmarks" as const;

function cleanSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

export function buildBookmarkDeepLink(bookmarkId: string): string {
  return `${APP_SCHEME}://bookmark/${cleanSegment(bookmarkId)}`;
}

export function buildPostCaptureDeepLink(bookmarkId: string, status: CaptureStatus): string {
  return `${APP_SCHEME}://capture/${cleanSegment(status)}?bookmarkId=${cleanSegment(bookmarkId)}`;
}

export function buildSavedItemsDeepLink(): string {
  return `${APP_SCHEME}://saved`;
}
