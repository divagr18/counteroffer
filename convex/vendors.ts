import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizeName, recordEvent } from "./helpers";
import { pricingSignalValidator } from "./schema";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const get = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) return null;
    const evidence = await ctx.db
      .query("vendorEvidence")
      .withIndex("by_vendor", (q) => q.eq("vendorId", args.vendorId))
      .order("desc")
      .take(30);
    const metrics = await ctx.db
      .query("vendorMetrics")
      .withIndex("by_vendor", (q) => q.eq("vendorId", args.vendorId))
      .first();
    return { vendor, evidence, metrics };
  },
});

/** The private supplier network: every known vendor + accumulated history. */
export const network = query({
  args: {},
  handler: async (ctx) => {
    const vendors = await ctx.db.query("vendors").order("desc").take(100);
    return Promise.all(
      vendors.map(async (vendor) => ({
        vendor,
        metrics: await ctx.db
          .query("vendorMetrics")
          .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
          .first(),
      })),
    );
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (!args.query.trim()) return [];
    return await ctx.db
      .query("vendors")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .take(20);
  },
});

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

/**
 * Entity resolution (doc §9): merge discovery candidates into canonical
 * vendors by domain → email → normalized name. Returns the canonical vendor
 * and this campaign's pipeline row, and whether this candidate was merged
 * into an already-known vendor.
 */
export const upsertCandidate = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.string(),
    canonicalDomain: v.optional(v.string()),
    website: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    description: v.optional(v.string()),
    services: v.array(v.string()),
    locations: v.array(v.string()),
    pricingSignals: v.array(pricingSignalValidator),
    sourceUrl: v.string(),
    confidence: v.number(),
    isDemoVendor: v.optional(v.boolean()),
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // --- find an existing canonical vendor -------------------------------
    let vendor = null as Awaited<ReturnType<typeof ctx.db.get<"vendors">>>;
    if (args.canonicalDomain) {
      vendor = await ctx.db
        .query("vendors")
        .withIndex("by_canonicalDomain", (q) =>
          q.eq("canonicalDomain", args.canonicalDomain),
        )
        .first();
    }
    if (!vendor && args.email) {
      vendor = await ctx.db
        .query("vendors")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();
    }
    if (!vendor) {
      const candidateNorm = normalizeName(args.name);
      if (candidateNorm.length > 0) {
        const all = await ctx.db.query("vendors").take(300);
        vendor =
          all.find(
            (x) =>
              normalizeName(x.name) === candidateNorm ||
              x.aliases.some((a) => normalizeName(a) === candidateNorm),
          ) ?? null;
      }
    }

    let merged = false;
    let vendorId: Id<"vendors">;

    if (vendor) {
      // Merge new evidence into the canonical record.
      merged = true;
      const aliases = vendor.aliases.slice();
      if (
        normalizeName(vendor.name) !== normalizeName(args.name) &&
        !aliases.some((a) => normalizeName(a) === normalizeName(args.name))
      ) {
        aliases.push(args.name);
      }
      const sourceUrls = vendor.sourceUrls.includes(args.sourceUrl)
        ? vendor.sourceUrls
        : [...vendor.sourceUrls, args.sourceUrl];
      const pricingSignals = vendor.pricingSignals.slice();
      for (const signal of args.pricingSignals) {
        if (
          !pricingSignals.some(
            (s) => s.value === signal.value && s.source === signal.source,
          )
        ) {
          pricingSignals.push(signal);
        }
      }
      const services = Array.from(
        new Set([...vendor.services, ...args.services]),
      );
      const locations = Array.from(
        new Set([...vendor.locations, ...args.locations]),
      );
      await ctx.db.patch(vendor._id, {
        aliases,
        sourceUrls,
        pricingSignals,
        services,
        locations,
        email: vendor.email ?? args.email,
        phone: vendor.phone ?? args.phone,
        website: vendor.website ?? args.website,
        description: vendor.description ?? args.description,
        updatedAt: now,
      });
      vendorId = vendor._id;
    } else {
      vendorId = await ctx.db.insert("vendors", {
        name: args.name,
        canonicalDomain: args.canonicalDomain,
        category: "general",
        description: args.description,
        locations: args.locations,
        services: args.services,
        pricingSignals: args.pricingSignals,
        email: args.email,
        phone: args.phone,
        website: args.website,
        aliases: [],
        sourceUrls: [args.sourceUrl],
        confidence: args.confidence,
        isDemoVendor: args.isDemoVendor ?? false,
        demoBehavior: args.demoBehavior,
        createdAt: now,
        updatedAt: now,
      });
    }

    // --- link into this campaign's pipeline ------------------------------
    let campaignVendor = await ctx.db
      .query("campaignVendors")
      .withIndex("by_campaign_vendor", (q) =>
        q.eq("campaignId", args.campaignId).eq("vendorId", vendorId),
      )
      .first();

    let campaignVendorId: Id<"campaignVendors">;
    if (campaignVendor) {
      campaignVendorId = campaignVendor._id;
    } else {
      campaignVendorId = await ctx.db.insert("campaignVendors", {
        campaignId: args.campaignId,
        vendorId,
        stage: "discovered",
        qualificationScore: 0,
        satisfiedRequirements: [],
        missingRequirements: [],
        createdAt: now,
      });
    }

    return { vendorId, campaignVendorId, merged };
  },
});

export const attachEvidence = internalMutation({
  args: {
    vendorId: v.id("vendors"),
    claim: v.string(),
    sourceUrl: v.string(),
    snippet: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("vendorEvidence", {
      vendorId: args.vendorId,
      claim: args.claim,
      sourceUrl: args.sourceUrl,
      snippet: args.snippet.slice(0, 1500),
      confidence: args.confidence,
      createdAt: Date.now(),
    });
  },
});

/** Qualification decision (doc §10) with a visible reason when rejected. */
export const setQualification = internalMutation({
  args: {
    campaignVendorId: v.id("campaignVendors"),
    qualified: v.boolean(),
    score: v.number(),
    satisfied: v.array(v.string()),
    missing: v.array(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cv = await ctx.db.get(args.campaignVendorId);
    if (!cv || cv.stage !== "discovered") return;
    await ctx.db.patch(args.campaignVendorId, {
      qualificationScore: args.score,
      satisfiedRequirements: args.satisfied,
      missingRequirements: args.missing,
      stage: args.qualified ? "qualified" : "eliminated",
      eliminationReason: args.qualified ? undefined : (args.reason ?? "low fit"),
      lastAgentActionAt: Date.now(),
    });
    const vendor = await ctx.db.get(cv.vendorId);
    await recordEvent(
      ctx,
      cv.campaignId,
      args.qualified ? "vendor.qualified" : "vendor.rejected",
      args.qualified
        ? `${vendor?.name ?? "Vendor"} qualified (score ${Math.round(args.score)})`
        : `${vendor?.name ?? "Vendor"} rejected: ${args.reason ?? "low fit"}`,
      cv._id,
    );
  },
});

export const updateContactability = internalMutation({
  args: {
    vendorId: v.id("vendors"),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: { email?: string; phone?: string } = {};
    if (args.email) patch.email = args.email;
    if (args.phone) patch.phone = args.phone;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.vendorId, patch);
    }
  },
});
