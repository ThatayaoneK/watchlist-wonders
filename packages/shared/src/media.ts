import { z } from "zod";

export const SourcePlatformSchema = z.enum([
  "youtube",
  "imdb",
  "netflix",
  "instagram",
  "facebook",
  "x",
  "letterboxd",
  "tiktok",
  "reddit",
  "rottentomatoes",
  "generic",
]);

export const MediaTypeSchema = z.enum([
  "movie",
  "series",
  "episode",
  "video",
  "documentary",
  "other",
]);

export const AvailabilityProviderSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["subscription", "rent", "buy"]),
  url: z.string().url(),
  region: z.string().min(2).max(8),
  providerId: z.number().int().positive(),
  logoUrl: z.string().url().nullable(),
  score: z.number().finite(),
  leavingDate: z.string().datetime().nullable().optional(),
}).strict();

export const AvailabilitySchema = z.object({
  providers: z.array(AvailabilityProviderSchema).max(100),
  lastUpdated: z.string().datetime(),
  region: z.string().min(2).max(8),
  externalId: z.string().nullable(),
  status: z.enum(["ok", "no_match", "no_providers", "error"]),
}).strict();

export type SourcePlatform = z.infer<typeof SourcePlatformSchema>;
export type MediaType = z.infer<typeof MediaTypeSchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
