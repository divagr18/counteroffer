import type { BudgetType, OfferLineItem } from "./types";

export const DEFAULT_GST_PCT = 18;

export interface NormalizationInput {
  lineItems: OfferLineItem[];
  taxesIncluded: boolean;
  /** Defaults to DEFAULT_GST_PCT (18) when taxes are not included. */
  taxRatePct?: number;
  /**
   * true  = travel is included in the quote.
   * false = travel is excluded (add travelAmount if known).
   * undefined (present) = travel status is unknown → surfaced as an assumption.
   * key absent = travel is not tracked separately (e.g. all-inclusive package).
   */
  travelIncluded?: boolean;
  travelAmount?: number;
  budgetType?: BudgetType;
}

export interface NormalizationResult {
  subtotal: number;
  taxAmount: number;
  travelAmount: number;
  estimatedTotal: number;
  /** Every assumption applied, visible in the UI ("why this total?"). */
  assumptions: string[];
}

/**
 * Quote normalization (doc §14).
 *
 * Converts wildly different vendor packaging (itemized vs all-inclusive,
 * tax-inclusive vs GST-extra, travel included vs extra) into a single
 * comparable estimated total — with every assumption made explicit.
 *
 * Deterministic; no LLM involved.
 */
export function normalizeOffer(input: NormalizationInput): NormalizationResult {
  const assumptions: string[] = [];

  // Only included line items count toward the subtotal. Optional addons that
  // the vendor did not include are deliberately excluded.
  const subtotal = input.lineItems
    .filter((li) => li.included)
    .reduce((sum, li) => sum + li.totalPrice, 0);

  // Taxes.
  let taxAmount = 0;
  if (!input.taxesIncluded && subtotal > 0) {
    const rate = input.taxRatePct ?? DEFAULT_GST_PCT;
    taxAmount = Math.round((subtotal * rate) / 100);
    assumptions.push(`Applied ${rate}% GST (quote excluded taxes)`);
  }

  // Travel.
  let travelAmount = 0;
  const travelKeyPresent = "travelIncluded" in input;
  if (input.travelIncluded === false) {
    if (typeof input.travelAmount === "number" && input.travelAmount > 0) {
      travelAmount = input.travelAmount;
      assumptions.push("Added stated travel fee (quoted separately)");
    } else {
      assumptions.push("Travel excluded but amount unknown — not added");
    }
  } else if (travelKeyPresent && input.travelIncluded === undefined) {
    assumptions.push("Travel inclusion unknown — excluded from estimate");
  }

  const estimatedTotal = Math.round(subtotal + taxAmount + travelAmount);

  return { subtotal, taxAmount, travelAmount, estimatedTotal, assumptions };
}
