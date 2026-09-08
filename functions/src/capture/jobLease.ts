export const CAPTURE_LEASE_MS = 150_000;
export const MAX_CAPTURE_ATTEMPTS = 5;

export function claimDecision(job: { state?: string; leaseExpiresAt?: { toMillis(): number }; attempts?: number }, now: number) {
  if (job.state === "complete" || job.state === "failed") return "finished";
  if (job.state === "processing" && (job.leaseExpiresAt?.toMillis() ?? 0) > now) return "busy";
  return (job.attempts ?? 0) >= MAX_CAPTURE_ATTEMPTS ? "failed" : "claim";
}
