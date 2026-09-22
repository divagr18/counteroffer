import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { normalizeOffer } from "./lib/normalize";
import { scoreOffer } from "./lib/score";
import { offerLineItemValidator } from "./schema";
import { recordEvent, formatINR } from "./helpers";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Full revision history of a vendor's offers (the negotiation trajectory). */
export const revisions = query({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const offers = await ctx.db
      .query("offers")
      .withIndex("by_campaign_vendor", (q) =>
        q.eq("campaignVendorId", args.campaignVendorId),
      )
      .order("desc")
      .collect();
    return offers;
  },
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

/**
 * Persist a newly extracted offer revision (doc §28), normalized into a
 * comparable estimated total (doc §14) with visible assumptions.
 */
export const saveOffer = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    vendorId: v.id("vendors"),
    campaignVendorId: v.id("campaignVendors"),
    currency: v.string(),
    lineItems: v.array(offerLineItemValidator),
    taxesIncluded: v.boolean(),
    /** null = vendor never said. */
    travelIncluded: v.union(v.boolean(), v.null()),
    travelAmount: v.optional(v.number()),
    coverageHours: v.optional(v.number()),
    deliverables: v.array(v.string()),
    deliveryTimelineDays: v.optional(v.number()),
    missingFields: v.array(v.string()),
    availability: v.optional(v.boolean()),
    sourceMessageId: v.optional(v.id("messages")),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const cv = await ctx.db.get(args.campaignVendorId);
    const vendor = await ctx.db.get(args.vendorId);
    if (!cv) throw new Error("campaignVendor not found");

    // --- carry forward what this vendor already told us -------------------
    // A negotiation reply normally restates only the price ("we can do
    // ₹34,000 all-inclusive"). Rebuilding the offer from that message alone
    // would erase the coverage, deliverables and timeline agreed two emails
    // ago, so each round would look less complete than the one before it.
    const history = await ctx.db
      .query("offers")
      .withIndex("by_campaign_vendor", (q) =>
        q.eq("campaignVendorId", args.campaignVendorId),
      )
      .collect();
    const latest =
      history.sort((a, b) => b.revisionNumber - a.revisionNumber)[0] ?? null;

    const statedTaxes = !args.missingFields.includes("taxes");
    const knewTaxes = latest ? !latest.missingFields.includes("taxes") : false;

    const merged = {
      taxesIncluded: statedTaxes
        ? args.taxesIncluded
        : (latest?.taxesIncluded ?? false),
      travelIncluded:
        args.travelIncluded !== null
          ? args.travelIncluded
          : (latest?.travelIncluded ?? null),
      travelAmount: args.travelAmount ?? latest?.travelAmount,
      coverageHours: args.coverageHours ?? latest?.coverageHours,
      deliverables:
        args.deliverables.length > 0
          ? args.deliverables
          : (latest?.deliverables ?? []),
      deliveryTimelineDays:
        args.deliveryTimelineDays ?? latest?.deliveryTimelineDays,
    };

    // --- normalize (doc §14) ---------------------------------------------
    const normalization = normalizeOffer({
      lineItems: args.lineItems,
      taxesIncluded: merged.taxesIncluded,
      travelAmount: merged.travelAmount,
      // Explicit "unknown" surfaces an assumption; absent means not tracked.
      ...(merged.travelIncluded === null
        ? { travelIncluded: undefined }
        : { travelIncluded: merged.travelIncluded }),
    });

    // --- completeness (doc §15): which key facts are actually known? -----
    const known = {
      price: normalization.subtotal > 0,
      taxes: statedTaxes || knewTaxes,
      travel: merged.travelIncluded !== null,
      hours: merged.coverageHours !== undefined,
      deliverables: merged.deliverables.length > 0,
      timeline: merged.deliveryTimelineDays !== undefined,
    };
    const knownCount = Object.values(known).filter(Boolean).length;
    const completenessScore = knownCount / Object.keys(known).length;

    // Report what is still unanswered across the whole conversation, not just
    // what the newest email happened to leave out.
    const LABELS: Record<keyof typeof known, string> = {
      price: "exact price",
      taxes: "taxes",
      travel: "travel",
      hours: "coverage hours",
      deliverables: "deliverables",
      timeline: "delivery timeline",
    };
    const tracked = new Set(Object.values(LABELS));
    const missingFields = [
      ...(Object.keys(known) as (keyof typeof known)[])
        .filter((k) => !known[k])
        .map((k) => LABELS[k]),
      ...args.missingFields.filter((f) => !tracked.has(f)),
    ];

    // --- supersede previous active revision -------------------------------
    const previous = await ctx.db
      .query("offers")
      .withIndex("by_campaign_status", (q) =>
        q.eq("campaignId", args.campaignId).eq("status", "active"),
      )
      .filter((q) => q.eq(q.field("campaignVendorId"), args.campaignVendorId))
      .collect();
    for (const old of previous) {
      await ctx.db.patch(old._id, { status: "superseded" });
    }

    const revisionNumber = previous.length > 0
      ? Math.max(...previous.map((p) => p.revisionNumber)) + 1
      : 1;

    const offerId = await ctx.db.insert("offers", {
      campaignId: args.campaignId,
      vendorId: args.vendorId,
      campaignVendorId: args.campaignVendorId,
      revisionNumber,
      currency: args.currency,
      lineItems: args.lineItems,
      subtotal: normalization.subtotal,
      taxAmount: normalization.taxAmount > 0 ? normalization.taxAmount : undefined,
      taxesIncluded: merged.taxesIncluded,
      travelIncluded:
        merged.travelIncluded === null ? undefined : merged.travelIncluded,
      travelAmount: normalization.travelAmount > 0 ? normalization.travelAmount : undefined,
      estimatedTotal: normalization.estimatedTotal,
      assumptions: normalization.assumptions,
      coverageHours: merged.coverageHours,
      deliverables: merged.deliverables,
      deliveryTimelineDays: merged.deliveryTimelineDays,
      completenessScore,
      missingFields,
      status: "active",
      sourceMessageId: args.sourceMessageId,
      extractedAt: Date.now(),
    });

    // --- update the campaign-vendor row -----------------------------------
    const cvPatch: Partial<Doc<"campaignVendors">> = {
      currentOfferId: offerId,
      lastAgentActionAt: Date.now(),
    };
    if (args.availability !== undefined) cvPatch.availability = args.availability;
    await ctx.db.patch(args.campaignVendorId, cvPatch);

    await recordEvent(
      ctx,
      args.campaignId,
      revisionNumber > 1 ? "offer.revised" : "offer.extracted",
      `${vendor?.name ?? "Vendor"} offer ${revisionNumber > 1 ? "revised" : "extracted"}: ${formatINR(normalization.estimatedTotal)} estimated total`,
      args.campaignVendorId,
      { estimatedTotal: normalization.estimatedTotal, revisionNumber },
    );

    return offerId;
  },
});

/**
 * Recompute offer scores for every vendor with an offer (doc §20).
 * Called after any offer/stage change so the leaderboard stays live.
 */
/**
 * Recompute every vendor's offer score for a campaign.
 *
 * Exported as a plain helper so seeds and the live pipeline share one code
 * path: a campaign whose scores were never computed ranks by nothing, and the
 * board silently falls back to "cheapest", which is the exact outcome the
 * scoring rules exist to prevent.
 */
export async function recomputeScoresFor(
  ctx: MutationCtx,
  args: { campaignId: Id<"campaigns"> },
): Promise<void> {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;
    const targetBudget = campaign.spec?.targetBudget ?? campaign.targetBudget;
    const hardBudget = campaign.spec?.hardBudget ?? campaign.hardBudget;
    const requiredRequirements = (campaign.spec?.requirements ?? []).filter(
      (r) => r.kind === "required",
    );

    const cvs = await ctx.db
      .query("campaignVendors")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    for (const cv of cvs) {
      if (!cv.currentOfferId) continue;
      const offer = await ctx.db.get(cv.currentOfferId);
      if (!offer || offer.status !== "active") continue;

      const metrics = await ctx.db
        .query("vendorMetrics")
        .withIndex("by_vendor", (q) => q.eq("vendorId", cv.vendorId))
        .first();
      const historicalReliability =
        metrics && metrics.timesContacted > 0
          ? metrics.replies / metrics.timesContacted
          : 0.5;

      const latency =
        cv.repliedAt && cv.contactedAt ? cv.repliedAt - cv.contactedAt : null;

      const satisfiedRequiredCount = Math.min(
        cv.satisfiedRequirements.filter((id) =>
          requiredRequirements.some((r) => r.id === id || r.label === id),
        ).length,
        requiredRequirements.length,
      );

      const result = scoreOffer({
        estimatedTotal: offer.estimatedTotal,
        targetBudget,
        hardBudget,
        requiredCount: requiredRequirements.length,
        satisfiedRequiredCount,
        availability: cv.availability ?? null,
        completenessScore: offer.completenessScore,
        missingFieldsCount: offer.missingFields.length,
        responseLatencyMs: latency,
        historicalReliability,
      });

    await ctx.db.patch(cv._id, { offerScore: result.score });
  }
}

export const recomputeScores = internalMutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    await recomputeScoresFor(ctx, args);
  },
});

/** Requirement satisfaction updates learned from offer content. */
export const satisfyRequirement = internalMutation({
  args: {
    campaignVendorId: v.id("campaignVendors"),
    requirementId: v.string(),
  },
  handler: async (ctx, args) => {
    const cv = await ctx.db.get(args.campaignVendorId);
    if (!cv) return;
    if (cv.satisfiedRequirements.includes(args.requirementId)) return;
    await ctx.db.patch(args.campaignVendorId, {
      satisfiedRequirements: [...cv.satisfiedRequirements, args.requirementId],
      missingRequirements: cv.missingRequirements.filter(
        (id) => id !== args.requirementId,
      ),
    });
  },
});

export type { Doc };
