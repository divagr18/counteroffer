# Counteroffer

**Describe what you need. Compare complete quotes. Choose who gets the job.**

Counteroffer is an autonomous buying agent that finds local vendors, requests quotes, ranks their offers, and negotiates over email within your budget. It turns a request such as “a wedding photographer in Mumbai, eight hours, a highlight video, under ₹40,000” into a live sourcing campaign. You can inspect the evidence, read each conversation, compare the full cost, and approve the final selection.

[Open the app](https://lovely-cod-509.convex.site) · [Source code](https://github.com/divagr18/counteroffer) · [Build log](hackathon.md) · [Run locally](RUNBOOK.md)

Built for the [Convex All Gas Hackathon](https://www.convex.dev/hackathons/all-gas), using Convex, OpenAI, Firecrawl, and an AgentMail integration.

## The buying problem

Hiring a photographer or caterer means searching websites, repeating the same request, chasing replies, and comparing packages that include different things. A low headline price might exclude tax, travel, or a required deliverable. The buyer has to reconstruct the actual deal before deciding whether it fits.

Counteroffer keeps that work in one campaign. It finds vendors with source evidence, asks for missing details, carries agreed terms across quote revisions, and ranks offers on coverage and completeness as well as price. Closing a campaign updates supplier metrics that can inform the next purchase.

> Demo note: AgentMail integration works with live email delivery and replies. The demo simulates email to avoid contacting real people.

## From request to finalist

The agent handles discovery, outreach, clarification, and negotiation. You set the requirements and budget, inspect its work on the live board, and approve the supplier selection.

### 1. Describe the job and review the requirements

Start with a request such as:

> Wedding photographer in Mumbai on October 18, eight hours of coverage, a highlight video, under ₹40,000.

The agent turns the request into structured requirements, a location and date, and a target budget with a hard maximum. You can edit the interpreted requirements before starting the campaign. These fields guide vendor qualification, quote comparison, and negotiation.

### 2. Find and qualify vendors

Firecrawl searches the web and extracts vendor services, locations, contact details, and public pricing signals. The agent merges duplicate businesses and evaluates whether each vendor has a usable contact path, serves the relevant area, and appears to fit the category and budget.

Qualified vendors enter the outreach queue. Rejected vendors retain a visible reason, such as no contact path or pricing outside the budget. Source evidence stays attached to the vendor so you can inspect what the agent found.

### 3. Request quotes and resolve missing details

The agent drafts a tailored quote request for each qualified vendor. AgentMail provides the campaign inbox and live email transport, keeping replies connected to the vendor's conversation.

OpenAI extracts the quote from each reply: price, included services, taxes, travel, availability, deliverables, and other terms. If a vendor omits a required detail, the agent sends a clarification request. For example, a photographer's package price is not enough to establish whether it covers eight hours and includes the highlight video.

The thread view puts the conversation beside the structured offer. You can read the original reply and see which details remain unanswered.

### 4. Rank offers as they arrive

The agent normalizes each quote into an estimated total and ranks it against the other offers. It considers price, required coverage, completeness, availability, response time, and supplier history. Missing information reduces the score, so an incomplete low quote does not automatically take first place.

A new reply or revised offer triggers a score update. Convex subscriptions update the leaderboard, vendor stages, and activity feed as the campaign progresses.

### 5. Negotiate within your limits

For an offer above the target but within the hard budget, the agent calculates a counteroffer and drafts the negotiation email. It can use an existing competing quote from the campaign to inform its ask. Without one, it works from the vendor's price and your target.

The pipeline limits negotiation to three counteroffer rounds per vendor. Offers above the hard maximum are eliminated; offers at or below target become finalists. When negotiation reaches its limit or has no useful room left, the agent presents the current offer for your decision.

Each revised quote goes back through comparison. If a vendor replies only with a lower price, the agent carries forward the coverage, deliverables, and other terms already supplied instead of treating the reply as a new, incomplete offer.

### 6. Approve a supplier and retain the history

You compare the finalists and select a vendor through an approval card. Reaching the target price does not itself book the supplier: final selection remains with the buyer.

Closing the campaign updates supplier metrics, including replies, response times, opening and final quotes, and selection history. The Supplier network view retains that history for future campaigns, and historical reliability contributes to offer ranking.

## Try the product

1. Open the app and choose an existing **Wedding photographer** campaign to inspect a populated comparison. If none exists, use the matching demo seed button on the home screen.
2. Open a vendor's thread. Compare the message with its structured offer, estimated total, missing fields, and assumptions.
3. Inspect the leaderboard and ranking explanation. A cheaper quote can rank below a more complete offer.
4. Use **Live pipeline** to seed a fresh campaign. Open it and choose **Contact N vendors** to watch replies, clarifications, and negotiation update the board.
5. Select a finalist and resolve the approval card. The demo records the selection; it does not book the vendor or make a payment. Close the campaign to update supplier metrics, then open **Supplier network**.

To test discovery, enter an example request, review the interpreted requirements, and choose **Start sourcing**. Discovery uses Firecrawl and may take longer than the pre-seeded route.

## Judging criteria and implementation evidence

| Criterion | Product evidence | Where to look |
| --- | --- | --- |
| Everyday usefulness and creativity | A buyer moves from a plain-language request to comparable quotes and a selected supplier. Wedding photography and catering have demo scenarios. | [Home](src/components/Home.tsx), [requirement review](src/components/RequirementReview.tsx), [demo seeds](convex/seed.ts) |
| Convex depth | Fourteen tables, indexed campaign state, queries and mutations, reactive UI, scheduled actions, crons, HTTP webhooks, and three registered components. | [Schema](convex/schema.ts), [campaign functions](convex/campaigns.ts), [React subscriptions](src/App.tsx), [components](convex/convex.config.ts) |
| Sponsor stack | OpenAI handles structured interpretation and message drafting; Firecrawl discovers and enriches vendors; AgentMail supplies the live inbox and delivery path. | [OpenAI](convex/openai.ts), [Firecrawl](convex/firecrawl.ts), [AgentMail](convex/agentmail.ts), [pipeline](convex/agents.ts) |
| Live URL | Frontend served on `convex.site` through the official static-hosting component. | [Open app](https://lovely-cod-509.convex.site), [HTTP routing](convex/http.ts) |

## Stack

| Technology | Work performed |
| --- | --- |
| Convex | Stores vendors, evidence, messages, offers, approvals, and campaign events; coordinates background actions; updates the board through subscriptions. |
| OpenAI | Converts requests and replies into structured fields and drafts RFQs, clarification requests, and negotiation messages. Both configured model defaults are `gpt-5.6-luna`; deployment overrides are supported. |
| Firecrawl | Searches for vendors and scrapes their pages for qualification and contact evidence; discovered entities are merged before outreach. |
| AgentMail | In live mode, creates a campaign inbox and sends or replies to vendor messages. Incoming replies enter through a webhook with signature verification. |

### Convex components in use

All three components are registered in [convex.config.ts](convex/convex.config.ts).

| Component | Application use |
| --- | --- |
| `@convex-dev/static-hosting` | Serves the Vite frontend while retaining `/health` and `/agentmail-webhook` routes. |
| `@convex-dev/rate-limiter` | Limits live vendor mail to 4/hour with burst capacity 2, campaign mail to 40/hour, and discovery to 3/hour with burst capacity 1. |
| `@convex-dev/action-retrier` | Retries initial outreach with exponential backoff; terminal failure is recorded in the campaign activity. |

## How the agent compares offers

### Normalize the full cost

[Normalization](convex/lib/normalize.ts) adds included line items, applicable tax assumptions, and known travel fees. Unknown charges remain visible as assumptions rather than silently disappearing from the comparison.

For example, a ₹30,000 package excluding 18% tax and a stated ₹2,000 travel fee becomes an estimated ₹37,400. A ₹35,000 all-inclusive package can therefore cost less despite its higher headline price. This is an illustrative comparison; the offer view shows the terms and assumptions used for each vendor.

### Rank for fit as well as price

The [scorer](convex/lib/score.ts) uses explicit weights, with a [ranking explanation](src/lib/explain.ts) available in the UI:

| Factor | Contribution | What it measures |
| --- | --- | --- |
| Price fit | Up to 30 points | Full credit at or below target, falling to zero at the hard budget. |
| Required coverage | Up to 30 points | How many required items the offer satisfies. |
| Completeness | Up to 15 points | How much of the quote's structured information is known. |
| Availability | Up to 10 points | Confirmed availability scores above unknown availability. |
| Responsiveness | Up to 5 points | How quickly the vendor replied. |
| Historical reliability | Up to 5 points | The supplier's recorded reliability from earlier campaigns. |
| Uncertainty | Subtracts up to 10 points | Missing fields reduce confidence in the comparison. |

Price and coverage carry equal weight. A low price with unanswered requirements can rank below a complete quote, and a clarification can improve a vendor's position even without a discount.

### Separate the negotiation decision from the email draft

[Negotiation code](convex/lib/negotiate.ts) chooses whether to counter, hold, or walk away and calculates the counteroffer amount. OpenAI then writes the message using the campaign requirements and conversation history. The [pipeline](convex/agents.ts) supplies competing prices from active, non-eliminated offers in the same campaign.

For an illustrative first round, a ₹39,000 quote against a ₹32,000 target and ₹40,000 hard maximum produces a ₹35,500 counteroffer when no competing quote is available. The agent sends the counter, processes the reply, and updates the comparison. Budget checks and the round limit are enforced in code; the model handles the wording.

## Run locally

Use Node.js 20+ and npm.

```bash
git clone https://github.com/divagr18/counteroffer.git
cd counteroffer
npm ci
npm run dev
```

Without `VITE_CONVEX_URL`, the app opens its local preview UI. To run the actual backend, follow the [runbook](RUNBOOK.md) to connect your own Convex development deployment and configure provider credentials server-side.

```bash
npm test
npm run typecheck
```
