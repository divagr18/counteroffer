import { describe, expect, it } from "vitest";
import { scoreOffer } from "../convex/lib/score";
import type { OfferScoreInput } from "../convex/lib/score";

const base: OfferScoreInput = {
  estimatedTotal: 33000,
  targetBudget: 32000,
  hardBudget: 40000,
  requiredCount: 4,
  satisfiedRequiredCount: 4,
  availability: true,
  completenessScore: 1,
  missingFieldsCount: 0,
  responseLatencyMs: 19 * 60 * 1000,
  historicalReliability: 0.9,
};

describe("scoreOffer", () => {
  it("doc §19: complete vendor outranks cheaper-but-incomplete vendor", () => {
    // Samarth: ₹33k, every requirement met, fast reply.
    const samarth = scoreOffer(base);
    // Frame Co: ₹29k (better price fit) but missing video, unclear taxes,
    // unknown delivery → incomplete.
    const frameCo = scoreOffer({
      ...base,
      estimatedTotal: 29000,
      satisfiedRequiredCount: 3,
      completenessScore: 0.5,
      missingFieldsCount: 3,
      responseLatencyMs: 3 * 60 * 60 * 1000,
      historicalReliability: 0.5,
    });
    expect(samarth.score).toBeGreaterThan(frameCo.score);
  });

  it("price fit: at-or-under target gets full marks; at-or-over hard max gets zero", () => {
    const under = scoreOffer({ ...base, estimatedTotal: 30000 });
    const atTarget = scoreOffer({ ...base, estimatedTotal: 32000 });
    const atHard = scoreOffer({ ...base, estimatedTotal: 40000 });
    const overHard = scoreOffer({ ...base, estimatedTotal: 45000 });
    expect(under.breakdown.priceFit).toBe(30);
    expect(atTarget.breakdown.priceFit).toBe(30);
    expect(atHard.breakdown.priceFit).toBe(0);
    expect(overHard.breakdown.priceFit).toBe(0);
  });

  it("price fit decays linearly between target and hard max", () => {
    const mid = scoreOffer({ ...base, estimatedTotal: 36000 });
    // (40000 - 36000) / (40000 - 32000) = 0.5 → 15 points
    expect(mid.breakdown.priceFit).toBeCloseTo(15, 5);
  });

  it("requirement coverage scales with satisfied requirements", () => {
    const full = scoreOffer({ ...base });
    const partial = scoreOffer({ ...base, satisfiedRequiredCount: 2 });
    expect(full.breakdown.requirementCoverage).toBe(30);
    expect(partial.breakdown.requirementCoverage).toBe(15);
  });

  it("availability: confirmed > unknown > unavailable", () => {
    const yes = scoreOffer({ ...base, availability: true });
    const unknown = scoreOffer({ ...base, availability: null });
    const no = scoreOffer({ ...base, availability: false });
    expect(yes.breakdown.availability).toBeGreaterThan(
      unknown.breakdown.availability,
    );
    expect(unknown.breakdown.availability).toBeGreaterThan(
      no.breakdown.availability,
    );
  });

  it("uncertainty penalty grows with missing fields, capped at 10", () => {
    const none = scoreOffer({ ...base, missingFieldsCount: 0 });
    const some = scoreOffer({ ...base, missingFieldsCount: 3 });
    const many = scoreOffer({ ...base, missingFieldsCount: 99 });
    expect(none.breakdown.uncertaintyPenalty).toBe(0);
    expect(some.breakdown.uncertaintyPenalty).toBe(6);
    expect(many.breakdown.uncertaintyPenalty).toBe(10);
  });

  it("final score is clamped to [0, 100]", () => {
    const worst = scoreOffer({
      estimatedTotal: 999999,
      targetBudget: 32000,
      hardBudget: 40000,
      requiredCount: 4,
      satisfiedRequiredCount: 0,
      availability: false,
      completenessScore: 0,
      missingFieldsCount: 20,
      responseLatencyMs: null,
      historicalReliability: 0,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
    const best = scoreOffer({ ...base, estimatedTotal: 20000 });
    expect(best.score).toBeLessThanOrEqual(100);
  });

  it("exposes a full breakdown for explainable rankings", () => {
    const result = scoreOffer(base);
    expect(result.breakdown).toHaveProperty("priceFit");
    expect(result.breakdown).toHaveProperty("requirementCoverage");
    expect(result.breakdown).toHaveProperty("completeness");
    expect(result.breakdown).toHaveProperty("availability");
    expect(result.breakdown).toHaveProperty("responsiveness");
    expect(result.breakdown).toHaveProperty("reliability");
    expect(result.breakdown).toHaveProperty("uncertaintyPenalty");
  });
});
