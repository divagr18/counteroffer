import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Full email thread view for one vendor in a campaign (doc §41). */
export const byCampaignVendor = query({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_campaign_vendor", (q) =>
        q.eq("campaignVendorId", args.campaignVendorId),
      )
      .first();
    if (!thread) return null;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .collect();
    return { thread, messages };
  },
});

export const byExternalThreadId = internalQuery({
  args: { externalThreadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_external", (q) =>
        q.eq("externalThreadId", args.externalThreadId),
      )
      .first();
  },
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

export const ensureThread = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    campaignVendorId: v.id("campaignVendors"),
    externalThreadId: v.string(),
    subject: v.string(),
  },
  handler: async (ctx, args) => {
    const byExternal = await ctx.db
      .query("threads")
      .withIndex("by_external", (q) =>
        q.eq("externalThreadId", args.externalThreadId),
      )
      .first();
    if (byExternal) return byExternal._id;

    const byCv = await ctx.db
      .query("threads")
      .withIndex("by_campaign_vendor", (q) =>
        q.eq("campaignVendorId", args.campaignVendorId),
      )
      .first();
    if (byCv) {
      // Same vendor thread with a new external id — keep one row.
      await ctx.db.patch(byCv._id, { externalThreadId: args.externalThreadId });
      return byCv._id;
    }

    return await ctx.db.insert("threads", {
      campaignId: args.campaignId,
      campaignVendorId: args.campaignVendorId,
      externalThreadId: args.externalThreadId,
      subject: args.subject,
      state: "sent",
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const recordMessage = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    // Dedupe on the external message id (webhook retries + cron polling).
    if (args.externalMessageId) {
      const existing = await ctx.db
        .query("messages")
        .withIndex("by_external", (q) =>
          q.eq("externalMessageId", args.externalMessageId),
        )
        .first();
      if (existing) return { messageId: existing._id, deduped: true };
    }

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      campaignId: args.campaignId,
      direction: args.direction,
      externalMessageId: args.externalMessageId,
      fromAddress: args.fromAddress,
      toAddresses: args.toAddresses,
      subject: args.subject,
      bodyText: args.bodyText,
      extractedText: args.extractedText,
      kind: args.kind,
      agentActionId: args.agentActionId,
      timestamp: args.timestamp,
    });

    await ctx.db.patch(args.threadId, { lastMessageAt: args.timestamp });
    return { messageId, deduped: false };
  },
});

export const setThreadState = internalMutation({
  args: {
    threadId: v.id("threads"),
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, { state: args.state });
  },
});

export type ThreadState =
  | "drafted"
  | "sent"
  | "delivered"
  | "replied"
  | "needs_clarification"
  | "negotiating"
  | "finalized"
  | "closed";

export type { Id };
