import { z } from "zod";
import { AvailabilitySchema, MediaTypeSchema, SourcePlatformSchema } from "./media";

export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

export const TimestampSchema = z.custom<Date | TimestampLike>(
  (value) => {
    if (value instanceof Date) return Number.isFinite(value.getTime());
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const timestamp = value as Partial<TimestampLike>;
    return Number.isFinite(timestamp.seconds) && Number.isFinite(timestamp.nanoseconds);
  },
  "Expected a Firestore Timestamp or Date",
);

export const ResolutionStatusSchema = z.enum([
  "pending",
  "matched",
  "needs_selection",
  "unresolved",
  "failed",
]);
export const LibraryStateSchema = z.enum(["saved", "watching", "watched", "dropped"]);
export const QueueStateSchema = z.enum(["queued", "up_next", "in_progress", "completed"]);

const NullableUrlSchema = z.string().url().max(2048).nullable();
const NullableTimestampSchema = TimestampSchema.nullable();

export const BookmarkV2Schema = z.object({
  schemaVersion: z.literal(2),
  ownerId: z.string().min(1).max(128),
  source: z.object({
    originalUrl: NullableUrlSchema,
    canonicalUrl: NullableUrlSchema,
    platform: SourcePlatformSchema,
    rawTitle: z.string().max(500).nullable(),
    capturedAt: TimestampSchema,
    captureId: z.string().max(128).nullable(),
  }).strict(),
  media: z.object({
    type: MediaTypeSchema,
    title: z.string().min(1).max(300),
    posterUrl: NullableUrlSchema,
    backdropUrl: NullableUrlSchema,
    releaseYear: z.number().int().min(1880).max(2200).nullable(),
    runtimeMinutes: z.number().int().positive().max(10000).nullable(),
  }).strict(),
  resolution: z.object({
    status: ResolutionStatusSchema,
    provider: z.enum(["tmdb", "youtube"]).nullable(),
    externalId: z.string().max(200).nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    version: z.number().int().positive(),
    candidates: z.array(z.record(z.unknown())).max(20).optional(),
    selectedBy: z.enum(["auto", "user", "manual"]).nullable().optional(),
  }).strict(),
  library: z.object({
    state: LibraryStateSchema,
    scheduledAt: NullableTimestampSchema,
    progressPercent: z.number().min(0).max(100),
    priority: z.number().finite(),
    queueState: QueueStateSchema,
    tags: z.array(z.string().max(40)).max(30),
    moodTags: z.array(z.string().max(40)).max(25),
    notes: z.string().max(5000).nullable(),
    rating: z.number().int().min(1).max(5).nullable(),
    review: z.string().max(5000).nullable(),
    watchedAt: NullableTimestampSchema,
    lastShownAt: NullableTimestampSchema,
    shownCount: z.number().int().nonnegative(),
    episodesWatched: z.number().int().nonnegative().nullable().optional(),
    totalEpisodes: z.number().int().positive().nullable().optional(),
    trailerUrl: NullableUrlSchema.optional(),
    watchedWith: z.string().max(200).nullable().optional(),
  }).strict(),
  visibility: z.object({
    isPublic: z.boolean(),
    isVaulted: z.boolean(),
    shareToken: z.string().max(200).nullable(),
  }).strict().refine((value) => !(value.isPublic && value.isVaulted), {
    message: "Vaulted bookmarks cannot be public",
  }),
  availability: AvailabilitySchema.nullable(),
  intelligence: z.object({
    autoTags: z.array(z.string().max(80)).max(50),
    embeddingRef: z.string().max(500).nullable(),
    fingerprint: z.record(z.unknown()).nullable(),
    clusterId: z.string().max(200).nullable(),
    importanceScore: z.number().finite().nullable(),
    pendingClusterAssignment: z.boolean(),
    pipelineVersion: z.number().int().nonnegative(),
    lastViewedAt: NullableTimestampSchema,
    viewCount: z.number().int().nonnegative(),
  }).strict(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

export type BookmarkV2 = z.infer<typeof BookmarkV2Schema>;

export function isBookmarkV2(value: unknown): value is BookmarkV2 {
  return BookmarkV2Schema.safeParse(value).success;
}
