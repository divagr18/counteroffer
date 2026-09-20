import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { normalizeOffer } from "./lib/normalize";
import type { OfferLineItem } from "./lib/types";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const PHOTO_SPEC = {
  category: "photographer",
  location: "Mumbai",
  targetDate: "2026-10-18",
  budgetType: "package" as const,
  targetBudget: 32000,
  hardBudget: 40000,
  currency: "INR",
  requirements: [
    { id: "req-0", label: "Available October 18", kind: "required" as const },
    { id: "req-1", label: "8 hours coverage", kind: "required" as const },
    { id: "req-2", label: "Edited photos", kind: "required" as const },
    { id: "req-3", label: "Highlight video", kind: "required" as const },
    { id: "req-4", label: "Drone footage", kind: "preferred" as const },
  ],
  negotiable: ["raw footage", "album pages", "delivery timeline"],
};

interface DemoVendorSeed {
  name: string;
  category?: string;
  behavior:
    | "negotiator"
    | "premium"
    | "hidden_fees"
    | "ghost"
    | "cheapest_incomplete"
    | "standard"
    | "slow"
    | "decliner";
  email: string;
  website: string;
  services: string[];
}

const DEMO_VENDORS: DemoVendorSeed[] = [
  {
    name: "Pixel House",
    behavior: "negotiator",
    email: "hello@pixelhouse.studio",
    website: "https://pixelhouse.studio",
    services: ["wedding photography", "candid photography", "cinematography"],
  },
  {
    name: "Samarth Weddings",
    behavior: "negotiator",
    email: "hello@samarthweddings.in",
    website: "https://samarthweddings.in",
    services: ["wedding photography", "candid photography", "highlight films"],
  },
  {
    name: "Frame Co",
    behavior: "cheapest_incomplete",
    email: "contact@frameco.in",
    website: "https://frameco.in",
    services: ["photography"],
  },
  {
    name: "Stories Studio",
    behavior: "standard",
    email: "studio@storiesstudio.com",
    website: "https://storiesstudio.com",
    services: ["wedding photography", "videography"],
  },
  {
    name: "Aurora Films",
    behavior: "premium",
    email: "bookings@aurorafilms.in",
    website: "https://aurorafilms.in",
    services: ["luxury wedding photography", "films"],
  },
  {
    name: "BudgetClicks",
    behavior: "hidden_fees",
    email: "info@budgetclicks.in",
    website: "https://budgetclicks.in",
    services: ["photography", "video add-ons"],
  },
  {
    name: "Silent Lens",
    behavior: "ghost",
    email: "silent@lens.example",
    website: "https://silentlens.example",
    services: ["photography"],
  },
  {
    name: "Late Bloomers",
    behavior: "slow",
    email: "hi@latebloomers.example",
    website: "https://latebloomers.example",
    services: ["photography", "videography"],
  },
];

const CATERING_SPEC = {
  category: "catering",
  location: "Bandra, Mumbai",
  targetDate: "2026-09-26",
  quantity: 35,
  budgetType: "per_person" as const,
  targetBudget: 900,
  hardBudget: 1100,
  currency: "INR",
  requirements: [
    { id: "req-0", label: "Vegetarian menu", kind: "required" as const },
    { id: "req-1", label: "Setup included", kind: "required" as const },
    { id: "req-2", label: "North Indian preferred", kind: "preferred" as const },
  ],
  negotiable: ["menu composition", "dessert", "service staff"],
};

const CATERING_VENDORS: DemoVendorSeed[] = [
  {
    name: "Bombay Bites",
    behavior: "negotiator",
    email: "hello@bombaybites.in",
    website: "https://bombaybites.in",
    services: ["vegetarian catering", "north indian"],
    category: "catering",
  },
  {
    name: "Spice Route Caterers",
    behavior: "standard",
    email: "bookings@spiceroute.in",
    website: "https://spiceroute.in",
    services: ["vegetarian catering", "buffet setup"],
    category: "catering",
  },
  {
    name: "Tiffin Works",
    behavior: "cheapest_incomplete",
    email: "info@tiffinworks.in",
    website: "https://tiffinworks.in",
    services: ["tiffin service", "party catering"],
    category: "catering",
  },
  {
    name: "Grand Feast Co",
    behavior: "premium",
    email: "events@grandfeast.in",
    website: "https://grandfeast.in",
    services: ["luxury catering", "live counters"],
    category: "catering",
  },
];

function lineItem(
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

interface OfferSeed {
  lineItems: OfferLineItem[];
  taxesIncluded: boolean;
  travelIncluded: boolean | null;
  travelAmount?: number;
  coverageHours?: number;
  deliverables: string[];
  deliveryTimelineDays?: number;
  missingFields: string[];
  availability?: boolean;
}

async function ensureUser(ctx: MutationCtx): Promise<Id<"users">> {
  const existing = await ctx.db.query("users").first();
  if (existing) return existing._id;
  return await ctx.db.insert("users", {
    name: "Demo Buyer",
    email: "demo@procurement.network",
    createdAt: Date.now(),
  });
}

async function seedDemoVendor(
  ctx: MutationCtx,
  seed: DemoVendorSeed,
): Promise<Id<"vendors">> {
  const existing = await ctx.db
    .query("vendors")
    .withIndex("by_email", (q) => q.eq("email", seed.email))
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("vendors", {
    name: seed.name,
    canonicalDomain: seed.website.replace(/^https?:\/\//, ""),
    category: seed.category ?? "photographer",
    description: `${seed.name} — ${seed.services.join(", ")}`,
    locations: ["Mumbai"],
    services: seed.services,
    pricingSignals: [],
    email: seed.email,
    website: seed.website,
    aliases: [],
    sourceUrls: [seed.website],
    confidence: 0.92,
    isDemoVendor: true,
    demoBehavior: seed.behavior,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function computeOfferTotals(seed: OfferSeed) {
  return normalizeOffer({
    lineItems: seed.lineItems,
    taxesIncluded: seed.taxesIncluded,
    travelAmount: seed.travelAmount,
    ...(seed.travelIncluded === null
      ? { travelIncluded: undefined }
      : { travelIncluded: seed.travelIncluded }),
  });
}

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const already = await ctx.db
      .query("campaigns")
      .filter((q) => q.eq(q.field("title"), "Wedding Photographer — Mumbai"))
      .first();
    if (already) return { seeded: false, campaignId: already._id };

    const userId = await ensureUser(ctx);
    const now = Date.now();
    const started = now - DAY;

    const campaignId = await ctx.db.insert("campaigns", {
      userId,
      title: "Wedding Photographer — Mumbai",
      category: "photographer",
      description:
        "Wedding photographer in Mumbai on October 18. Eight hours, candid photography and highlight video. Try to stay under ₹40,000.",
      status: "active",
      location: "Mumbai",
      currency: "INR",
      targetBudget: 32000,
      hardBudget: 40000,
      spec: PHOTO_SPEC,
      permissions: {
        outreach: "auto",
        clarification: "auto",
        negotiation: "auto",
        selection: "ask",
      },
      createdAt: started,
      updatedAt: now,
    });

    await ctx.db.insert("mailboxes", {
      campaignId,
      inboxId: "inb_seed_demo",
      email: "photographer-7fx3@agentmail.to",
      createdAt: started,
    });

    const vendorIds: Record<string, Id<"vendors">> = {};
    for (const seed of DEMO_VENDORS) {
      vendorIds[seed.name] = await seedDemoVendor(ctx, seed);
    }

    const mkCv = async (
      vendorName: string,
      stage: Doc<"campaignVendors">["stage"],
      opts: {
        qualificationScore?: number;
        offerSeed?: OfferSeed;
        revisions?: OfferSeed[];
        contactedAgoMs?: number;
        repliedAgoMs?: number;
        satisfied?: string[];
        missing?: string[];
        eliminationReason?: string;
      },
    ) => {
      const vendorId = vendorIds[vendorName];
      const contactedAt =
        opts.contactedAgoMs !== undefined ? now - opts.contactedAgoMs : undefined;
      const repliedAt =
        opts.repliedAgoMs !== undefined ? now - opts.repliedAgoMs : undefined;

      const cvId = await ctx.db.insert("campaignVendors", {
        campaignId,
        vendorId,
        stage,
        qualificationScore: opts.qualificationScore ?? 80,
        availability: opts.offerSeed?.availability,
        contactedAt,
        repliedAt,
        satisfiedRequirements: opts.satisfied ?? ["req-0", "req-1", "req-2", "req-3"],
        missingRequirements: opts.missing ?? [],
        eliminationReason: opts.eliminationReason,
        createdAt: started,
      });

      const allRevisions = opts.revisions ?? (opts.offerSeed ? [opts.offerSeed] : []);
      let currentOfferId: Id<"offers"> | undefined;
      for (let i = 0; i < allRevisions.length; i++) {
        const seed = allRevisions[i];
        const totals = computeOfferTotals(seed);
        const isLast = i === allRevisions.length - 1;
        const offerId = await ctx.db.insert("offers", {
          campaignId,
          vendorId,
          campaignVendorId: cvId,
          revisionNumber: i + 1,
          currency: "INR",
          lineItems: seed.lineItems,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount > 0 ? totals.taxAmount : undefined,
          taxesIncluded: seed.taxesIncluded,
          travelIncluded: seed.travelIncluded === null ? undefined : seed.travelIncluded,
          travelAmount: totals.travelAmount > 0 ? totals.travelAmount : undefined,
          estimatedTotal: totals.estimatedTotal,
          assumptions: totals.assumptions,
          coverageHours: seed.coverageHours,
          deliverables: seed.deliverables,
          deliveryTimelineDays: seed.deliveryTimelineDays,
          completenessScore: 1 - seed.missingFields.length / 6,
          missingFields: seed.missingFields,
          status: isLast ? "active" : "superseded",
          extractedAt: repliedAt ?? now,
        });
        if (isLast) currentOfferId = offerId;
      }
      if (currentOfferId) {
        await ctx.db.patch(cvId, { currentOfferId });
      }
      return cvId;
    };

    const samarth = await mkCv("Samarth Weddings", "finalist", {
      qualificationScore: 92,
      contactedAgoMs: 20 * HOUR,
      repliedAgoMs: 20 * HOUR - 19 * MINUTE,
      revisions: [
        {
          lineItems: [lineItem("Wedding package", 38000)],
          taxesIncluded: true,
          travelIncluded: true,
          coverageHours: 8,
          deliverables: ["edited photos", "highlight film"],
          deliveryTimelineDays: 30,
          missingFields: [],
          availability: true,
        },
        {
          lineItems: [lineItem("Wedding package (negotiated)", 33000)],
          taxesIncluded: true,
          travelIncluded: true,
          coverageHours: 8,
          deliverables: ["edited photos", "highlight film"],
          deliveryTimelineDays: 30,
          missingFields: [],
          availability: true,
        },
      ],
    });

    await mkCv("Pixel House", "negotiating", {
      qualificationScore: 90,
      contactedAgoMs: 20 * HOUR,
      repliedAgoMs: 20 * HOUR - 14 * MINUTE,
      revisions: [
        {
          lineItems: [lineItem("Wedding package", 36000)],
          taxesIncluded: true,
          travelIncluded: true,
          coverageHours: 8,
          deliverables: ["edited photos", "highlight film"],
          deliveryTimelineDays: 21,
          missingFields: [],
          availability: true,
        },
      ],
    });

    await mkCv("Frame Co", "replied", {
      qualificationScore: 61,
      contactedAgoMs: 20 * HOUR,
      repliedAgoMs: 17 * HOUR,
      satisfied: ["req-0", "req-1", "req-2"],
      missing: ["req-3"],
      revisions: [
        {
          lineItems: [lineItem("Photography only", 29000)],
          taxesIncluded: true,
          travelIncluded: true,
          coverageHours: 8,
          deliverables: ["edited photos"],
          missingFields: ["highlight video", "delivery timeline"],
          availability: true,
        },
      ],
    });

    await mkCv("Stories Studio", "negotiating", {
      qualificationScore: 84,
      contactedAgoMs: 19 * HOUR,
      repliedAgoMs: 18 * HOUR,
      revisions: [
        {
          lineItems: [lineItem("Wedding package", 42000)],
          taxesIncluded: true,
          travelIncluded: true,
          coverageHours: 8,
          deliverables: ["edited photos", "highlight film"],
          deliveryTimelineDays: 25,
          missingFields: [],
          availability: true,
        },
        {
          lineItems: [lineItem("Wedding package (revised)", 36000)],
          taxesIncluded: true,
          travelIncluded: true,
          coverageHours: 8,
          deliverables: ["edited photos", "highlight film"],
          deliveryTimelineDays: 25,
          missingFields: [],
          availability: true,
        },
      ],
    });

    await mkCv("Aurora Films", "replied", {
      qualificationScore: 78,
      contactedAgoMs: 19 * HOUR,
      repliedAgoMs: 16 * HOUR,
      revisions: [
        {
          lineItems: [lineItem("Signature package", 52000)],
          taxesIncluded: true,
          travelIncluded: true,
          coverageHours: 10,
          deliverables: ["edited photos", "feature film", "drone footage"],
          deliveryTimelineDays: 45,
          missingFields: [],
          availability: true,
        },
      ],
    });

    await mkCv("BudgetClicks", "replied", {
      qualificationScore: 66,
      contactedAgoMs: 19 * HOUR,
      repliedAgoMs: 15 * HOUR,
      revisions: [
        {
          lineItems: [
            lineItem("Photography", 30000),
            lineItem("Video add-on", 8000, { required: true, isAddon: true }),
            lineItem("Travel", 2000),
          ],
          taxesIncluded: false,
          travelIncluded: false,
          travelAmount: 2000,
          coverageHours: 8,
          deliverables: ["edited photos", "highlight film"],
          missingFields: ["delivery timeline"],
          availability: true,
        },
      ],
    });

    await mkCv("Silent Lens", "contacted", {
      qualificationScore: 58,
      contactedAgoMs: 18 * HOUR,
    });

    await mkCv("Late Bloomers", "contacted", {
      qualificationScore: 62,
      contactedAgoMs: 6 * HOUR,
    });

    void samarth;

    await ctx.db.insert("vendorMetrics", {
      vendorId: vendorIds["Samarth Weddings"],
      campaignsSeen: 4,
      timesContacted: 3,
      replies: 3,
      medianResponseMs: 21 * MINUTE,
      medianInitialQuote: 38000,
      medianFinalQuote: 33500,
      typicalDiscountPct: 11.8,
      timesSelected: 1,
      userRating: 4.7,
      updatedAt: now,
    });
    await ctx.db.insert("vendorMetrics", {
      vendorId: vendorIds["Pixel House"],
      campaignsSeen: 2,
      timesContacted: 2,
      replies: 2,
      medianResponseMs: 14 * MINUTE,
      medianInitialQuote: 36000,
      medianFinalQuote: 31900,
      typicalDiscountPct: 11.4,
      timesSelected: 0,
      userRating: 4.4,
      updatedAt: now,
    });

    const timeline: { agoMs: number; type: string; summary: string }[] = [
      { agoMs: 24 * HOUR, type: "campaign.created", summary: "Campaign created" },
      { agoMs: 23 * HOUR, type: "discovery.planned", summary: "Search plan ready: 5 queries" },
      { agoMs: 22 * HOUR, type: "vendor.discovered", summary: "Discovered Samarth Weddings" },
      { agoMs: 22 * HOUR, type: "vendor.discovered", summary: "Discovered Pixel House" },
      { agoMs: 21 * HOUR, type: "vendor.qualified", summary: "Samarth Weddings qualified (score 92)" },
      { agoMs: 20 * HOUR, type: "outreach.sent", summary: "RFQ sent to Samarth Weddings" },
      { agoMs: 20 * HOUR - 19 * MINUTE, type: "message.received", summary: "Samarth Weddings replied" },
      { agoMs: 20 * HOUR - 18 * MINUTE, type: "offer.extracted", summary: "Samarth Weddings offer extracted: ₹38,000 estimated total" },
      { agoMs: 19 * HOUR, type: "negotiation.counter", summary: "Counter sent to Samarth Weddings: ₹35,000 (from ₹38,000)" },
      { agoMs: 18 * HOUR, type: "offer.revised", summary: "Samarth Weddings offer revised: ₹33,000 estimated total" },
      { agoMs: 17 * HOUR, type: "offer.extracted", summary: "Frame Co offer extracted: ₹29,000 estimated total" },
      { agoMs: 16 * HOUR, type: "message.received", summary: "Aurora Films replied" },
      { agoMs: 2 * HOUR, type: "negotiation.counter", summary: "Counter sent to Pixel House: ₹33,000 (from ₹36,000)" },
    ];
    for (const ev of timeline) {
      await ctx.db.insert("campaignEvents", {
        campaignId,
        type: ev.type,
        summary: ev.summary,
        createdAt: now - ev.agoMs,
      });
    }

    return { seeded: true, campaignId };
  },
});

export const seedInstantDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ensureUser(ctx);
    const now = Date.now();

    const campaignId = await ctx.db.insert("campaigns", {
      userId,
      title: "Wedding Photographer — Live Demo",
      category: "photographer",
      description:
        "Wedding photographer in Mumbai on October 18. Eight hours, candid photography and highlight video. Try to stay under ₹40,000.",
      status: "active",
      location: "Mumbai",
      currency: "INR",
      targetBudget: 32000,
      hardBudget: 40000,
      spec: PHOTO_SPEC,
      permissions: {
        outreach: "auto",
        clarification: "auto",
        negotiation: "auto",
        selection: "ask",
      },
      createdAt: now,
      updatedAt: now,
    });

    for (const seed of DEMO_VENDORS.slice(0, 6)) {
      const vendorId = await seedDemoVendor(ctx, seed);
      await ctx.db.insert("campaignVendors", {
        campaignId,
        vendorId,
        stage: "qualified",
        qualificationScore: 70 + Math.floor(Math.random() * 25),
        satisfiedRequirements: ["req-0", "req-1", "req-2", "req-3"],
        missingRequirements: [],
        createdAt: now,
      });
    }

    await ctx.db.insert("campaignEvents", {
      campaignId,
      type: "campaign.created",
      summary: "Live demo campaign created — vendors pre-qualified",
      createdAt: now,
    });

    return { campaignId };
  },
});

export const seedCateringDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const already = await ctx.db
      .query("campaigns")
      .filter((q) => q.eq(q.field("title"), "Catering — Bandra"))
      .first();
    if (already) return { seeded: false, campaignId: already._id };

    const userId = await ensureUser(ctx);
    const now = Date.now();

    const campaignId = await ctx.db.insert("campaigns", {
      userId,
      title: "Catering — Bandra",
      category: "catering",
      description:
        "Catering for 35 people in Bandra next Saturday. Vegetarian, preferably North Indian, around ₹900/head, setup included.",
      status: "active",
      location: "Bandra, Mumbai",
      currency: "INR",
      targetBudget: 900,
      hardBudget: 1100,
      spec: CATERING_SPEC,
      permissions: {
        outreach: "auto",
        clarification: "auto",
        negotiation: "auto",
        selection: "ask",
      },
      createdAt: now,
      updatedAt: now,
    });

    for (const seed of CATERING_VENDORS) {
      const vendorId = await seedDemoVendor(ctx, seed);
      await ctx.db.insert("campaignVendors", {
        campaignId,
        vendorId,
        stage: "qualified",
        qualificationScore: 70 + Math.floor(Math.random() * 25),
        satisfiedRequirements: ["req-0", "req-1"],
        missingRequirements: [],
        createdAt: now,
      });
    }

    await ctx.db.insert("campaignEvents", {
      campaignId,
      type: "campaign.created",
      summary: "Catering demo campaign created — vendors pre-qualified",
      createdAt: now,
    });

    return { campaignId };
  },
});
