import { z } from "zod";

export const CaptureBookmarkSurfaceSchema = z.enum([
  "web_paste",
  "pwa_share",
  "flutter_share",
  "manual",
]);

export const CaptureRequestIdSchema = z.string().uuid();
const CaptureHttpUrlSchema = z.string().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only HTTP and HTTPS URLs are supported.");

const trackingParamNames = new Set([
  "fbclid",
  "gclid",
  "igsh",
  "igshid",
  "si",
  "feature",
  "ref_src",
  "mc_cid",
  "mc_eid",
]);

export function extractSharedUrl(urlValue?: string | null, textValue?: string | null): string | null {
  const urlPattern = /https?:\/\/[^\s<>"']+/i;
  const candidates = [urlValue?.trim(), urlValue?.match(urlPattern)?.[0], textValue?.match(urlPattern)?.[0]];

  for (const rawCandidate of candidates) {
    const candidate = rawCandidate?.replace(/[),.;!?]+$/, "");
    if (!candidate) continue;

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
    } catch {
      continue;
    }
  }

  return null;
}

export function normalizeSharedUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS links can be saved.");
  }

  parsed.hostname = parsed.hostname.toLowerCase().replace(/^(?:(?:www|m)\.)+/, "");
  parsed.hash = "";

  for (const key of [...parsed.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith("utm_") || trackingParamNames.has(normalizedKey)) {
      parsed.searchParams.delete(key);
    }
  }

  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.searchParams.sort();
  return parsed.toString();
}

export const CaptureBookmarkRequestSchema = z.object({
  requestId: CaptureRequestIdSchema,
  expectedOwnerId: z.string().min(1).max(128).optional(),
  url: CaptureHttpUrlSchema.optional(),
  sharedText: z.string().max(10000).optional(),
  sharedTitle: z.string().max(500).optional(),
  surface: CaptureBookmarkSurfaceSchema,
  clientCapturedAt: z.string().datetime(),
}).strict().refine(
  (value) => Boolean(value.url || value.sharedText?.trim() || value.sharedTitle?.trim()),
  { message: "A URL, shared text, or shared title is required." },
);

export const CaptureSurfaceSchema = z.enum([
  "web_quick_add",
  "pwa_share_target",
  "ios_share_extension",
  "android_share_intent",
]);
export const CaptureStatusSchema = z.enum([
  "auto_saved",
  "needs_selection",
  "unresolved",
  "duplicate",
]);

export const CAPTURE_SURFACES = CaptureSurfaceSchema.options;
export const CAPTURE_STATUSES = CaptureStatusSchema.options;
export type CaptureSurface = z.infer<typeof CaptureSurfaceSchema>;
export type CaptureStatus = z.infer<typeof CaptureStatusSchema>;

export const CaptureMatchCandidateSchema = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string().min(1).max(300),
  mediaType: z.enum(["movie", "tv"]),
  contentType: z.enum(["movie", "series", "episode"]).optional(),
  releaseYear: z.number().int().optional(),
  posterUrl: z.string().url().optional(),
  backdropUrl: z.string().url().optional(),
  description: z.string().optional(),
  voteAverage: z.number().optional(),
  runtimeMinutes: z.number().positive().optional(),
  genres: z.array(z.string()).optional(),
  score: z.number().optional(),
  scoreBreakdown: z.record(z.number()).optional(),
});

export const CaptureDraftSchema = z.object({
  url: CaptureHttpUrlSchema.nullable(),
  title: z.string().max(500).nullable(),
  text: z.string().max(10000).nullable(),
}).strict();

const CaptureResponseBaseSchema = z.object({
  captureId: z.string().min(1).max(128),
}).strict();

export const CaptureBookmarkResponseSchema = z.discriminatedUnion("status", [
  CaptureResponseBaseSchema.extend({ status: z.literal("processing") }).strict(),
  CaptureResponseBaseSchema.extend({
    status: z.literal("saved"),
    bookmarkId: z.string().min(1).max(128),
  }).strict(),
  CaptureResponseBaseSchema.extend({
    status: z.literal("needs_selection"),
    bookmarkId: z.string().min(1).max(128),
    candidates: z.array(CaptureMatchCandidateSchema).max(20),
  }).strict(),
  CaptureResponseBaseSchema.extend({
    status: z.literal("unresolved"),
    bookmarkId: z.string().min(1).max(128),
    draft: CaptureDraftSchema,
  }).strict(),
  CaptureResponseBaseSchema.extend({
    status: z.literal("duplicate"),
    bookmarkId: z.string().min(1).max(128),
  }).strict(),
]);

export type CaptureBookmarkSurface = z.infer<typeof CaptureBookmarkSurfaceSchema>;
export type CaptureBookmarkRequest = z.infer<typeof CaptureBookmarkRequestSchema>;
export type CaptureBookmarkResponse = z.infer<typeof CaptureBookmarkResponseSchema>;

export const ConfirmCaptureCandidateRequestSchema = z.object({
  captureId: z.string().min(1).max(128),
  candidate: CaptureMatchCandidateSchema,
}).strict();
export type ConfirmCaptureCandidateRequest = z.infer<typeof ConfirmCaptureCandidateRequestSchema>;

export const CaptureShareRequestSchema = z.object({
  url: z.string().url().max(2048).optional(),
  text: z.string().max(10000).optional(),
  title: z.string().max(500).optional(),
  surface: CaptureSurfaceSchema,
  clientTimestamp: z.string().datetime(),
  deviceId: z.string().max(200).optional(),
});

export type CaptureMatchCandidate = z.infer<typeof CaptureMatchCandidateSchema>;
export type CaptureShareRequest = z.infer<typeof CaptureShareRequestSchema>;
export interface BookmarkOpenTarget { route: "bookmark"; bookmarkId: string }
export interface PostCaptureOpenTarget { route: "post_capture"; bookmarkId: string; status: CaptureStatus }
export type AppOpenTarget = BookmarkOpenTarget | PostCaptureOpenTarget;

export interface CaptureShareResult {
  status: CaptureStatus;
  bookmarkId?: string;
  duplicateOf?: string;
  resolvedTitle?: string;
  extractedTitle?: string;
  provider?: string;
  posterUrl?: string | null;
  candidateCount?: number;
  candidates?: CaptureMatchCandidate[];
  message?: string;
  openTarget?: AppOpenTarget;
}

export function isCaptureSurface(value: unknown): value is CaptureSurface {
  return CaptureSurfaceSchema.safeParse(value).success;
}

export function isCaptureStatus(value: unknown): value is CaptureStatus {
  return CaptureStatusSchema.safeParse(value).success;
}
