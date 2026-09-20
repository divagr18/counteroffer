import { describe, expect, it } from "vitest";
import { decideNegotiation } from "../convex/lib/negotiate";
import type { NegotiationInput } from "../convex/lib/negotiate";

const base: NegotiationInput = {
  currentQuote: 38000,
  targetPrice: 32000,
  hardMax: 40000,
  bestCompetingOffer: null,
  round: 1,
  maxRounds: 3,
};

describe("decideNegotiation (doc §16–17)", () => {
  it("accepts when the quote is already at or under target", () => {
    const decision = decideNegotiation({ ...base, currentQuote: 31000 });
    expect(decision.action).toBe("accept");
    expect(decision.counterAmount).toBeNull();
  });

  it("walks away when the quote exceeds the hard maximum", () => {
    const decision = decideNegotiation({ ...base, currentQuote: 45000 });
    expect(decision.action).toBe("walk_away");
    expect(decision.counterAmount).toBeNull();
  });

  it("holds after maxRounds instead of negotiating forever", () => {
    const decision = decideNegotiation({ ...base, round: 4, maxRounds: 3 });
    expect(decision.action).toBe("hold");
  });

  it("counters with the midpoint in round 1 (38k → 35k ask)", () => {
    const decision = decideNegotiation(base);
    expect(decision.action).toBe("counter");
    expect(decision.counterAmount).toBe(35000);
  });

  it("doc §16: uses a REAL competing offer as anchor (34k vs 32.5k competitor → 33k ask)", () => {
    const decision = decideNegotiation({
      ...base,
      currentQuote: 34000,
      bestCompetingOffer: 32500,
    });
    expect(decision.action).toBe("counter");
    expect(decision.counterAmount).toBe(33000);
  });

  it("never fabricates leverage: without a competing offer it never references one", () => {
    const decision = decideNegotiation(base);
    expect(decision.rationale.toLowerCase()).not.toMatch(/another|compet/i);
  });

  it("concedes toward the current quote in later rounds", () => {
    const round1 = decideNegotiation({ ...base, currentQuote: 34000 });
    const round3 = decideNegotiation({
      ...base,
      currentQuote: 34000,
      round: 3,
      maxRounds: 3,
    });
    expect(round3.counterAmount!).toBeGreaterThan(round1.counterAmount!);
    expect(round3.counterAmount!).toBeLessThan(34000);
  });

  it("SAFETY INVARIANT: counter never exceeds hardMax, never below target, always under current quote", () => {
    const quotes = [32500, 33000, 34000, 38000, 39500, 39999, 40000];
    const targets = [20000, 30000, 32000, 38000, 39000];
    const competitors = [null, 30000, 31000, 39000];
    for (const currentQuote of quotes) {
      for (const targetPrice of targets) {
        for (const bestCompetingOffer of competitors) {
          for (let round = 1; round <= 3; round++) {
            const input: NegotiationInput = {
              currentQuote,
              targetPrice,
              hardMax: 40000,
              bestCompetingOffer,
              round,
              maxRounds: 3,
            };
            const decision = decideNegotiation(input);
            if (decision.action === "counter") {
              const amount = decision.counterAmount!;
              expect(amount).toBeLessThanOrEqual(40000);
              expect(amount).toBeGreaterThanOrEqual(
                Math.min(targetPrice, currentQuote),
              );
              expect(amount).toBeLessThan(currentQuote);
              expect(amount % 500).toBe(0);
            }
          }
        }
      }
    }
  });

  it("is deterministic", () => {
    const a = decideNegotiation(base);
    const b = decideNegotiation(base);
    expect(a).toEqual(b);
  });
});
