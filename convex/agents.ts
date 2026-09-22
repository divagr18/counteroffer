// The autonomous procurement controller (doc §30-31): an event-driven agent
// loop implemented as Convex internal actions chained via the scheduler.
//
//   parseRequest → runDiscovery → qualify → setupMailbox/startOutreach
//   → sendRfq → [inbound reply] → processInbound → saveOffer
//   → sendClarification | negotiate → finalists → selection
//
// LLM calls produce drafts/extractions; deterministic code (lib/) enforces
// every hard constraint (budget, stage machine, no fabricated competitors).

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { completeJson, smartModel } from "./openai";
import {
  firecrawlScrapeJson,
  firecrawlSearch,
  type FirecrawlSearchResult,
} from "./firecrawl";
import {
  createInbox,
  getThread,
  listInboundMessages,
  registerWebhook,
  replyToMessage,
  sendMessage,
} from "./agentmail";
import {
  emailDraftSchema,
  procurementRequestSchema,
  replyParseSchema,
  searchPlanSchema,
  vendorExtractionSchema,
  type EmailDraft,
  type ExtractedVendor,
  type ParsedProcurementRequest,
  type ParsedReply,
  type SearchPlan,
} from "./lib/llmSchemas";
import { decideNegotiation } from "./lib/negotiate";
import { rateLimiter, retrier } from "./lib/components";
import { runIdValidator, runResultValidator } from "@convex-dev/action-retrier";
import { formatINR, randomSlug } from "./helpers";
import {
  CLARIFICATION_SYSTEM,
  NEGOTIATION_SYSTEM,
  PARSE_REQUEST_SYSTEM,
  REPLY_PARSE_SYSTEM,
  RFQ_DRAFT_SYSTEM,
  SEARCH_PLAN_SYSTEM,
} from "./lib/prompts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Email transport.
 *
 * Defaults to "mock": nothing is handed to AgentMail, no inbox is created, and
 * every vendor answers from the scripted persona engine through the real
 * parsing/negotiation pipeline. Real businesses are discovered from the live
 * web, so the safe default has to be the one that cannot email them.
 *
 * Set the EMAIL_TRANSPORT deployment variable to "live" to actually send.
 */
function emailTransport(): "mock" | "live" {
  return process.env.EMAIL_TRANSPORT === "live" ? "live" : "mock";
}

/** True when this vendor's mail is simulated rather than delivered. */
function isSimulated(vendor: Doc<"vendors">): boolean {
  return vendor.isDemoVendor || emailTransport() === "mock";
}

/**
 * Outbound-email throttle (@convex-dev/rate-limiter).
 *
 * Real businesses are on the other end of these sends, so politeness is
 * enforced here rather than trusted to a prompt. A suppressed send is written
 * to the activity feed so it is visible instead of silently vanishing.
 *
 * The per-vendor bucket applies only when an email actually leaves the
 * building. Scripted demo vendors run the same pipeline with local transport,
 * so throttling them would only slow the demo without protecting anyone.
 */
async function canSendEmail(
  ctx: ActionCtx,
  campaignId: Id<"campaigns">,
  vendor: Doc<"vendors">,
  campaignVendorId?: Id<"campaignVendors">,
): Promise<boolean> {
  if (!isSimulated(vendor)) {
    const perVendor = await rateLimiter.limit(ctx, "vendorEmail", {
      key: vendor._id,
    });
    if (!perVendor.ok) {
      const minutes = Math.max(1, Math.ceil((perVendor.retryAfter ?? 0) / 60000));
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId,
        campaignVendorId,
        type: "email.throttled",
        summary: `Held back an email to ${vendor.name} — per-vendor limit reached, retry in ${minutes} min`,
      });
      return false;
    }
  }

  const perCampaign = await rateLimiter.limit(ctx, "campaignEmail", {
    key: campaignId,
  });
  if (!perCampaign.ok) {
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId,
      campaignVendorId,
      type: "email.throttled",
      summary: "Campaign hourly email limit reached — outbound mail paused",
    });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Internal mutations hosted here (agent-side bookkeeping)
// ---------------------------------------------------------------------------

export const recordCrawlJob = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("crawlJobs", {
      campaignId: args.campaignId,
      kind: args.kind,
      query: args.query,
      url: args.url,
      status: args.status,
      resultCount: args.resultCount,
      error: args.error,
      createdAt: Date.now(),
      finishedAt: Date.now(),
    });
  },
});

export const createApproval = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    campaignVendorId: v.optional(v.id("campaignVendors")),
    kind: v.union(
      v.literal("select_finalist"),
      v.literal("share_personal_details"),
      v.literal("send_outreach"),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("approvalRequests")
      .withIndex("by_campaign_status", (q) =>
        q.eq("campaignId", args.campaignId).eq("status", "pending"),
      )
      .filter((q) => q.eq(q.field("kind"), args.kind))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("approvalRequests", {
      campaignId: args.campaignId,
      campaignVendorId: args.campaignVendorId,
      kind: args.kind,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// 1. Parse the natural-language request (doc §5.1)
// ---------------------------------------------------------------------------

export const parseRequest = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.runQuery(api.campaigns.get, {
      campaignId: args.campaignId,
    });
    if (!campaign || campaign.campaign.spec) return;

    let parsed: ParsedProcurementRequest;
    try {
      parsed = await completeJson<ParsedProcurementRequest>({
        system: PARSE_REQUEST_SYSTEM,
        user: campaign.campaign.description,
        schemaName: "procurement_request",
        schema: procurementRequestSchema,
      });
    } catch (err) {
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        type: "request.parse_failed",
        summary: `Could not parse request: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    const spec = {
      category: parsed.category,
      location: parsed.location,
      targetDate: parsed.target_date ?? undefined,
      quantity: parsed.quantity ?? undefined,
      budgetType: parsed.budget_type,
      targetBudget: parsed.target_budget,
      hardBudget: Math.max(parsed.hard_budget, parsed.target_budget),
      currency: parsed.currency,
      requirements: parsed.requirements.map((r, i) => ({
        id: `req-${i}`,
        label: r.label,
        kind: r.kind,
      })),
      negotiable: parsed.negotiable,
    };

    await ctx.runMutation(api.campaigns.updateSpec, {
      campaignId: args.campaignId,
      title: parsed.title,
      spec,
    });
    await ctx.runMutation(internal.campaigns.updateStatus, {
      campaignId: args.campaignId,
      status: "requirements_review",
    });
  },
});

// ---------------------------------------------------------------------------
// 2. Discovery + enrichment (doc §7-8)
// ---------------------------------------------------------------------------

const MAX_ENRICHMENTS = 18;
const ENRICH_PACING_MS = 4000;

export const runDiscovery = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(api.campaigns.get, {
      campaignId: args.campaignId,
    });
    const campaign = data?.campaign;
    const spec = campaign?.spec;
    if (!campaign || !spec) return;

    // Firecrawl search + enrichment is the paid path. Throttle per campaign so
    // a repeated Start-sourcing click cannot re-crawl the web on our bill.
    const allowed = await rateLimiter.limit(ctx, "discoveryRun", {
      key: args.campaignId,
    });
    if (!allowed.ok) {
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        type: "discovery.throttled",
        summary: `Discovery already ran for this campaign — next crawl available in ${Math.max(1, Math.ceil((allowed.retryAfter ?? 0) / 60000))} min`,
      });
      return;
    }

    // --- search plan -----------------------------------------------------
    let plan: SearchPlan;
    try {
      plan = await completeJson<SearchPlan>({
        system: SEARCH_PLAN_SYSTEM,
        user: JSON.stringify({
          category: spec.category,
          location: spec.location,
          date: spec.targetDate ?? null,
          budget: `${spec.currency} ${spec.targetBudget}-${spec.hardBudget}`,
        }),
        schemaName: "search_plan",
        schema: searchPlanSchema,
      });
    } catch (err) {
      plan = {
        queries: [
          `${spec.category} ${spec.location}`,
          `best ${spec.category} in ${spec.location}`,
          `${spec.category} price ${spec.location}`,
          `${spec.category} services near ${spec.location}`,
        ],
        include_domains: [],
      };
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        type: "discovery.plan_fallback",
        summary: `Search planner fell back to defaults (${err instanceof Error ? err.message : String(err)})`,
      });
    }

    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: args.campaignId,
      type: "discovery.planned",
      summary: `Search plan ready: ${plan.queries.length} queries`,
      payload: plan.queries,
    });

    // --- execute searches --------------------------------------------------
    const seenUrls = new Set<string>();
    const candidates: FirecrawlSearchResult[] = [];
    for (const queryText of plan.queries.slice(0, 5)) {
      try {
        const results = await firecrawlSearch({
          query: queryText,
          limit: 8,
          country: "IN",
          location: spec.location,
          includeDomains:
            plan.include_domains.length > 0
              ? plan.include_domains
              : undefined,
        });
        await ctx.runMutation(internal.agents.recordCrawlJob, {
          campaignId: args.campaignId,
          kind: "search",
          query: queryText,
          status: "done",
          resultCount: results.length,
        });
        for (const r of results) {
          const key = r.url.replace(/[#?].*$/, "").replace(/\/$/, "");
          if (seenUrls.has(key)) continue;
          seenUrls.add(key);
          candidates.push(r);
        }
        await ctx.runMutation(internal.campaigns.addEvent, {
          campaignId: args.campaignId,
          type: "discovery.search_done",
          summary: `"${queryText}" → ${results.length} results (${candidates.length} unique total)`,
        });
      } catch (err) {
        await ctx.runMutation(internal.agents.recordCrawlJob, {
          campaignId: args.campaignId,
          kind: "search",
          query: queryText,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: args.campaignId,
      type: "discovery.candidates",
      summary: `${candidates.length} candidate URLs found — enriching top ${Math.min(candidates.length, MAX_ENRICHMENTS)}`,
    });

    // --- enrich candidates sequentially (rate-limit friendly) -------------
    const toEnrich = candidates.slice(0, MAX_ENRICHMENTS);
    for (let i = 0; i < toEnrich.length; i++) {
      if (i > 0) await sleep(ENRICH_PACING_MS);
      await enrichCandidate(ctx, args.campaignId, toEnrich[i], spec.category, spec.location);
    }

    await ctx.runMutation(internal.campaigns.updateStatus, {
      campaignId: args.campaignId,
      status: "active",
    });
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: args.campaignId,
      type: "discovery.finished",
      summary: "Discovery complete",
    });

    // --- move straight into outreach ---------------------------------------
    const fresh = await ctx.runQuery(api.campaigns.get, {
      campaignId: args.campaignId,
    });
    if (!fresh) return;
    if (fresh.campaign.permissions.outreach === "auto") {
      await ctx.scheduler.runAfter(2000, internal.agents.startOutreach, {
        campaignId: args.campaignId,
      });
    } else {
      await ctx.runMutation(internal.agents.createApproval, {
        campaignId: args.campaignId,
        kind: "send_outreach",
      });
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        type: "approval.requested",
        summary: "Approval requested to begin vendor outreach",
      });
    }
  },
});

async function enrichCandidate(
  ctx: ActionCtx,
  campaignId: Id<"campaigns">,
  candidate: FirecrawlSearchResult,
  category: string,
  location: string,
): Promise<void> {
  let domain: string | undefined;
  try {
    domain = new URL(candidate.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    domain = undefined;
  }

  const scrape = await firecrawlScrapeJson<ExtractedVendor>({
    url: candidate.url,
    schema: vendorExtractionSchema,
    prompt: `Extract the business information of the vendor on this page. Category of interest: ${category}. Location of interest: ${location}. Only extract what the page actually states; use null / empty arrays when absent.`,
  });

  if (scrape.error) {
    await ctx.runMutation(internal.agents.recordCrawlJob, {
      campaignId,
      kind: "scrape",
      url: candidate.url,
      status: "failed",
      error: scrape.error,
    });
    return;
  }

  const extracted = scrape.json;
  const name =
    extracted?.name ??
    candidate.title.split(/[|—–-]/)[0]?.trim() ??
    null;
  if (!name || name.length < 2) return;

  const upserted = await ctx.runMutation(internal.vendors.upsertCandidate, {
    campaignId,
    name,
    canonicalDomain: domain,
    website: extracted?.website ?? candidate.url,
    email: extracted?.emails[0],
    phone: extracted?.phones[0],
    description: extracted?.description ?? candidate.description,
    services: extracted?.services ?? [],
    locations: extracted?.locations ?? [],
    pricingSignals: (extracted?.pricing_signals ?? []).map((p) => ({
      value: p.value,
      currency: p.currency,
      source: p.source || "website",
    })),
    sourceUrl: candidate.url,
    confidence: extracted?.confidence ?? 0.5,
  });
  if (!upserted) return;

  await ctx.runMutation(internal.agents.recordCrawlJob, {
    campaignId,
    kind: "scrape",
    url: candidate.url,
    status: "done",
    resultCount: 1,
  });

  // Evidence rows ("Why do we think this?" — doc §8).
  const services = (extracted?.services ?? []).slice(0, 4).join(", ");
  if (services) {
    await ctx.runMutation(internal.vendors.attachEvidence, {
      vendorId: upserted.vendorId,
      claim: `Offers services: ${services}`,
      sourceUrl: candidate.url,
      snippet: candidate.description || candidate.title,
      confidence: extracted?.confidence ?? 0.5,
    });
  }
  for (const signal of (extracted?.pricing_signals ?? []).slice(0, 2)) {
    await ctx.runMutation(internal.vendors.attachEvidence, {
      vendorId: upserted.vendorId,
      claim: `Pricing signal: ${signal.currency} ${signal.value} (${signal.source})`,
      sourceUrl: candidate.url,
      snippet: candidate.description || candidate.title,
      confidence: 0.6,
    });
  }

  await ctx.runMutation(internal.campaigns.addEvent, {
    campaignId,
    campaignVendorId: upserted.campaignVendorId,
    type: upserted.merged ? "vendor.merged" : "vendor.discovered",
    summary: upserted.merged
      ? `${name} matched a known vendor — records merged`
      : `Discovered ${name}`,
  });

  await qualifyVendorNow(ctx, upserted.campaignVendorId);
}

// ---------------------------------------------------------------------------
// 3. Qualification (doc §10) — deterministic, explainable
// ---------------------------------------------------------------------------

async function qualifyVendorNow(
  ctx: ActionCtx,
  campaignVendorId: Id<"campaignVendors">,
): Promise<void> {
  const bundle = await ctx.runQuery(
    internal.agents.campaignVendorBundleQuery,
    { campaignVendorId },
  );
  if (!bundle) return;
  const { vendor, campaign } = bundle;
  const spec = campaign.spec;
  if (!spec) return;

  let score = 0;
  const reasons: string[] = [];

  const hasEmail = Boolean(vendor.email);
  if (hasEmail) score += 35;
  else reasons.push("no contact path");

  // Geographic fit.
  const city = spec.location.split(",")[0]!.trim().toLowerCase();
  const locationHit = vendor.locations.some((l) =>
    l.toLowerCase().includes(city),
  );
  if (locationHit) score += 20;
  else if (vendor.locations.length === 0) score += 10;

  // Budget plausibility from public pricing signals.
  const signals = vendor.pricingSignals;
  if (signals.length > 0) {
    const min = Math.min(...signals.map((s) => s.value));
    if (min <= campaign.hardBudget * 1.2) score += 20;
    else if (min > campaign.hardBudget * 1.5) {
      reasons.push("outside budget");
    } else {
      score += 8;
    }
  } else {
    score += 10;
  }

  // Service/category fit.
  const categoryWords = campaign.category.toLowerCase().split(/\s+/);
  const serviceHit = vendor.services.some((s) => {
    const sl = s.toLowerCase();
    return categoryWords.some((w) => w.length > 3 && sl.includes(w));
  });
  if (serviceHit) score += 15;

  if (vendor.confidence >= 0.6) score += 10;

  // Initial requirement satisfaction: keyword overlap (explainable).
  const satisfied: string[] = [];
  const missing: string[] = [];
  const haystack = [
    ...vendor.services,
    vendor.description ?? "",
    ...vendor.pricingSignals.map((p) => p.source),
  ]
    .join(" ")
    .toLowerCase();
  for (const req of spec.requirements) {
    if (req.kind !== "required") continue;
    const words = req.label
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (words.length > 0 && words.some((w) => haystack.includes(w))) {
      satisfied.push(req.id);
    } else {
      missing.push(req.id);
    }
  }

  const qualified = hasEmail && score >= 50 && !reasons.includes("outside budget");
  await ctx.runMutation(internal.vendors.setQualification, {
    campaignVendorId,
    qualified,
    score,
    satisfied,
    missing,
    reason: qualified ? undefined : (reasons[0] ?? "low fit"),
  });
}

export const cvBundleQuery = internalQuery({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args): Promise<CvBundle | null> => {
    const cv = await ctx.db.get(args.campaignVendorId);
    if (!cv) return null;
    const vendor = await ctx.db.get(cv.vendorId);
    if (!vendor) return null;
    const campaign = await ctx.db.get(cv.campaignId);
    if (!campaign) return null;
    const mailbox = campaign.mailboxId
      ? await ctx.db.get(campaign.mailboxId)
      : null;
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_campaign_vendor", (q) =>
        q.eq("campaignVendorId", cv._id),
      )
      .first();
    const messages = thread
      ? await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
          .order("asc")
          .collect()
      : [];
    return { cv, vendor, campaign, mailbox, thread, messages };
  },
});

async function loadCvBundle(
  ctx: ActionCtx,
  campaignVendorId: Id<"campaignVendors">,
): Promise<CvBundle | null> {
  return await ctx.runQuery(internal.agents.cvBundleQuery, {
    campaignVendorId,
  });
}

export const campaignVendorBundleQuery = internalQuery({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    cv: Doc<"campaignVendors">;
    vendor: Doc<"vendors">;
    campaign: Doc<"campaigns">;
  } | null> => {
    const cv = await ctx.db.get(args.campaignVendorId);
    if (!cv) return null;
    const vendor = await ctx.db.get(cv.vendorId);
    if (!vendor) return null;
    const campaign = await ctx.db.get(cv.campaignId);
    if (!campaign) return null;
    return { cv, vendor, campaign };
  },
});

export const getOfferQuery = internalQuery({
  args: { offerId: v.id("offers") },
  handler: async (ctx, args): Promise<Doc<"offers"> | null> => {
    return await ctx.db.get(args.offerId);
  },
});

export const messageKnownQuery = internalQuery({
  args: { externalMessageId: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_external", (q) =>
        q.eq("externalMessageId", args.externalMessageId),
      )
      .first();
    return existing !== null;
  },
});

// ---------------------------------------------------------------------------
// 4. Outreach (doc §12): mailbox + personalized RFQs
// ---------------------------------------------------------------------------

export const setupMailbox = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(api.campaigns.get, {
      campaignId: args.campaignId,
    });
    if (!data || data.mailbox) return;

    const slug = randomSlug(6);

    if (emailTransport() === "mock") {
      // Simulated inbox: same shape, same UI, no provider call and no webhook.
      const mailboxId = await ctx.runMutation(internal.agents.insertMailbox, {
        campaignId: args.campaignId,
        inboxId: `mock-${args.campaignId.slice(-6)}-${slug}`,
        email: `camp-${args.campaignId.slice(-6)}-${slug}@sandbox.agentmail.to`,
      });
      await ctx.runMutation(internal.campaigns.setMailbox, {
        campaignId: args.campaignId,
        mailboxId,
      });
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        type: "mailbox.created",
        summary: `Campaign inbox created (simulated): camp-${args.campaignId.slice(-6)}-${slug}@sandbox.agentmail.to`,
      });
      return;
    }

    const inbox = await createInbox({
      username: `camp-${args.campaignId.slice(-6)}-${slug}`,
      displayName: "Counteroffer",
      clientId: `campaign-${args.campaignId}`,
      metadata: { campaignId: args.campaignId },
    });

    const siteUrl = process.env.CONVEX_SITE_URL;
    let webhook: { webhookId: string; secret: string } | null = null;
    if (siteUrl) {
      try {
        webhook = await registerWebhook({
          inboxId: inbox.inboxId,
          url: `${siteUrl}/agentmail-webhook`,
          clientId: `campaign-${args.campaignId}-webhook`,
        });
      } catch {
        webhook = null; // cron polling remains as fallback
      }
    }

    const mailboxId = await ctx.runMutation(internal.agents.insertMailbox, {
      campaignId: args.campaignId,
      inboxId: inbox.inboxId,
      email: inbox.email,
      webhookId: webhook?.webhookId,
      webhookSecret: webhook?.secret,
    });
    await ctx.runMutation(internal.campaigns.setMailbox, {
      campaignId: args.campaignId,
      mailboxId,
    });
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: args.campaignId,
      type: "mailbox.created",
      summary: `Campaign inbox created: ${inbox.email}`,
    });
  },
});

export const insertMailbox = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    inboxId: v.string(),
    email: v.string(),
    webhookId: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mailboxes", {
      campaignId: args.campaignId,
      inboxId: args.inboxId,
      email: args.email,
      webhookId: args.webhookId,
      webhookSecret: args.webhookSecret,
      createdAt: Date.now(),
    });
  },
});

const MAX_OUTREACH = 12;

export const startOutreach = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.agents.setupMailbox, {
      campaignId: args.campaignId,
    });

    const rows = await ctx.runQuery(api.campaigns.pipeline, {
      campaignId: args.campaignId,
    });
    const qualified = rows
      .filter(
        (r): r is typeof r & { vendor: NonNullable<typeof r.vendor> } =>
          r.cv.stage === "qualified" && r.vendor !== null && Boolean(r.vendor.email),
      )
      .sort((a, b) => b.cv.qualificationScore - a.cv.qualificationScore)
      .slice(0, MAX_OUTREACH);

    if (qualified.length === 0) {
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        type: "outreach.no_candidates",
        summary: "No qualified vendors with a contact path yet",
      });
      return;
    }

    // Staggered 12s apart so a burst of RFQs never looks like a blast, and
    // each one goes through the action retrier so a transient AgentMail or
    // OpenAI failure does not silently cost us a vendor.
    for (let i = 0; i < qualified.length; i++) {
      await ctx.scheduler.runAfter(i * 12000, internal.agents.enqueueRfq, {
        campaignVendorId: qualified[i].cv._id,
      });
    }
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: args.campaignId,
      type: "outreach.started",
      summary: `Sending tailored RFQs to ${qualified.length} qualified vendors`,
    });
  },
});

/**
 * Hands one RFQ to the action retrier. Scheduled (not called directly) so the
 * 12s stagger between vendors survives, while each send gets up to four
 * attempts with exponential backoff.
 */
export const enqueueRfq = internalMutation({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    await retrier.run(
      ctx,
      internal.agents.sendRfq,
      { campaignVendorId: args.campaignVendorId },
      { onComplete: internal.agents.rfqAttemptFinished },
    );
  },
});

/**
 * Runs once the retrier stops, however it stopped. Without this a vendor that
 * exhausted its retries just sits in "qualified" forever with nothing in the
 * activity feed to say why.
 */
export const rfqAttemptFinished = internalMutation({
  args: { runId: runIdValidator, result: runResultValidator },
  handler: async (ctx, args) => {
    if (args.result.type === "success") return;
    const reason =
      args.result.type === "failed" ? args.result.error : "canceled";
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    for (const campaign of campaigns) {
      await ctx.db.insert("campaignEvents", {
        campaignId: campaign._id,
        type: "outreach.failed",
        summary: `An RFQ could not be sent after repeated attempts: ${reason.slice(0, 160)}`,
        createdAt: Date.now(),
      });
    }
  },
});

export const sendRfq = internalAction({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const row = await loadCvBundle(ctx, args.campaignVendorId);
    if (!row) return;
    const { cv, vendor, campaign, mailbox } = row;
    if (!vendor.email || !mailbox) return;
    if (cv.stage !== "qualified") return;
    const spec = campaign.spec;
    if (!spec) return;

    if (!(await canSendEmail(ctx, campaign._id, vendor, cv._id))) return;

    const draft = await completeJson<EmailDraft>({
      system: RFQ_DRAFT_SYSTEM,
      user: JSON.stringify({
        vendor_name: vendor.name,
        vendor_services: vendor.services.slice(0, 4),
        need: campaign.description,
        category: spec.category,
        location: spec.location,
        date: spec.targetDate ?? null,
        quantity: spec.quantity ?? null,
        requirements: spec.requirements.map((r) => `${r.label} (${r.kind})`),
        budget_hint: `${spec.currency} ${spec.targetBudget.toLocaleString("en-IN")} target, up to ${spec.hardBudget.toLocaleString("en-IN")} maximum`,
      }),
      schemaName: "email_draft",
      schema: emailDraftSchema,
      temperature: 0.7,
    });

    if (isSimulated(vendor)) {
      // Same pipeline, simulated transport (doc §49).
      const externalThreadId = `demo-${cv._id}`;
      const threadId = await ctx.runMutation(internal.threads.ensureThread, {
        campaignId: campaign._id,
        campaignVendorId: cv._id,
        externalThreadId,
        subject: draft.subject,
      });
      await ctx.runMutation(internal.threads.recordMessage, {
        threadId,
        campaignId: campaign._id,
        direction: "outbound",
        externalMessageId: `demo-out-${Date.now()}-${randomSlug(4)}`,
        fromAddress: mailbox.email,
        toAddresses: [vendor.email],
        subject: draft.subject,
        bodyText: draft.body,
        kind: "rfq",
        timestamp: Date.now(),
      });
      scheduleDemoReply(ctx, cv._id, vendor.demoBehavior ?? defaultBehavior(vendor), demoReplyDelay(vendor.demoBehavior ?? defaultBehavior(vendor)));
    } else {
      const sent = await sendMessage({
        inboxId: mailbox.inboxId,
        to: [vendor.email],
        subject: draft.subject,
        text: draft.body,
        labels: ["rfq", `campaign-${campaign._id}`],
      });
      const threadId = await ctx.runMutation(internal.threads.ensureThread, {
        campaignId: campaign._id,
        campaignVendorId: cv._id,
        externalThreadId: sent.threadId,
        subject: draft.subject,
      });
      await ctx.runMutation(internal.threads.recordMessage, {
        threadId,
        campaignId: campaign._id,
        direction: "outbound",
        externalMessageId: sent.messageId,
        fromAddress: mailbox.email,
        toAddresses: [vendor.email],
        subject: draft.subject,
        bodyText: draft.body,
        kind: "rfq",
        timestamp: Date.now(),
      });
      await ctx.runMutation(internal.threads.setThreadState, {
        threadId,
        state: "sent",
      });
    }

    // Marked contacted only once the email has actually left, so a retried
    // attempt after a transient send failure still delivers.
    await ctx.runMutation(internal.campaigns.setStageInternal, {
      campaignVendorId: cv._id,
      stage: "contacted",
    });

    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: campaign._id,
      campaignVendorId: cv._id,
      type: "outreach.sent",
      summary: `RFQ sent to ${vendor.name}${isSimulated(vendor) ? "" : " (live email)"}`,
    });
  },
});

// ---------------------------------------------------------------------------
// 5. Inbound processing (doc §13-15): parse → normalize → decide
// ---------------------------------------------------------------------------

export const processInbound = internalAction({
  args: {
    campaignId: v.id("campaigns"),
    externalThreadId: v.optional(v.string()),
    externalMessageId: v.optional(v.string()),
    fromAddress: v.string(),
    subject: v.string(),
    text: v.string(),
    extractedText: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const campaignData = await ctx.runQuery(api.campaigns.get, {
      campaignId: args.campaignId,
    });
    if (!campaignData) return;
    const campaign = campaignData.campaign;
    const spec = campaign.spec;
    const mailbox = campaignData.mailbox;

    // --- route to a campaign vendor --------------------------------------
    let routed = await ctx.runQuery(internal.agents.routeInbound, {
      campaignId: args.campaignId,
      externalThreadId: args.externalThreadId,
      fromAddress: args.fromAddress,
    });
    if (!routed) {
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        type: "message.orphan",
        summary: `Unroutable email from ${args.fromAddress}`,
      });
      return;
    }

    // Full body fallback (webhook payloads >1MB drop text).
    let bodyText = args.extractedText ?? args.text;
    if ((!bodyText || bodyText.length < 10) && mailbox && args.externalThreadId) {
      try {
        const thread = await getThread({
          inboxId: mailbox.inboxId,
          threadId: args.externalThreadId,
        });
        const lastInbound = thread?.messages
          .filter((m) => m.from !== mailbox.email)
          .pop();
        bodyText = lastInbound?.extractedText ?? lastInbound?.text ?? bodyText;
      } catch {
        // keep whatever we have
      }
    }

    const threadId = await ctx.runMutation(internal.threads.ensureThread, {
      campaignId: args.campaignId,
      campaignVendorId: routed.campaignVendorId,
      externalThreadId: args.externalThreadId ?? `adhoc-${args.fromAddress}`,
      subject: args.subject,
    });

    const recorded = await ctx.runMutation(internal.threads.recordMessage, {
      threadId,
      campaignId: args.campaignId,
      direction: "inbound",
      externalMessageId: args.externalMessageId,
      fromAddress: args.fromAddress,
      toAddresses: mailbox ? [mailbox.email] : [],
      subject: args.subject,
      bodyText,
      extractedText: args.extractedText,
      kind: "vendor_reply",
      timestamp: args.timestamp ?? Date.now(),
    });
    if (recorded.deduped) return;

    await ctx.runMutation(internal.threads.setThreadState, {
      threadId,
      state: "replied",
    });

    const vendor = routed.vendor;
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: args.campaignId,
      campaignVendorId: routed.campaignVendorId,
      type: "message.received",
      summary: `${vendor?.name ?? "Vendor"} replied`,
    });

    // Stage: contacted → replied.
    if (routed.stage === "contacted") {
      await ctx.runMutation(internal.campaigns.setStageInternal, {
        campaignVendorId: routed.campaignVendorId,
        stage: "replied",
      });
    }

    if (!spec) return;

    // --- parse the reply ---------------------------------------------------
    let parsed: ParsedReply;
    try {
      parsed = await completeJson<ParsedReply>({
        system: REPLY_PARSE_SYSTEM,
        user: JSON.stringify({
          original_request: campaign.description,
          requirements: spec.requirements.map((r) => `${r.label} (${r.kind})`),
          date: spec.targetDate ?? null,
          quantity: spec.quantity ?? null,
          reply_subject: args.subject,
          reply_body: bodyText,
        }),
        schemaName: "parsed_reply",
        schema: replyParseSchema,
      });
    } catch (err) {
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        campaignVendorId: routed.campaignVendorId,
        type: "reply.parse_failed",
        summary: `Reply parse failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    // --- branch on intent ---------------------------------------------------
    if (parsed.intent === "unavailable" || parsed.intent === "declined") {
      await ctx.runMutation(internal.campaigns.setStageInternal, {
        campaignVendorId: routed.campaignVendorId,
        stage: "eliminated",
        reason: parsed.intent === "unavailable" ? "not available" : "declined",
      });
      await ctx.runMutation(internal.campaigns.addEvent, {
        campaignId: args.campaignId,
        campaignVendorId: routed.campaignVendorId,
        type: "vendor.eliminated",
        summary: `${vendor?.name ?? "Vendor"} is ${parsed.intent === "unavailable" ? "not available" : "declining"}`,
      });
      return;
    }
    if (parsed.intent === "unrelated" || parsed.intent === "acknowledgement") {
      return;
    }

    // --- persist offer revision ---------------------------------------------
    let offerId: Id<"offers"> | null = null;
    if (parsed.line_items.length > 0) {
      const missing = [...parsed.missing_fields];
      if (parsed.taxes_included === null && !missing.includes("taxes")) {
        missing.push("taxes");
      }
      if (parsed.travel_included === null && !missing.includes("travel")) {
        missing.push("travel");
      }
      offerId = await ctx.runMutation(internal.offers.saveOffer, {
        campaignId: args.campaignId,
        vendorId: routed.vendorId,
        campaignVendorId: routed.campaignVendorId,
        currency: parsed.currency || spec.currency,
        lineItems: parsed.line_items.map((li) => ({
          label: li.label,
          quantity: li.quantity,
          unitPrice: li.unit_price,
          totalPrice: li.total_price,
          required: li.required,
          included: li.included,
          isAddon: li.is_addon,
        })),
        taxesIncluded: parsed.taxes_included === true,
        travelIncluded: parsed.travel_included,
        travelAmount: parsed.travel_amount ?? undefined,
        coverageHours: parsed.coverage_hours ?? undefined,
        deliverables: parsed.deliverables,
        deliveryTimelineDays: parsed.delivery_timeline_days ?? undefined,
        missingFields: missing,
        availability: parsed.available ?? undefined,
        sourceMessageId: recorded.messageId,
        confidence: parsed.confidence,
      });
      await ctx.runMutation(internal.offers.recomputeScores, {
        campaignId: args.campaignId,
      });
    }

    if (parsed.available === false) {
      await ctx.runMutation(internal.campaigns.setStageInternal, {
        campaignVendorId: routed.campaignVendorId,
        stage: "eliminated",
        reason: "not available for the requested date",
      });
      return;
    }

    // --- decide next move -----------------------------------------------------
    const offer = offerId
      ? await ctx.runQuery(internal.agents.getOfferQuery, { offerId })
      : null;
    const permissions = campaign.permissions;

    if (!offer) {
      // Reply without pricing → ask for a quote.
      if (permissions.clarification === "auto") {
        await ctx.scheduler.runAfter(
          20_000,
          internal.agents.sendClarification,
          { campaignVendorId: routed.campaignVendorId },
        );
      }
      return;
    }

    if (offer.missingFields.length > 0 && permissions.clarification === "auto") {
      await ctx.scheduler.runAfter(
        25_000,
        internal.agents.sendClarification,
        { campaignVendorId: routed.campaignVendorId },
      );
      return;
    }

    await evaluateNegotiation(ctx, routed.campaignVendorId);
  },
});

export const routeInbound = internalQuery({
  args: {
    campaignId: v.id("campaigns"),
    externalThreadId: v.optional(v.string()),
    fromAddress: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    campaignVendorId: Id<"campaignVendors">;
    vendorId: Id<"vendors">;
    vendor: Doc<"vendors"> | null;
    stage: Doc<"campaignVendors">["stage"];
  } | null> => {
    const rows = await ctx.runQuery(api.campaigns.pipeline, {
      campaignId: args.campaignId,
    });

    if (args.externalThreadId) {
      const byThread = rows.find(
        (r) => r.thread?.externalThreadId === args.externalThreadId,
      );
      if (byThread) {
        return {
          campaignVendorId: byThread.cv._id,
          vendorId: byThread.cv.vendorId,
          vendor: byThread.vendor,
          stage: byThread.cv.stage,
        };
      }
    }
    const from = args.fromAddress.trim().toLowerCase();
    const bySender = rows.find(
      (r) => r.vendor?.email?.toLowerCase() === from,
    );
    if (bySender) {
      return {
        campaignVendorId: bySender.cv._id,
        vendorId: bySender.cv.vendorId,
        vendor: bySender.vendor,
        stage: bySender.cv.stage,
      };
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// 6. Clarification follow-ups (doc §15)
// ---------------------------------------------------------------------------

const MAX_CLARIFICATIONS = 2;

export const sendClarification = internalAction({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const row = await loadCvBundle(ctx, args.campaignVendorId);
    if (!row) return;
    const { cv, vendor, campaign, mailbox, thread, messages } = row;
    if (!mailbox) return;
    if (campaign.permissions.clarification !== "auto") return;

    const clarificationsSent = messages.filter(
      (m) => m.kind === "clarification",
    ).length;
    if (clarificationsSent >= MAX_CLARIFICATIONS) {
      // Don't pester — evaluate with what we have.
      await evaluateNegotiation(ctx, cv._id);
      return;
    }
    if (!(await canSendEmail(ctx, campaign._id, vendor, cv._id))) return;

    const offer = cv.currentOfferId
      ? await ctx.runQuery(api.offers.revisions, {
          campaignVendorId: cv._id,
        }).then((r) => r[0] ?? null)
      : null;

    const missing =
      offer && offer.missingFields.length > 0
        ? offer.missingFields
        : ["complete price including taxes", "availability", "exact deliverables"];

    const draft = await completeJson<EmailDraft>({
      system: CLARIFICATION_SYSTEM,
      user: JSON.stringify({
        vendor_name: vendor.name,
        missing_fields: missing,
        context: campaign.description,
      }),
      schemaName: "email_draft",
      schema: emailDraftSchema,
      temperature: 0.4,
    });

    const subject = thread?.subject ?? `Following up — ${campaign.title}`;
    const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");

    if (isSimulated(vendor)) {
      if (!thread) return;
      await ctx.runMutation(internal.threads.recordMessage, {
        threadId: thread._id,
        campaignId: campaign._id,
        direction: "outbound",
        externalMessageId: `demo-out-${Date.now()}-${randomSlug(4)}`,
        fromAddress: mailbox.email,
        toAddresses: [vendor.email ?? "demo@vendor.local"],
        subject,
        bodyText: draft.body,
        kind: "clarification",
        timestamp: Date.now(),
      });
      scheduleDemoReply(ctx, cv._id, vendor.demoBehavior ?? defaultBehavior(vendor), 20_000 + Math.floor(Math.random() * 15_000));
    } else {
      let ref: { messageId: string; threadId: string };
      if (lastInbound?.externalMessageId) {
        ref = await replyToMessage({
          inboxId: mailbox.inboxId,
          messageId: lastInbound.externalMessageId,
          text: draft.body,
        });
      } else {
        ref = await sendMessage({
          inboxId: mailbox.inboxId,
          to: [vendor.email!],
          subject,
          text: draft.body,
        });
      }
      if (thread) {
        await ctx.runMutation(internal.threads.recordMessage, {
          threadId: thread._id,
          campaignId: campaign._id,
          direction: "outbound",
          externalMessageId: ref.messageId,
          fromAddress: mailbox.email,
          toAddresses: [vendor.email!],
          subject,
          bodyText: draft.body,
          kind: "clarification",
          timestamp: Date.now(),
        });
      }
    }

    if (thread) {
      await ctx.runMutation(internal.threads.setThreadState, {
        threadId: thread._id,
        state: "needs_clarification",
      });
    }
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: campaign._id,
      campaignVendorId: cv._id,
      type: "clarification.sent",
      summary: `Follow-up sent to ${vendor.name} asking about: ${missing.join(", ")}`,
    });
  },
});

// ---------------------------------------------------------------------------
// 7. Negotiation (doc §16-17) — deterministic policy, LLM wording only
// ---------------------------------------------------------------------------

export const negotiate = internalAction({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    await evaluateNegotiation(ctx, args.campaignVendorId);
  },
});

async function evaluateNegotiation(
  ctx: ActionCtx,
  campaignVendorId: Id<"campaignVendors">,
): Promise<void> {
  const row = await loadCvBundle(ctx, campaignVendorId);
  if (!row) return;
  const { cv, vendor, campaign, mailbox, thread, messages } = row;
  const spec = campaign.spec;
  if (!spec || !cv.currentOfferId) return;
  if (cv.stage === "eliminated" || cv.stage === "finalist" || cv.stage === "selected") return;

  const revisions = await ctx.runQuery(api.offers.revisions, {
    campaignVendorId,
  });
  const offer = revisions[0];
  if (!offer) return;

  // Hard budget guard — deterministic, before any LLM involvement.
  if (offer.estimatedTotal > campaign.hardBudget) {
    await ctx.runMutation(internal.campaigns.setStageInternal, {
      campaignVendorId,
      stage: "eliminated",
      reason: `estimated total ${formatINR(offer.estimatedTotal)} exceeds hard budget ${formatINR(campaign.hardBudget)}`,
    });
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: campaign._id,
      campaignVendorId,
      type: "vendor.eliminated",
      summary: `${vendor.name} eliminated: over hard budget`,
    });
    return;
  }

  if (offer.estimatedTotal <= spec.targetBudget) {
    await ctx.runMutation(internal.campaigns.setStageInternal, {
      campaignVendorId,
      stage: "finalist",
    });
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: campaign._id,
      campaignVendorId,
      type: "offer.within_target",
      summary: `${vendor.name} is at/below target: ${formatINR(offer.estimatedTotal)}`,
    });
    return;
  }

  if (campaign.permissions.negotiation !== "auto") {
    await ctx.runMutation(internal.campaigns.setStageInternal, {
      campaignVendorId,
      stage: "finalist",
    });
    return;
  }

  // Real competing offers only — never fabricated (doc §16).
  const pipelineRows = await ctx.runQuery(api.campaigns.pipeline, {
    campaignId: campaign._id,
  });
  const competing = pipelineRows
    .filter(
      (r) =>
        r.cv._id !== campaignVendorId &&
        r.offer &&
        r.offer.status === "active" &&
        r.cv.stage !== "eliminated",
    )
    .map((r) => r.offer!.estimatedTotal);
  const bestCompetingOffer =
    competing.length > 0 ? Math.min(...competing) : null;

  const round = messages.filter((m) => m.kind === "counteroffer").length + 1;
  const decision = decideNegotiation({
    currentQuote: offer.estimatedTotal,
    targetPrice: spec.targetBudget,
    hardMax: campaign.hardBudget,
    bestCompetingOffer,
    round,
    maxRounds: 3,
  });

  if (decision.action === "accept") {
    await ctx.runMutation(internal.campaigns.setStageInternal, {
      campaignVendorId,
      stage: "finalist",
    });
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: campaign._id,
      campaignVendorId,
      type: "negotiation.target_met",
      summary: `${vendor.name} met the target at ${formatINR(offer.estimatedTotal)}`,
    });
    return;
  }
  if (decision.action === "walk_away") {
    await ctx.runMutation(internal.campaigns.setStageInternal, {
      campaignVendorId,
      stage: "eliminated",
      reason: "over hard budget after negotiation",
    });
    return;
  }
  if (decision.action === "hold") {
    await ctx.runMutation(internal.campaigns.setStageInternal, {
      campaignVendorId,
      stage: "finalist",
    });
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: campaign._id,
      campaignVendorId,
      type: "negotiation.hold",
      summary: `Negotiation with ${vendor.name} complete — best offer ${formatINR(offer.estimatedTotal)} presented for your decision`,
    });
    return;
  }

  // --- counter --------------------------------------------------------------
  const counterAmount = decision.counterAmount!;
  const draft = await completeJson<EmailDraft>({
    model: smartModel(),
    system: NEGOTIATION_SYSTEM,
    user: JSON.stringify({
      vendor_name: vendor.name,
      their_current_quote: offer.estimatedTotal,
      counter_amount_to_state: counterAmount,
      rationale: decision.rationale,
      competing_offer: bestCompetingOffer,
      requirements_summary: spec.requirements
        .map((r) => r.label)
        .slice(0, 5),
    }),
    schemaName: "email_draft",
    schema: emailDraftSchema,
    temperature: 0.5,
  });

  if (!mailbox || !thread) return;
  if (!(await canSendEmail(ctx, campaign._id, vendor, campaignVendorId))) return;
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");

  if (isSimulated(vendor)) {
    await ctx.runMutation(internal.threads.recordMessage, {
      threadId: thread._id,
      campaignId: campaign._id,
      direction: "outbound",
      externalMessageId: `demo-out-${Date.now()}-${randomSlug(4)}`,
      fromAddress: mailbox.email,
      toAddresses: [vendor.email ?? "demo@vendor.local"],
      subject: thread.subject,
      bodyText: draft.body,
      kind: "counteroffer",
      timestamp: Date.now(),
    });
    scheduleDemoReply(ctx, cv._id, vendor.demoBehavior ?? defaultBehavior(vendor), 20_000 + Math.floor(Math.random() * 20_000));
  } else {
    let ref: { messageId: string; threadId: string };
    if (lastInbound?.externalMessageId) {
      ref = await replyToMessage({
        inboxId: mailbox.inboxId,
        messageId: lastInbound.externalMessageId,
        text: draft.body,
      });
    } else {
      ref = await sendMessage({
        inboxId: mailbox.inboxId,
        to: [vendor.email!],
        subject: thread.subject,
        text: draft.body,
      });
    }
    await ctx.runMutation(internal.threads.recordMessage, {
      threadId: thread._id,
      campaignId: campaign._id,
      direction: "outbound",
      externalMessageId: ref.messageId,
      fromAddress: mailbox.email,
      toAddresses: [vendor.email!],
      subject: thread.subject,
      bodyText: draft.body,
      kind: "counteroffer",
      timestamp: Date.now(),
    });
  }

  await ctx.runMutation(internal.campaigns.setStageInternal, {
    campaignVendorId,
    stage: "negotiating",
  });
  if (thread) {
    await ctx.runMutation(internal.threads.setThreadState, {
      threadId: thread._id,
      state: "negotiating",
    });
  }
  await ctx.runMutation(internal.campaigns.addEvent, {
    campaignId: campaign._id,
    campaignVendorId,
    type: "negotiation.counter",
    summary: `Counter sent to ${vendor.name}: ${formatINR(counterAmount)} (from ${formatINR(offer.estimatedTotal)})`,
  });
}

// ---------------------------------------------------------------------------
// 8. Selection + metrics (doc §21)
// ---------------------------------------------------------------------------

export const confirmSelection = internalAction({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const row = await loadCvBundle(ctx, args.campaignVendorId);
    if (!row) return;
    const { cv, vendor, campaign } = row;
    if (cv.stage === "eliminated" || cv.stage === "selected") return;

    await ctx.runMutation(internal.campaigns.setStageInternal, {
      campaignVendorId: cv._id,
      stage: "finalist",
    });
    await ctx.runMutation(internal.agents.markSelected, {
      campaignVendorId: cv._id,
    });
    await ctx.runMutation(internal.campaigns.updateStatus, {
      campaignId: campaign._id,
      status: "selected",
    });
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: campaign._id,
      campaignVendorId: cv._id,
      type: "vendor.selected",
      summary: `${vendor.name} selected as the winner`,
    });
  },
});

export const markSelected = internalMutation({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const cv = await ctx.db.get(args.campaignVendorId);
    if (!cv) return;
    await ctx.db.patch(args.campaignVendorId, { stage: "selected" });
    await ctx.db.patch(cv.campaignId, {
      selectedCampaignVendorId: args.campaignVendorId,
      updatedAt: Date.now(),
    });
  },
});

/** Cross-campaign vendor intelligence (doc §21) — computed at close. */
export const finalizeMetrics = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const rows = await ctx.runQuery(api.campaigns.pipeline, {
      campaignId: args.campaignId,
    });
    for (const row of rows) {
      const { cv } = row;
      if (cv.stage === "discovered" || cv.stage === "qualified") continue;
      await ctx.runMutation(internal.agents.upsertVendorMetrics, {
        vendorId: cv.vendorId,
        replied: cv.repliedAt !== undefined,
        responseMs:
          cv.repliedAt && cv.contactedAt
            ? cv.repliedAt - cv.contactedAt
            : undefined,
        initialQuote: undefined,
        finalQuote: undefined,
        selected: cv.stage === "selected",
      });

      // Initial vs final quote for the discount stat.
      const revisions = await ctx.runQuery(api.offers.revisions, {
        campaignVendorId: cv._id,
      });
      if (revisions.length > 0) {
        const initial = revisions[revisions.length - 1];
        const final = revisions[0];
        await ctx.runMutation(internal.agents.upsertVendorMetrics, {
          vendorId: cv.vendorId,
          replied: false,
          initialQuote: initial.estimatedTotal,
          finalQuote: final.estimatedTotal,
          selected: false,
        });
      }
    }
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: args.campaignId,
      type: "metrics.updated",
      summary: "Vendor intelligence updated from this campaign",
    });
  },
});

export const upsertVendorMetrics = internalMutation({
  args: {
    vendorId: v.id("vendors"),
    replied: v.boolean(),
    responseMs: v.optional(v.number()),
    initialQuote: v.optional(v.number()),
    finalQuote: v.optional(v.number()),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vendorMetrics")
      .withIndex("by_vendor", (q) => q.eq("vendorId", args.vendorId))
      .first();

    if (!existing) {
      await ctx.db.insert("vendorMetrics", {
        vendorId: args.vendorId,
        campaignsSeen: 1,
        timesContacted: 1,
        replies: args.replied ? 1 : 0,
        medianResponseMs: args.responseMs,
        medianInitialQuote: args.initialQuote,
        medianFinalQuote: args.finalQuote,
        typicalDiscountPct:
          args.initialQuote && args.finalQuote && args.initialQuote > 0
            ? ((args.initialQuote - args.finalQuote) / args.initialQuote) * 100
            : undefined,
        timesSelected: args.selected ? 1 : 0,
        updatedAt: Date.now(),
      });
      return;
    }

    const blend = (old: number | undefined, next: number | undefined) =>
      old === undefined ? next : next === undefined ? old : (old + next) / 2;

    await ctx.db.patch(existing._id, {
      campaignsSeen: existing.campaignsSeen + 1,
      timesContacted: existing.timesContacted + 1,
      replies: existing.replies + (args.replied ? 1 : 0),
      medianResponseMs: blend(existing.medianResponseMs, args.responseMs),
      medianInitialQuote: blend(existing.medianInitialQuote, args.initialQuote),
      medianFinalQuote: blend(existing.medianFinalQuote, args.finalQuote),
      typicalDiscountPct:
        existing.medianInitialQuote && existing.medianFinalQuote
          ? Math.max(
              0,
              ((existing.medianInitialQuote - existing.medianFinalQuote) /
                existing.medianInitialQuote) *
                100,
            )
          : existing.typicalDiscountPct,
      timesSelected: existing.timesSelected + (args.selected ? 1 : 0),
      updatedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// 9. Cron safety nets: inbox polling + stall detection
// ---------------------------------------------------------------------------

export const pollAllInboxes = internalAction({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.runQuery(api.campaigns.list, {});
    for (const entry of campaigns) {
      const status = entry.campaign.status;
      if (
        !entry.campaign.mailboxId ||
        (status !== "active" && status !== "sourcing" && status !== "finalists")
      ) {
        continue;
      }
      await ctx.runAction(internal.agents.pollInbox, {
        campaignId: entry.campaign._id,
      });
    }
  },
});

export const pollInbox = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(api.campaigns.get, {
      campaignId: args.campaignId,
    });
    const mailbox = data?.mailbox;
    if (!mailbox) return;

    let inbound: Awaited<ReturnType<typeof listInboundMessages>>;
    try {
      inbound = await listInboundMessages({
        inboxId: mailbox.inboxId,
        limit: 20,
      });
    } catch {
      return;
    }
    for (const msg of inbound) {
      if (!msg.messageId) continue;
      const known = await ctx.runQuery(internal.agents.messageKnownQuery, {
        externalMessageId: msg.messageId,
      });
      if (known) continue;
      // Fetch full text (list only carries previews).
      let text = msg.text;
      try {
        const thread = await getThread({
          inboxId: mailbox.inboxId,
          threadId: msg.threadId,
        });
        const mine = thread?.messages.find((m) => m.messageId === msg.messageId);
        text = mine?.extractedText ?? mine?.text ?? text;
      } catch {
        // preview only
      }
      await ctx.runAction(internal.agents.processInbound, {
        campaignId: args.campaignId,
        externalThreadId: msg.threadId,
        externalMessageId: msg.messageId,
        fromAddress: msg.from,
        subject: msg.subject,
        text,
        timestamp: msg.timestamp ? Date.parse(msg.timestamp) : Date.now(),
      });
    }
  },
});

export const followUpAllActive = internalAction({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.runQuery(api.campaigns.list, {});
    for (const entry of campaigns) {
      const status = entry.campaign.status;
      if (status !== "active" && status !== "finalists") continue;
      await ctx.runAction(internal.agents.followUpStalled, {
        campaignId: entry.campaign._id,
      });
    }
  },
});

export const followUpStalled = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    const rows = await ctx.runQuery(api.campaigns.pipeline, {
      campaignId: args.campaignId,
    });
    const now = Date.now();
    const STALE_MS = 6 * 60 * 60 * 1000;
    for (const row of rows) {
      const { cv, vendor } = row;
      if (cv.stage !== "contacted" || !vendor) continue;
      const since = cv.contactedAt ?? cv.lastAgentActionAt ?? 0;
      if (now - since < STALE_MS) continue;
      const bundle = await loadCvBundle(ctx, cv._id);
      const nudged = (bundle?.messages ?? []).some(
        (m) => m.kind === "follow_up",
      );
      if (nudged) continue;
      await ctx.scheduler.runAfter(0, internal.agents.sendNudge, {
        campaignVendorId: cv._id,
      });
    }
  },
});

export const sendNudge = internalAction({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const row = await loadCvBundle(ctx, args.campaignVendorId);
    if (!row) return;
    const { cv, vendor, campaign, mailbox, thread } = row;
    if (!mailbox || !thread || cv.stage !== "contacted") return;
    if (!(await canSendEmail(ctx, campaign._id, vendor, cv._id))) return;

    const body = `Hi ${vendor.name},\n\nJust following up on my earlier request for a quote — we're finalizing our shortlist. Could you share availability and your complete price including taxes when you get a moment?\n\nThank you.`;

    if (isSimulated(vendor)) {
      await ctx.runMutation(internal.threads.recordMessage, {
        threadId: thread._id,
        campaignId: campaign._id,
        direction: "outbound",
        externalMessageId: `demo-out-${Date.now()}-${randomSlug(4)}`,
        fromAddress: mailbox.email,
        toAddresses: [vendor.email ?? "demo@vendor.local"],
        subject: thread.subject,
        bodyText: body,
        kind: "follow_up",
        timestamp: Date.now(),
      });
      if ((vendor.demoBehavior ?? "") !== "ghost") {
        scheduleDemoReply(ctx, cv._id, vendor.demoBehavior ?? defaultBehavior(vendor), 30_000);
      }
    } else if (vendor.email) {
      const ref = await sendMessage({
        inboxId: mailbox.inboxId,
        to: [vendor.email],
        subject: thread.subject,
        text: body,
      });
      await ctx.runMutation(internal.threads.recordMessage, {
        threadId: thread._id,
        campaignId: campaign._id,
        direction: "outbound",
        externalMessageId: ref.messageId,
        fromAddress: mailbox.email,
        toAddresses: [vendor.email],
        subject: thread.subject,
        bodyText: body,
        kind: "follow_up",
        timestamp: Date.now(),
      });
    }
    await ctx.runMutation(internal.campaigns.addEvent, {
      campaignId: campaign._id,
      campaignVendorId: cv._id,
      type: "follow_up.sent",
      summary: `Nudge sent to ${vendor.name}`,
    });
  },
});

// ---------------------------------------------------------------------------
// Demo vendor universe (doc §49): scripted behaviors, real pipeline
// ---------------------------------------------------------------------------

function demoReplyDelay(behavior: string): number {
  switch (behavior) {
    case "negotiator":
      return 30_000 + Math.floor(Math.random() * 20_000);
    case "standard":
      return 45_000 + Math.floor(Math.random() * 20_000);
    case "hidden_fees":
      return 50_000 + Math.floor(Math.random() * 20_000);
    case "cheapest_incomplete":
      return 40_000 + Math.floor(Math.random() * 20_000);
    case "premium":
      return 70_000 + Math.floor(Math.random() * 30_000);
    case "decliner":
      return 35_000 + Math.floor(Math.random() * 15_000);
    case "slow":
      return 180_000 + Math.floor(Math.random() * 60_000);
    default:
      return 45_000;
  }
}

/**
 * A vendor with no scripted persona still has to answer in mock mode. Pick a
 * stable one from the name so the same vendor always behaves the same way.
 */
function defaultBehavior(vendor: Doc<"vendors">): string {
  let hash = 0;
  for (const ch of vendor.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ["negotiator", "standard", "negotiator", "cheapest_incomplete"][hash % 4];
}

function scheduleDemoReply(
  ctx: ActionCtx,
  campaignVendorId: Id<"campaignVendors">,
  behavior: string,
  delayMs: number,
): void {
  if (behavior === "ghost") return;
  void ctx.scheduler.runAfter(delayMs, internal.agents.simulateDemoReply, {
    campaignVendorId,
  });
}

/**
 * Scripted demo vendors. Builds the reply text locally, then feeds it through
 * the REAL processInbound pipeline (LLM parsing, normalization, negotiation).
 */
export const simulateDemoReply = internalAction({
  args: { campaignVendorId: v.id("campaignVendors") },
  handler: async (ctx, args) => {
    const row = await loadCvBundle(ctx, args.campaignVendorId);
    if (!row) return;
    const { cv, vendor, campaign, messages } = row;
    if (!isSimulated(vendor) || !vendor.email) return;
    const spec = campaign.spec;
    if (!spec) return;

    const behavior = vendor.demoBehavior ?? defaultBehavior(vendor);
    const flavor =
      CATEGORY_FLAVOR[spec.category] ?? CATEGORY_FLAVOR.photographer;
    const inboundCount = messages.filter((m) => m.direction === "inbound").length;
    const lastOutbound = [...messages].reverse().find((m) => m.direction === "outbound");
    const counterMatch = lastOutbound?.bodyText.match(/₹\s?([\d,]+)/);
    const counterAmount = counterMatch
      ? Number(counterMatch[1].replace(/,/g, ""))
      : null;
    const isCounter = lastOutbound?.kind === "counteroffer";
    const isClarification = lastOutbound?.kind === "clarification";

    const target = spec.targetBudget;
    const hard = spec.hardBudget;
    const date = spec.targetDate ?? "the requested date";
    let replyText: string | null = null;

    switch (behavior) {
      case "negotiator": {
        if (inboundCount === 0) {
          // Spread openings per vendor: two negotiators quoting the identical
          // number on the same board reads as scripted.
          const q = roundTo500(target * (1.08 + vendorSpread(vendor) * 0.14));
          replyText = `Hi,\n\nThanks for reaching out! Yes, we are available on ${date}.\nOur complete package is ₹${q.toLocaleString("en-IN")} including taxes and travel — ${flavor.deliverables}.\n\nLet me know if you'd like to proceed.\n\n— ${vendor.name}`;
        } else if (isCounter && counterAmount) {
          if (counterAmount >= target * 1.02) {
            replyText = `Hi,\n\nOkay, we can do ₹${counterAmount.toLocaleString("en-IN")} all-inclusive as a final price. That includes everything discussed — taxes and travel covered.\n\n— ${vendor.name}`;
          } else {
            const mid = roundTo500((counterAmount + target * 1.08) / 2);
            replyText = `Hi,\n\n₹${counterAmount.toLocaleString("en-IN")} is a bit tight for us. The best we can do is ₹${mid.toLocaleString("en-IN")} all-inclusive.\n\n— ${vendor.name}`;
          }
        } else {
          replyText = `Hi,\n\nConfirming everything from our quote: ${flavor.deliverables}, taxes and travel included. Happy to answer anything else.\n\n— ${vendor.name}`;
        }
        break;
      }
      case "standard": {
        if (inboundCount === 0) {
          const q = roundTo500(target * 1.05);
          replyText = `Hello,\n\nYes, we're available on ${date}. Our all-inclusive price is ₹${q.toLocaleString("en-IN")} — taxes and travel included. ${flavor.deliverables}.\n\nRegards,\n${vendor.name}`;
        } else if (isCounter && counterAmount) {
          replyText = `Hello,\n\nWe can match ₹${counterAmount.toLocaleString("en-IN")} all-inclusive. Consider it confirmed on our side.\n\nRegards,\n${vendor.name}`;
        } else {
          replyText = `Hello,\n\nTo confirm: all-inclusive pricing with taxes and travel, full deliverables as discussed.\n\nRegards,\n${vendor.name}`;
        }
        break;
      }
      case "premium": {
        const q = roundTo500(hard * 1.25);
        replyText = `Hello,\n\nThank you for considering us. We are available on ${date}. Our signature package is ₹${q.toLocaleString("en-IN")} all-inclusive. Our pricing is final and reflects the portfolio quality on our website.\n\nWarm regards,\n${vendor.name}`;
        break;
      }
      case "hidden_fees": {
        if (inboundCount === 0) {
          const q = roundTo500(target * 0.8);
          replyText = `Hi there,\n\nYes we do that! ${flavor.opening} ₹${q.toLocaleString("en-IN")}.\n\n— ${vendor.name}`;
        } else if (isClarification) {
          const q = roundTo500(target * 0.8);
          replyText = `Hi,\n\nTo clarify the pricing: base price is ₹${q.toLocaleString("en-IN")}, GST 18% applies extra, travel is ₹2,000, and ${flavor.clarifyExtra}. Let me know.\n\n— ${vendor.name}`;
        } else if (isCounter && counterAmount) {
          replyText = `Hi,\n\nWe can't go below our rates, sorry. The pricing shared earlier stands.\n\n— ${vendor.name}`;
        } else {
          replyText = `Hi,\n\nOur base pricing stands as shared earlier.\n\n— ${vendor.name}`;
        }
        break;
      }
      case "cheapest_incomplete": {
        const q = roundTo500(target * 0.72);
        replyText = `Hey,\n\nWe can do it for ₹${q.toLocaleString("en-IN")}. Cheapest you'll find!\n\n— ${vendor.name}`;
        break;
      }
      case "slow": {
        const q = roundTo500(target * 1.0);
          replyText = `Hello, apologies for the delay.\n\nWe are available on ${date}. Complete package at ₹${q.toLocaleString("en-IN")} all-inclusive: ${flavor.deliverables}, taxes and travel included.\n\nRegards,\n${vendor.name}`;
        break;
      }
      case "decliner": {
        replyText = `Hello,\n\nThank you for thinking of us, but we are already booked on ${date} and won't be available.\n\nBest,\n${vendor.name}`;
        break;
      }
      default:
        replyText = null;
    }

    if (!replyText) return;

    await ctx.runAction(internal.agents.processInbound, {
      campaignId: campaign._id,
      externalThreadId: `demo-${cv._id}`,
      externalMessageId: `demo-in-${Date.now()}-${randomSlug(4)}`,
      fromAddress: vendor.email,
      subject: `Re: ${campaign.title}`,
      text: replyText,
      timestamp: Date.now(),
    });
  },
});

/** Stable 0..1 offset derived from the vendor name. */
function vendorSpread(vendor: Doc<"vendors">): number {
  let hash = 0;
  for (const ch of vendor.name) hash = (hash * 131 + ch.charCodeAt(0)) >>> 0;
  return (hash % 1000) / 1000;
}

function roundTo500(value: number): number {
  return Math.round(value / 500) * 500;
}

const CATEGORY_FLAVOR: Record<
  string,
  { deliverables: string; opening: string; clarifyExtra: string }
> = {
  photographer: {
    deliverables:
      "8 hours of coverage, edited photos and the highlight film, delivered within 30 days",
    opening: "Photography starts at",
    clarifyExtra: "video coverage is an add-on of ₹8,000",
  },
  catering: {
    deliverables:
      "a vegetarian North Indian menu for the requested headcount with setup included",
    opening: "Catering starts at",
    clarifyExtra: "service staff is an add-on of ₹3,000",
  },
};

// ---------------------------------------------------------------------------
// Shared loader: everything about a campaign vendor in one call
// ---------------------------------------------------------------------------

interface CvBundle {
  cv: Doc<"campaignVendors">;
  vendor: Doc<"vendors">;
  campaign: Doc<"campaigns">;
  mailbox: Doc<"mailboxes"> | null;
  thread: Doc<"threads"> | null;
  messages: Doc<"messages">[];
}

export type { MutationCtx };
