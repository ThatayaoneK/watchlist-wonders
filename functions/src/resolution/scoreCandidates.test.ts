import { describe, expect, it } from "vitest";
import fixtures from "../fixtures/providers/v1/resolution.json";
import { outcomeForScore, scoreCandidate } from "./scoreCandidates";

describe("explainable matching thresholds", () => {
  it.each(fixtures)("classifies labeled fixture $id", (fixture) => {
    const score = scoreCandidate(fixture);
    expect(outcomeForScore(score.total)).toBe(fixture.expected);
    expect(score).toEqual(expect.objectContaining({ title: expect.any(Number), year: expect.any(Number), type: expect.any(Number) }));
  });

  it("uses the documented deterministic boundaries", () => {
    expect(outcomeForScore(0.9)).toBe("matched");
    expect(outcomeForScore(0.899)).toBe("needs_selection");
    expect(outcomeForScore(0.65)).toBe("needs_selection");
    expect(outcomeForScore(0.649)).toBe("unresolved");
  });
});
