import { describe, expect, it } from "vitest";
import { DEFAULT_GST_PCT, normalizeOffer } from "../convex/lib/normalize";
import type { OfferLineItem } from "../convex/lib/types";

function item(
  label: string,
  totalPrice: number,
  opts: Partial<OfferLineItem> = {},
): OfferLineItem {
  return {
    label,
    quantity: 1,
    unitPrice: totalPrice,
    totalPrice,
    required: true,
    included: true,
    isAddon: false,
    ...opts,
  };
}

describe("normalizeOffer", () => {
  it("doc §14 Vendor A: itemized quote with GST extra → ₹44,840 estimated", () => {
    const result = normalizeOffer({
      lineItems: [
        item("Photography", 28000),
        item("Video", 8000),
        item("Travel", 2000),
      ],
      taxesIncluded: false,
    });
    expect(result.subtotal).toBe(38000);
    expect(result.taxAmount).toBe(6840); // 18% of 38000
    expect(result.estimatedTotal).toBe(44840);
    expect(result.assumptions.join(" ")).toMatch(/GST|18%/i);
  });

  it("doc §14 Vendor B: all-inclusive package stays ₹39,000", () => {
    const result = normalizeOffer({
      lineItems: [item("All-inclusive package", 39000)],
      taxesIncluded: true,
    });
    expect(result.taxAmount).toBe(0);
    expect(result.estimatedTotal).toBe(39000);
    expect(result.assumptions).toHaveLength(0);
  });

  it("catering per-person: 35 × ₹900 with GST extra → ₹37,170", () => {
    const result = normalizeOffer({
      lineItems: [
        item("Vegetarian catering", 31500, { quantity: 35, unitPrice: 900 }),
      ],
      taxesIncluded: false,
      budgetType: "per_person",
    });
    expect(result.subtotal).toBe(31500);
    expect(result.taxAmount).toBe(5670);
    expect(result.estimatedTotal).toBe(37170);
  });

  it("excluded optional addons do not count toward the total", () => {
    const result = normalizeOffer({
      lineItems: [
        item("Base package", 30000),
        item("Drone footage", 5000, {
          required: false,
          included: false,
          isAddon: true,
        }),
      ],
      taxesIncluded: true,
    });
    expect(result.subtotal).toBe(30000);
    expect(result.estimatedTotal).toBe(30000);
  });

  it("doc §50 Vendor D hidden fees: unknown travel is surfaced as an assumption, not silently added", () => {
    const result = normalizeOffer({
      lineItems: [item("Photography", 30000)],
      taxesIncluded: true,
      travelIncluded: undefined,
    });
    expect(result.travelAmount).toBe(0);
    expect(result.assumptions.join(" ")).toMatch(/travel/i);
  });

  it("known excluded travel fee is added with an assumption", () => {
    const result = normalizeOffer({
      lineItems: [item("Photography", 30000)],
      taxesIncluded: true,
      travelIncluded: false,
      travelAmount: 2000,
    });
    expect(result.travelAmount).toBe(2000);
    expect(result.estimatedTotal).toBe(32000);
    expect(result.assumptions.join(" ")).toMatch(/travel/i);
  });

  it("custom tax rate is respected", () => {
    const result = normalizeOffer({
      lineItems: [item("Service", 10000)],
      taxesIncluded: false,
      taxRatePct: 5,
    });
    expect(result.taxAmount).toBe(500);
    expect(result.estimatedTotal).toBe(10500);
  });

  it("empty quote normalizes to zero", () => {
    const result = normalizeOffer({ lineItems: [], taxesIncluded: true });
    expect(result.subtotal).toBe(0);
    expect(result.estimatedTotal).toBe(0);
  });

  it("default GST rate is 18", () => {
    expect(DEFAULT_GST_PCT).toBe(18);
  });
});
