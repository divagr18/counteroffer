import { clamp } from "./types";

export interface NegotiationInput {
  currentQuote: number;
  targetPrice: number;
  hardMax: number;
  /**
   * The best REAL competing offer seen in this campaign, or null.
   * The system must NEVER fabricate competitor quotes (doc §16), so this may
   * only ever be populated from an actual competing offer on the leaderboard.
   */
  bestCompetingOffer: number | null;
  /** 1-based round counter. */
  round: number;
  maxRounds: number;
}

export type NegotiationAction = "accept" | "counter" | "hold" | "walk_away";

export interface NegotiationDecision {
  action: NegotiationAction;
  counterAmount: number | null;
  rationale: string;
}

const ROUND_STEP = 500;
/** Ask slightly above a real competing offer rather than undercutting it. */
const COMPETITOR_MARGIN_PCT = 0.02;

/**
 * Negotiation policy (doc §16-17).
 *
 * Hard safety invariants enforced here (not left to the LLM):
 *  - never counter above hardMax
 *  - never counter below the smaller of targetPrice / currentQuote
 *  - always counter strictly below currentQuote
 *  - never exceed maxRounds
 *  - only reference a competing offer when one actually exists
 */
export function decideNegotiation(input: NegotiationInput): NegotiationDecision {
  const {
    currentQuote,
    targetPrice,
    hardMax,
    bestCompetingOffer,
    round,
    maxRounds,
  } = input;

  // Already at/below target: accept.
  if (currentQuote <= targetPrice) {
    return {
      action: "accept",
      counterAmount: null,
      rationale: `Quote ₹${currentQuote} is at or below target ₹${targetPrice}.`,
    };
  }

  // Over the hard budget: walk away.
  if (currentQuote > hardMax) {
    return {
      action: "walk_away",
      counterAmount: null,
      rationale: `Quote ₹${currentQuote} exceeds the hard maximum ₹${hardMax}.`,
    };
  }

  // Out of rounds: hold for the user.
  if (round > maxRounds) {
    return {
      action: "hold",
      counterAmount: null,
      rationale: `Reached the ${maxRounds}-round negotiation limit; holding at ₹${currentQuote}.`,
    };
  }

  // Desired ask starts at the midpoint between current and target.
  const midpoint = (currentQuote + targetPrice) / 2;
  let desired = midpoint;
  let usedCompetitor = false;

  // Only use a competing offer if it is real and tighter than our midpoint.
  if (
    bestCompetingOffer !== null &&
    bestCompetingOffer < currentQuote
  ) {
    const anchored = bestCompetingOffer + COMPETITOR_MARGIN_PCT * currentQuote;
    if (anchored < desired) {
      desired = anchored;
      usedCompetitor = true;
    }
  }

  // Later rounds concede toward the vendor's current quote.
  const concessionFactor = maxRounds > 0 ? (round - 1) / maxRounds : 0;
  const conceded = desired + (currentQuote - desired) * concessionFactor;

  // Clamp into the safe band, then round down to a clean step.
  const minAllowed = Math.min(targetPrice, currentQuote);
  const clamped = clamp(conceded, minAllowed, hardMax);
  let counterAmount = Math.floor(clamped / ROUND_STEP) * ROUND_STEP;

  // Rounding down must never take us below the floor or to/above current.
  if (counterAmount < minAllowed) counterAmount = minAllowed;
  if (counterAmount >= currentQuote) {
    return {
      action: "hold",
      counterAmount: null,
      rationale: `No meaningful room below ₹${currentQuote}; holding.`,
    };
  }

  const rationale = usedCompetitor
    ? `Counter ₹${counterAmount}, informed by a real competing offer of ₹${bestCompetingOffer}.`
    : `Counter ₹${counterAmount}, moving from ₹${currentQuote} toward our target ₹${targetPrice}.`;

  return { action: "counter", counterAmount, rationale };
}
