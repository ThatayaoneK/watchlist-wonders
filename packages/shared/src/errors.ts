import { z } from "zod";

export const StableErrorCodeSchema = z.enum([
  "unauthenticated",
  "permission_denied",
  "invalid_request",
  "not_found",
  "conflict",
  "rate_limited",
  "temporarily_unavailable",
  "internal",
]);
export type StableErrorCode = z.infer<typeof StableErrorCodeSchema>;

export const PublicErrorSchema = z.object({
  code: StableErrorCodeSchema,
  message: z.string().min(1).max(300),
  requestId: z.string().max(128).nullable(),
}).strict();
export type PublicError = z.infer<typeof PublicErrorSchema>;
