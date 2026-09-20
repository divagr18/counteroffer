import type { ParsedReply } from "../../convex/lib/llmSchemas";

export interface EmailFixture {
  name: string;
  body: string;
  expect: {
    intent: ParsedReply["intent"] | ParsedReply["intent"][];
    taxesIncluded?: boolean | null;
    minLineItems?: number;
    missingIncludes?: string[];
    available?: boolean | null;
    maxTotal?: number;
  };
}

export const EMAIL_FIXTURES: EmailFixture[] = [
  {
    name: "clear-quote",
    body: "Hi,\n\nYes, we're available on October 18. Our complete package is ₹38,000 including taxes and travel — 8 hours of coverage, edited photos and the highlight film, delivered within 30 days.\n\n— Aurora Studios",
    expect: { intent: "quote", taxesIncluded: true, minLineItems: 1, missingIncludes: [] },
  },
  {
    name: "incomplete-quote",
    body: "Hi,\n\nWe're available! Packages start at ₹30,000. Let me know if you'd like to proceed.\n\n— Bright Frames",
    expect: {
      intent: "quote",
      missingIncludes: ["hours", "taxes"],
    },
  },
  {
    name: "multiple-packages",
    body: "Hello,\n\nTwo options for your date: Silver at ₹32,000 for 6 hours of coverage; Gold at ₹45,000 for 10 hours including a drone pass. Both prices are tax inclusive.\n\nRegards,\nSkyline Studios",
    expect: { intent: "quote", minLineItems: 2, taxesIncluded: true },
  },
  {
    name: "rejection",
    body: "Hi,\n\nThanks but we've decided not to take new enquiries this season.\n\n— Velvet Lens",
    expect: { intent: "declined" },
  },
  {
    name: "unavailable",
    body: "Hello,\n\nWe're already booked on October 18, sorry.\n\nBest,\nMono Studios",
    expect: { intent: "unavailable", available: false },
  },
  {
    name: "counteroffer",
    body: "Hi,\n\n₹30,000 is tight for us. We can do ₹35,000 all-inclusive as a final price.\n\n— Amber Films",
    expect: { intent: "negotiation" },
  },
  {
    name: "price-reduction",
    body: "Hi,\n\nGood news — we can match ₹31,000 all-inclusive if you confirm this week.\n\n— Coral Studios",
    expect: { intent: ["negotiation", "quote"], maxTotal: 31000 },
  },
  {
    name: "hidden-tax",
    body: "Hello,\n\nBase price is ₹30,000. GST 18% applies extra, travel is ₹2,000, and the highlight video is an add-on of ₹8,000.\n\n— Delta Clicks",
    expect: { intent: "quote", taxesIncluded: false },
  },
  {
    name: "attachment-mention",
    body: "Hi,\n\nPlease find our package brochure attached. The standard wedding package is ₹36,000, taxes included.\n\n— Ember Studios",
    expect: { intent: "quote", taxesIncluded: true },
  },
  {
    name: "unrelated",
    body: "Dear customer,\n\nYour invoice #2041 for last month's subscription is now due. Pay via the portal.\n\nBilling Team",
    expect: { intent: "unrelated" },
  },
];
