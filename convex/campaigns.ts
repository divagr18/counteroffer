import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { campaignSpecValidator, stageValidator } from "./schema";
import { recordEvent } from "./helpers";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getOrCreateDemoUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const existing = await ctx.db.query("users").first();
  if (existing) return existing;
  const id = await ctx.db.insert("users", {
    name: "Demo Buyer",
    email: "demo@counteroffer.app",
    createdAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

export async function campaignCounts(
  ctx: QueryCtx,
  campaignId: Id<"campaigns">,
) {
  const rows = await ctx.db
    .query("campaignVendors")
    .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
    .collect();
  const counts = {
    discovered: 0,
    qualified: 0,
    eliminated: 0,
    contacted: 0,
    replied: 0,
    negotiating: 0,
    finalist: 0,
    selected: 0,
  };
  for (const row of rows) {
    counts[row.stage] += 1;
  }
  // "discovered" counter shown to the user includes everything found.
  const discoveredTotal = rows.length;
  return { ...counts, discoveredTotal };
}

async function currentOfferSummary(
  ctx: QueryCtx,
  campaignVendorId: Id<"campaignVendors">,
): Promise<Doc<"offers"> | null> {
  const cv = await ctx.db.get(campaignVendorId);
  if (!cv?.currentOfferId) return null;
  return await ctx.db.get(cv.currentOfferId);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("campaigns").order("desc").take(50);
    return Promise.all(
      campaigns.map(async (campaign) => ({
        campaign,
        counts: await campaignCounts(ctx, campaign._id),
        bestOffer: await bestOfferForCampaign(ctx, campaign._id),
      })),
    );
  },
});

async function bestOfferForCampaign(
  ctx: QueryCtx,
  campaignId: Id<"campaigns">,
) {
  const offers = await ctx.db
    .query("offers")
    .withIndex("by_campaign_status", (q) =>
      q.eq("campaignId", campaignId).eq("status", "active"),
    )
    .collect();
  if (offers.length === 0) return null;

  // "Best" = highest offer score, not cheapest — an incomplete lowball must not surface as best.
  const scored = await Promise.all(
    offers.map(async (offer) => {
      const cv = await ctx.db
        .query("campaignVendors")
        .withIndex("by_campaign_vendor", (q) =>
          q.eq("campaignId", campaignId).eq("vendorId", offer.vendorId),
        )
        .first();
      return { offer, score: cv?.offerScore ?? -1, stage: cv?.stage };
    }),
  );
  const eligible = scored.filter((s) => s.stage !== "eliminated");
  const pool = eligible.length > 0 ? eligible : scored;
  pool.sort(
    (a, b) => b.score - a.score || a.offer.estimatedTotal - b.offer.estimatedTotal,
  );
  const best = pool[0].offer;
  const vendor = await ctx.db.get(best.vendorId);
  return { offer: best, vendorName: vendor?.name ?? "Unknown vendor" };
}

export const get = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return null;
    const mailbox = campaign.mailboxId
      ? await ctx.db.get(campaign.mailboxId)
      : null;
    const counts = await campaignCounts(ctx, args.campaignId);
    const approvals = await ctx.db
      .query("approvalRequests")
      .withIndex("by_campaign_status", (q) =>
        q.eq("campaignId", args.campaignId).eq("status", "pending"),
      )
      .collect();
    const best = await bestOfferForCampaign(ctx, args.campaignId);
    return { campaign, mailbox, counts, approvals, bestOffer: best };
  },
});

/** Everything the live campaign pipeline view needs. */
export const pipeline = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const cvs = await ctx.db
      .query("campaignVendors")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    const rows = await Promise.all(
      cvs.map(async (cv) => {
        const vendor = await ctx.db.get(cv.vendorId);
        const offer = await currentOfferSummary(ctx, cv._id);
        const revisions = await ctx.db
          .query("offers")
          .withIndex("by_campaign_vendor", (q) =>
            q.eq("campaignVendorId", cv._id),
          )
          .collect();
        const firstOffer =
          revisions.find((o) => o.revisionNumber === 1) ?? null;
        const thread = await ctx.db
          .query("threads")
          .withIndex("by_campaign_vendor", (q) =>
            q.eq("campaignVendorId", cv._id),
          )
          .first();
        return { cv, vendor, offer, firstOffer, thread };
      }),
    );
    // Rank by offer score (desc), then estimated total (asc).
    rows.sort((a, b) => {
      const sa = a.cv.offerScore ?? -1;
      const sb = b.cv.offerScore ?? -1;
      if (sb !== sa) return sb - sa;
      const ta = a.offer?.estimatedTotal ?? Number.MAX_SAFE_INTEGER;
      const tb = b.offer?.estimatedTotal ?? Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
    return rows;
  },
});

export const campaignVendorDetail = query({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const cv = await ctx.db.get(args.campaignVendorId);
    if (!cv) return null;
    const vendor = await ctx.db.get(cv.vendorId);
    const campaign = await ctx.db.get(cv.campaignId);
    const mailbox = campaign?.mailboxId
      ? await ctx.db.get(campaign.mailboxId)
      : null;
    const offer = cv.currentOfferId
      ? await ctx.db.get(cv.currentOfferId)
      : null;
    return { cv, vendor, mailbox, offer };
  },
});

export const activity = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("campaignEvents")
      .withIndex("by_campaign_created", (q) =>
        q.eq("campaignId", args.campaignId),
      )
      .order("desc")
      .take(80);
    return events;
  },
});

/** Internal: look up a mailbox by its AgentMail inbox id (webhook routing). */
export const mailboxByInboxId = internalQuery({
  args: { inboxId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mailboxes")
      .withIndex("by_inboxId", (q) => q.eq("inboxId", args.inboxId))
      .first();
  },
});

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

export const createDraft = mutation({
  args: { description: v.string() },
  handler: async (ctx, args) => {
    if (args.description.trim().length < 8) {
      throw new Error("Describe what you need in a little more detail.");
    }
    const user = await getOrCreateDemoUser(ctx);
    const now = Date.now();
    const campaignId = await ctx.db.insert("campaigns", {
      userId: user._id,
      title: "New campaign",
      category: "general",
      description: args.description.trim(),
      status: "draft",
      location: "",
      currency: "INR",
      targetBudget: 0,
      hardBudget: 0,
      permissions: {
        outreach: "auto",
        clarification: "auto",
        negotiation: "auto",
        selection: "ask",
      },
      createdAt: now,
      updatedAt: now,
    });
    await recordEvent(ctx, campaignId, "campaign.created", "Campaign created");
    // Kick the parsing agent immediately.
    await ctx.scheduler.runAfter(0, internal.agents.parseRequest, {
      campaignId,
    });
    return campaignId;
  },
});

export const updateSpec = mutation({
  args: {
    campaignId: v.id("campaigns"),
    title: v.string(),
    spec: campaignSpecValidator,
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await ctx.db.patch(args.campaignId, {
      title: args.title,
      spec: args.spec,
      location: args.spec.location,
      currency: args.spec.currency,
      targetBudget: args.spec.targetBudget,
      hardBudget: args.spec.hardBudget,
      category: args.spec.category,
      status: "requirements_review",
      updatedAt: Date.now(),
    });
    await recordEvent(
      ctx,
      args.campaignId,
      "requirements.confirmed",
      `Requirements confirmed: ${args.spec.requirements.filter((r) => r.kind === "required").length} required, budget ${args.spec.currency} ${args.spec.targetBudget.toLocaleString("en-IN")}–${args.spec.hardBudget.toLocaleString("en-IN")}`,
    );
  },
});

export const startSourcing = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.spec) throw new Error("Confirm requirements first");
    await ctx.db.patch(args.campaignId, {
      status: "sourcing",
      updatedAt: Date.now(),
    });
    await recordEvent(
      ctx,
      args.campaignId,
      "sourcing.started",
      "Sourcing started — searching the web for vendors",
    );
    await ctx.scheduler.runAfter(0, internal.agents.runDiscovery, {
      campaignId: args.campaignId,
    });
  },
});

/**
 * Start (or resume) vendor outreach for a campaign that already has qualified
 * vendors. Surfaced as the "Contact vendors" button so a pre-qualified
 * campaign can be driven entirely from the UI.
 */
export const contactVendors = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.spec) throw new Error("Confirm requirements first");

    const qualified = await ctx.db
      .query("campaignVendors")
      .withIndex("by_campaign_stage", (q) =>
        q.eq("campaignId", args.campaignId).eq("stage", "qualified"),
      )
      .collect();
    if (qualified.length === 0) return { started: false, qualified: 0 };

    await ctx.db.patch(args.campaignId, {
      status: "active",
      updatedAt: Date.now(),
    });
    await recordEvent(
      ctx,
      args.campaignId,
      "outreach.started",
      `Contacting ${qualified.length} qualified vendor${qualified.length === 1 ? "" : "s"}`,
    );
    await ctx.scheduler.runAfter(0, internal.agents.startOutreach, {
      campaignId: args.campaignId,
    });
    return { started: true, qualified: qualified.length };
  },
});

export const resolveApproval = mutation({
  args: { approvalId: v.id("approvalRequests"), approve: v.boolean() },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval || approval.status !== "pending") return;
    await ctx.db.patch(args.approvalId, {
      status: args.approve ? "approved" : "rejected",
      resolvedAt: Date.now(),
    });
    await recordEvent(
      ctx,
      approval.campaignId,
      args.approve ? "approval.granted" : "approval.rejected",
      `${approval.kind} ${args.approve ? "approved" : "rejected"} by user`,
      approval.campaignVendorId,
    );
    if (!args.approve) return;

    if (approval.kind === "send_outreach") {
      await ctx.scheduler.runAfter(0, internal.agents.startOutreach, {
        campaignId: approval.campaignId,
      });
    } else if (approval.kind === "select_finalist") {
      const cvId = approval.campaignVendorId;
      if (cvId) {
        await ctx.scheduler.runAfter(0, internal.agents.confirmSelection, {
          campaignVendorId: cvId,
        });
      }
    }
  },
});

export const selectVendor = mutation({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const cv = await ctx.db.get(args.campaignVendorId);
    if (!cv) throw new Error("Not found");
    const campaign = await ctx.db.get(cv.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.permissions.selection === "ask") {
      const existing = await ctx.db
        .query("approvalRequests")
        .withIndex("by_campaign_status", (q) =>
          q.eq("campaignId", cv.campaignId).eq("status", "pending"),
        )
        .filter((q) => q.eq(q.field("kind"), "select_finalist"))
        .first();
      if (!existing) {
        await ctx.db.insert("approvalRequests", {
          campaignId: cv.campaignId,
          campaignVendorId: cv._id,
          kind: "select_finalist",
          status: "pending",
          createdAt: Date.now(),
        });
        await recordEvent(
          ctx,
          cv.campaignId,
          "approval.requested",
          "Your approval is needed to select this vendor",
          cv._id,
        );
      }
      return;
    }
    await ctx.scheduler.runAfter(0, internal.agents.confirmSelection, {
      campaignVendorId: cv._id,
    });
  },
});

export const closeCampaign = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    await ctx.db.patch(args.campaignId, {
      status: "closed",
      updatedAt: Date.now(),
    });
    await recordEvent(ctx, args.campaignId, "campaign.closed", "Campaign closed");
    await ctx.scheduler.runAfter(0, internal.agents.finalizeMetrics, {
      campaignId: args.campaignId,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (called by agent actions / webhooks)
// ---------------------------------------------------------------------------

export const updateStatus = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    status: v.union(
      v.literal("draft"),
      v.literal("requirements_review"),
      v.literal("sourcing"),
      v.literal("active"),
      v.literal("finalists"),
      v.literal("selected"),
      v.literal("closed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.campaignId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const setMailbox = internalMutation({
  args: { campaignId: v.id("campaigns"), mailboxId: v.id("mailboxes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.campaignId, { mailboxId: args.mailboxId });
  },
});

export const addEvent = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    campaignVendorId: v.optional(v.id("campaignVendors")),
    type: v.string(),
    summary: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await recordEvent(
      ctx,
      args.campaignId,
      args.type,
      args.summary,
      args.campaignVendorId,
      args.payload,
    );
  },
});

export const setStageInternal = internalMutation({
  args: {
    campaignVendorId: v.id("campaignVendors"),
    stage: stageValidator,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cv = await ctx.db.get(args.campaignVendorId);
    if (!cv) return;
    const patch: Partial<Doc<"campaignVendors">> = { stage: args.stage };
    if (args.stage === "eliminated" && args.reason) {
      patch.eliminationReason = args.reason;
    }
    if (args.stage === "contacted" && !cv.contactedAt) {
      patch.contactedAt = Date.now();
    }
    if (args.stage === "replied" && !cv.repliedAt) {
      patch.repliedAt = Date.now();
    }
    patch.lastAgentActionAt = Date.now();
    await ctx.db.patch(args.campaignVendorId, patch);
  },
});

export type { Doc };
