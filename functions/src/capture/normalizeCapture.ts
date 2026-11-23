import { createHash } from "node:crypto";
import type { CaptureBookmarkRequest } from "@watchmarks/shared";

export function extractUrlFromSharedText(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match?.[0]?.replace(/[.,!?]+$/, "") ?? null;
}

export function normalizeCaptureRequest(request: CaptureBookmarkRequest) {
  const rawUrl = request.url ?? extractUrlFromSharedText(request.sharedText);
  let url: string | null = null;
  if (rawUrl) {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
      parsed.port = "";
    }
    url = parsed.toString();
  }
  const title = request.sharedTitle?.trim() || null;
  const text = request.sharedText?.trim() || null;
  const fingerprintBasis = url ?? `${title ?? ""}\n${text ?? ""}`.toLowerCase();
  return {
    ...request,
    url,
    sharedTitle: title,
    sharedText: text,
    fingerprint: createHash("sha256").update(fingerprintBasis).digest("hex"),
  };
}
