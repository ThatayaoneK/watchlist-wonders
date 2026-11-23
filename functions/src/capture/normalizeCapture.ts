import { createHash } from "node:crypto";
import { extractSharedUrl, normalizeSharedUrl, type CaptureBookmarkRequest } from "@watchmarks/shared";

export function normalizeCaptureRequest(request: CaptureBookmarkRequest) {
  const rawUrl = extractSharedUrl(request.url, request.sharedText);
  let url: string | null = null;
  if (rawUrl) {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
      parsed.port = "";
    }
    url = parsed.toString();
  }
  const dedupeUrl = url ? normalizeSharedUrl(url) : null;
  const title = request.sharedTitle?.trim() || null;
  const text = request.sharedText?.trim() || null;
  const fingerprintBasis = dedupeUrl ?? `${title ?? ""}\n${text ?? ""}`.toLowerCase();
  return {
    ...request,
    url,
    dedupeUrl,
    sharedTitle: title,
    sharedText: text,
    fingerprint: createHash("sha256").update(fingerprintBasis).digest("hex"),
  };
}
