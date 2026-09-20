import { describe, expect, test } from "vitest";
import { explainRanking } from "../src/lib/explain";
import type { Offer, PipelineRow, Vendor } from "../src/lib/types";

function vendor(_id: string, name: string): Vendor {
  return {
    _id,
    name,
    category: "photographer",
    locations: ["Mumbai"],
    services: ["wedding photography"],
    aliases: [],
    sourceUrls: [],
    confidence: 0.9,
    isDemoVendor: true,
  };
}

function offer(total: number, extra: Partial<Offer> = {}): Offer {
  return {
    _id: `o_${total}`,
    revisionNumber: 1,
    currency: "INR",
    lineItems: [],
    subtotal: total,
    taxesIncluded: true,
    estimatedTotal: total,
    assumptions: [],
    deliverables: [],
    completenessScore: 1,
    missingFields: [],
    status: "active",
    ...extra,
  };
}

const samarth: PipelineRow = {
  cv: {
    _id: "cv_samarth",
    stage: "finalist",
    qualificationScore: 92,
    offerScore: 91,
    availability: true,
    satisfiedRequirements: ["req-0", "req-1", "req-2", "req-3"],
    missingRequirements: [],
  },
  vendor: vendor("v_samarth", "Samarth Weddings"),
  offer: offer(33000),
  firstOffer: offer(38000),
  thread: null,
};

const frameCo: PipelineRow = {
  cv: {
    _id: "cv_frame",
    stage: "replied",
    qualificationScore: 70,
    offerScore: 69,
    availability: true,
    satisfiedRequirements: ["req-0", "req-1", "req-2"],
    missingRequirements: ["req-3"],
  },
  vendor: vendor("v_frame", "Frame Co"),
  offer: offer(29000, {
    completenessScore: 0.75,
    missingFields: ["highlight video", "delivery timeline"],
  }),
  firstOffer: offer(29000),
  thread: null,
};

describe("explainRanking (doc §20)", () => {
  test("cheaper but incomplete vendor gets price-plus-negatives bullets", () => {
    const bullets = explainRanking(frameCo, samarth, 4);
    expect(bullets[0]).toBe("₹4,000 cheaper than Samarth Weddings, but:");
    expect(bullets).toContain("unresolved: highlight video, delivery timeline");
    expect(bullets).toContain("covers 3 of 4 required requirements");
  });

  test("cheaper and complete vendor gets a positive single bullet", () => {
    const complete: PipelineRow = {
      ...frameCo,
      cv: {
        ...frameCo.cv,
        satisfiedRequirements: ["req-0", "req-1", "req-2", "req-3"],
      },
      offer: offer(29000),
    };
    const bullets = explainRanking(complete, samarth, 4);
    expect(bullets).toEqual([
      "₹4,000 cheaper than Samarth Weddings and meets every tracked requirement.",
    ]);
  });

  test("leader gets the best-overall bullet", () => {
    const bullets = explainRanking(samarth, samarth, 4);
    expect(bullets[0]).toBe(
      "Best overall — ₹33,000 with 4 of 4 required met and 100% complete quote.",
    );
  });
});
