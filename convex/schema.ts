import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Shared validator fragments
// ---------------------------------------------------------------------------

export const requirementValidator = v.object({
  id: v.string(),
  label: v.string(),
  kind: v.union(v.literal("required"), v.literal("preferred")),
});

export const campaignSpecValidator = v.object({
  category: v.string(),
  location: v.string(),
  targetDate: v.optional(v.string()),
  quantity: v.optional(v.number()),
  budgetType: v.union(
    v.literal("fixed"),
    v.literal("per_person"),
    v.literal("per_hour"),
    v.literal("package"),
  ),
  targetBudget: v.number(),
  hardBudget: v.number(),
  currency: v.string(),
  requirements: v.array(requirementValidator),
  negotiable: v.array(v.string()),
});

export const permissionsValidator = v.object({
  outreach: v.union(v.literal("auto"), v.literal("ask")),
  clarification: v.union(v.literal("auto"), v.literal("ask")),
  negotiation: v.union(v.literal("auto"), v.literal("ask")),
  selection: v.union(v.literal("auto"), v.literal("ask")),
});

export const pricingSignalValidator = v.object({
  value: v.number(),
  currency: v.string(),
  source: v.string(),
});

export const offerLineItemValidator = v.object({
  label: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  totalPrice: v.number(),
  required: v.boolean(),
  included: v.boolean(),
  isAddon: v.boolean(),
});

// Campaign-vendor pipeline stages.
// (max 8 union members: "rejected" is represented as eliminated + reason)
export const STAGES = [
  "discovered",
  "qualified",
  "eliminated",
  "contacted",
  "replied",
  "negotiating",
  "finalist",
  "selected",
] as const;

export const stageValidator = v.union(
  v.literal("discovered"),
  v.literal("qualified"),
  v.literal("eliminated"),
  v.literal("contacted"),
  v.literal("replied"),
  v.literal("negotiating"),
  v.literal("finalist"),
  v.literal("selected"),
);

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export default defineSchema({
  // Single demo user for the hackathon (no auth).
  users: defineTable({
    name: v.string(),
    email: v.string(),
    createdAt: v.number(),
  }),

  // A procurement campaign: one buying objective, one inbox, one pipeline.
  campaigns: defineTable({
    userId: v.id("users"),
    title: v.string(),
    category: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("requirements_review"),
      v.literal("sourcing"),
      v.literal("active"),
      v.literal("finalists"),
      v.literal("selected"),
      v.literal("closed"),
    ),
    location: v.string(),
    currency: v.string(),
    targetBudget: v.number(),
    hardBudget: v.number(),
    spec: v.optional(campaignSpecValidator),
    permissions: permissionsValidator,
    mailboxId: v.optional(v.id("mailboxes")),
    selectedCampaignVendorId: v.optional(v.id("campaignVendors")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Canonical vendor entity (post entity-resolution).
  vendors: defineTable({
    name: v.string(),
    canonicalDomain: v.optional(v.string()),
    category: v.string(),
    description: v.optional(v.string()),
    locations: v.array(v.string()),
    services: v.array(v.string()),
    pricingSignals: v.array(pricingSignalValidator),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        facebook: v.optional(v.string()),
        youtube: v.optional(v.string()),
      }),
    ),
    aliases: v.array(v.string()),
    sourceUrls: v.array(v.string()),
    confidence: v.number(),
    isDemoVendor: v.boolean(),
    // Scripted behavior for the demo vendor universe (clearly labeled).
    demoBehavior: v.optional(
      v.union(
        v.literal("negotiator"),
        v.literal("premium"),
        v.literal("hidden_fees"),
        v.literal("ghost"),
        v.literal("cheapest_incomplete"),
        v.literal("standard"),
        v.literal("slow"),
        v.literal("decliner"),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_canonicalDomain", ["canonicalDomain"])
    .index("by_email", ["email"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["category"],
    }),

  // Provenance for extracted vendor claims ("Why do we think X?").
  vendorEvidence: defineTable({
    vendorId: v.id("vendors"),
    claim: v.string(),
    sourceUrl: v.string(),
    snippet: v.string(),
    confidence: v.number(),
    createdAt: v.number(),
  }).index("by_vendor", ["vendorId"]),

  // Per-campaign state of a vendor in the pipeline.
  campaignVendors: defineTable({
    campaignId: v.id("campaigns"),
    vendorId: v.id("vendors"),
    stage: stageValidator,
    qualificationScore: v.number(),
    offerScore: v.optional(v.number()),
    availability: v.optional(v.boolean()),
    contactedAt: v.optional(v.number()),
    repliedAt: v.optional(v.number()),
    satisfiedRequirements: v.array(v.string()),
    missingRequirements: v.array(v.string()),
    eliminationReason: v.optional(v.string()),
    currentOfferId: v.optional(v.id("offers")),
    lastAgentActionAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_vendor", ["vendorId"])
    .index("by_campaign_stage", ["campaignId", "stage"])
    .index("by_campaign_vendor", ["campaignId", "vendorId"]),

  // Discovery/enrichment jobs (search plans, scrapes) for observability.
  crawlJobs: defineTable({
    campaignId: v.id("campaigns"),
    kind: v.union(v.literal("search"), v.literal("scrape")),
    query: v.optional(v.string()),
    url: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
    resultCount: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_campaign", ["campaignId"]),

  // One AgentMail inbox per campaign.
  mailboxes: defineTable({
    campaignId: v.id("campaigns"),
    inboxId: v.string(),
    email: v.string(),
    webhookId: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_inboxId", ["inboxId"])
    .index("by_email", ["email"]),

  // Email threads (1 thread per contacted vendor).
  threads: defineTable({
    campaignId: v.id("campaigns"),
    campaignVendorId: v.id("campaignVendors"),
    externalThreadId: v.string(),
    subject: v.string(),
    state: v.union(
      v.literal("drafted"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("replied"),
      v.literal("needs_clarification"),
      v.literal("negotiating"),
      v.literal("finalized"),
      v.literal("closed"),
    ),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_vendor", ["campaignVendorId"])
    .index("by_external", ["externalThreadId"]),

  // Individual email messages.
  messages: defineTable({
    threadId: v.id("threads"),
    campaignId: v.id("campaigns"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    externalMessageId: v.optional(v.string()),
    fromAddress: v.string(),
    toAddresses: v.array(v.string()),
    subject: v.string(),
    bodyText: v.string(),
    extractedText: v.optional(v.string()),
    kind: v.optional(
      v.union(
        v.literal("rfq"),
        v.literal("clarification"),
        v.literal("counteroffer"),
        v.literal("follow_up"),
        v.literal("vendor_reply"),
        v.literal("unknown"),
      ),
    ),
    agentActionId: v.optional(v.id("agentActions")),
    timestamp: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_campaign", ["campaignId"])
    .index("by_external", ["externalMessageId"]),

  // Normalized, comparable offers (with revision history).
  offers: defineTable({
    campaignId: v.id("campaigns"),
    vendorId: v.id("vendors"),
    campaignVendorId: v.id("campaignVendors"),
    revisionNumber: v.number(),
    currency: v.string(),
    lineItems: v.array(offerLineItemValidator),
    subtotal: v.number(),
    taxAmount: v.optional(v.number()),
    taxesIncluded: v.boolean(),
    travelIncluded: v.optional(v.boolean()),
    travelAmount: v.optional(v.number()),
    estimatedTotal: v.number(),
    assumptions: v.array(v.string()),
    coverageHours: v.optional(v.number()),
    deliverables: v.array(v.string()),
    deliveryTimelineDays: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    completenessScore: v.number(),
    missingFields: v.array(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("superseded"),
      v.literal("withdrawn"),
    ),
    sourceMessageId: v.optional(v.id("messages")),
    extractedAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_vendor", ["vendorId"])
    .index("by_campaign_vendor", ["campaignVendorId"])
    .index("by_campaign_status", ["campaignId", "status"]),

  // Audit log of every agent move (drives the Activity feed).
  agentActions: defineTable({
    campaignId: v.id("campaigns"),
    campaignVendorId: v.optional(v.id("campaignVendors")),
    type: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    summary: v.string(),
    detail: v.optional(v.string()),
    createdAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_campaign", ["campaignId"]),

  // Human-in-the-loop gates.
  approvalRequests: defineTable({
    campaignId: v.id("campaigns"),
    campaignVendorId: v.optional(v.id("campaignVendors")),
    kind: v.union(
      v.literal("select_finalist"),
      v.literal("share_personal_details"),
      v.literal("send_outreach"),
    ),
    payload: v.optional(v.any()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_campaign_status", ["campaignId", "status"]),

  // Immutable timeline of everything that happens in a campaign.
  campaignEvents: defineTable({
    campaignId: v.id("campaigns"),
    campaignVendorId: v.optional(v.id("campaignVendors")),
    type: v.string(),
    summary: v.string(),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_campaign_created", ["campaignId", "createdAt"]),

  // Cross-campaign supplier intelligence (the compounding moat).
  vendorMetrics: defineTable({
    vendorId: v.id("vendors"),
    campaignsSeen: v.number(),
    timesContacted: v.number(),
    replies: v.number(),
    medianResponseMs: v.optional(v.number()),
    medianInitialQuote: v.optional(v.number()),
    medianFinalQuote: v.optional(v.number()),
    typicalDiscountPct: v.optional(v.number()),
    timesSelected: v.number(),
    userRating: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_vendor", ["vendorId"]),
});
