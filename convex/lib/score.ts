import { clamp, clamp01 } from "./types";

export interface OfferScoreInput {
  estimatedTotal: number;
  targetBudget: number;
  hardBudget: number;
  requiredCount: number;
  satisfiedRequiredCount: number;
  /** null = unknown. */
  availability: boolean | null;
  /** 0..1 */
  completenessScore: number;
  missingFieldsCount: number;
  /** null = no reply yet. */
  responseLatencyMs: number | null;
  /** 0..1 historical reply-rate / reliability. */
  historicalReliability: number;
}

export interface ScoreBreakdown {
  priceFit: number;
  requirementCoverage: number;
  completeness: number;
  availability: number;
  responsiveness: number;
  reliability: number;
  /** Positive number that is subtracted. */
  uncertaintyPenalty: number;
}

export interface OfferScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
}

// Transparent weights (doc §20). A judge must be able to see exactly why one
// vendor outranks another, so the breakdown is exposed in full.
const WEIGHTS = {
  priceFit: 30,
  requirementCoverage: 30,
  completeness: 15,
  availability: 10,
  responsiveness: 5,
  reliability: 5,
} as const;

const MAX_UNCERTAINTY_PENALTY = 10;
const PENALTY_PER_MISSING_FIELD = 2;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Offer scoring (doc §20). Deliberately NOT price-only: a cheap incomplete
 * offer must not automatically outrank a complete one (doc §19).
 *
 * score = price_fit + requirement_coverage + completeness + availability
 *         + responsiveness + reliability - uncertainty
 */
export function scoreOffer(input: OfferScoreInput): OfferScoreResult {
  // Price fit: full marks at/under target, zero at/over hard max, linear in between.
  let priceFit: number;
  if (input.estimatedTotal <= input.targetBudget) {
    priceFit = WEIGHTS.priceFit;
  } else if (input.estimatedTotal >= input.hardBudget) {
    priceFit = 0;
  } else {
    const span = input.hardBudget - input.targetBudget;
    const remaining = input.hardBudget - input.estimatedTotal;
    priceFit = span > 0 ? WEIGHTS.priceFit * (remaining / span) : 0;
  }

  // Requirement coverage.
  const requirementCoverage =
    input.requiredCount === 0
      ? WEIGHTS.requirementCoverage
      : WEIGHTS.requirementCoverage *
        clamp01(input.satisfiedRequiredCount / input.requiredCount);

  // Completeness of the extracted offer.
  const completeness = WEIGHTS.completeness * clamp01(input.completenessScore);

  // Availability.
  const availability =
    input.availability === true
      ? WEIGHTS.availability
      : input.availability === null
        ? WEIGHTS.availability * 0.4
        : 0;

  // Responsiveness.
  let responsiveness: number;
  if (input.responseLatencyMs === null) {
    responsiveness = 1;
  } else if (input.responseLatencyMs <= 30 * MINUTE) {
    responsiveness = WEIGHTS.responsiveness;
  } else if (input.responseLatencyMs <= 2 * HOUR) {
    responsiveness = 3.5;
  } else if (input.responseLatencyMs <= 24 * HOUR) {
    responsiveness = 2;
  } else {
    responsiveness = 1;
  }

  // Historical reliability (the compounding moat).
  const reliability = WEIGHTS.reliability * clamp01(input.historicalReliability);

  // Uncertainty penalty.
  const uncertaintyPenalty = Math.min(
    MAX_UNCERTAINTY_PENALTY,
    PENALTY_PER_MISSING_FIELD * Math.max(0, input.missingFieldsCount),
  );

  const raw =
    priceFit +
    requirementCoverage +
    completeness +
    availability +
    responsiveness +
    reliability -
    uncertaintyPenalty;

  const score = clamp(Math.round(raw * 100) / 100, 0, 100);

  return {
    score,
    breakdown: {
      priceFit,
      requirementCoverage,
      completeness,
      availability,
      responsiveness,
      reliability,
      uncertaintyPenalty,
    },
  };
}
