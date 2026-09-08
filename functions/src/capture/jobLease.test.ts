import { describe, expect, it } from "vitest";
import { claimDecision, MAX_CAPTURE_ATTEMPTS } from "./jobLease";

describe("capture lease recovery", () => {
  it("reclaims interrupted and legacy processing jobs", () => {
    expect(claimDecision({ state: "processing", leaseExpiresAt: { toMillis: () => 100 } }, 101)).toBe("claim");
    expect(claimDecision({ state: "processing" }, 101)).toBe("claim");
  });
  it("keeps live deliveries retryable and fences terminal jobs", () => {
    expect(claimDecision({ state: "processing", leaseExpiresAt: { toMillis: () => 200 } }, 101)).toBe("busy");
    expect(claimDecision({ state: "complete" }, 101)).toBe("finished");
    expect(claimDecision({ state: "failed" }, 101)).toBe("finished");
    expect(claimDecision({ state: "queued", attempts: MAX_CAPTURE_ATTEMPTS }, 101)).toBe("failed");
  });
});
