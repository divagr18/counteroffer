import { query } from "./_generated/server";

/** The single demo user (no auth for the hackathon). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").first();
  },
});

/**
 * User-side procurement memory (doc §22): deterministic derivation from past
 * selections — categories, price-vs-cheapest behavior, responsiveness of
 * chosen vendors. No LLM involved.
 */
export const memory = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db.query("campaigns").order("desc").take(100);
    const selections: {
      category: string;
      vendorName: string;
      wasCheapestFinalist: boolean;
      responseMs: number | null;
    }[] = [];

    for (const campaign of campaigns) {
      if (!campaign.selectedCampaignVendorId) continue;
      const selected = await ctx.db.get(
        "campaignVendors",
        campaign.selectedCampaignVendorId,
      );
      if (!selected) continue;
      const vendor = await ctx.db.get("vendors", selected.vendorId);
      const selectedOffer = selected.currentOfferId
        ? await ctx.db.get("offers", selected.currentOfferId)
        : null;

      const finalists = await ctx.db
        .query("campaignVendors")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaign._id))
        .filter((q) =>
          q.or(
            q.eq(q.field("stage"), "finalist"),
            q.eq(q.field("stage"), "selected"),
          ),
        )
        .take(50);

      const otherTotals: number[] = [];
      for (const fv of finalists) {
        if (fv._id === selected._id) continue;
        const offer = fv.currentOfferId
          ? await ctx.db.get("offers", fv.currentOfferId)
          : null;
        if (offer) otherTotals.push(offer.estimatedTotal);
      }

      selections.push({
        category: campaign.category,
        vendorName: vendor?.name ?? "Unknown vendor",
        wasCheapestFinalist:
          otherTotals.length === 0 ||
          (selectedOffer
            ? selectedOffer.estimatedTotal <= Math.min(...otherTotals)
            : true),
        responseMs:
          selected.contactedAt && selected.repliedAt
            ? selected.repliedAt - selected.contactedAt
            : null,
      });
    }

    const times = selections
      .map((s) => s.responseMs)
      .filter((x): x is number => x !== null)
      .sort((a, b) => a - b);
    const categoryMap = new Map<string, number>();
    for (const s of selections) {
      categoryMap.set(s.category, (categoryMap.get(s.category) ?? 0) + 1);
    }

    return {
      totalSelections: selections.length,
      nonCheapestSelections: selections.filter((s) => !s.wasCheapestFinalist)
        .length,
      medianSelectedResponseMs:
        times.length > 0 ? times[Math.floor((times.length - 1) / 2)] : null,
      categoryCounts: [...categoryMap.entries()].map(([category, count]) => ({
        category,
        count,
      })),
    };
  },
});
