import { ActionRetrier } from "@convex-dev/action-retrier";
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Outbound-email and discovery throttles.
 *
 * These are real vendors receiving real email, so the agent's politeness is
 * enforced by the rate limiter rather than by prompt instructions:
 *
 *  - `vendorEmail` — per vendor. A token bucket of 4 per hour with a burst of
 *    2 means the agent can send an RFQ and a quick clarification back to back,
 *    but cannot hammer one business no matter how many campaigns reference it.
 *  - `campaignEmail` — per campaign. A fixed window caps total send volume for
 *    one buying objective, so a wide pipeline cannot turn into a blast.
 *  - `discoveryRun` — per campaign. Firecrawl search + enrichment is the paid
 *    path; this stops repeat Start-sourcing clicks from re-crawling the web.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  vendorEmail: {
    kind: "token bucket",
    rate: 4,
    period: HOUR,
    capacity: 2,
  },
  campaignEmail: {
    kind: "fixed window",
    rate: 40,
    period: HOUR,
  },
  discoveryRun: {
    kind: "token bucket",
    rate: 3,
    period: HOUR,
    capacity: 1,
  },
});

/**
 * Retries for third-party writes. AgentMail sends are the one step where a
 * transient failure silently costs a vendor: no email, no reply, no offer.
 * Four attempts with exponential backoff from 1s.
 */
export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000,
  base: 2,
  maxFailures: 4,
});

export { HOUR, MINUTE };
