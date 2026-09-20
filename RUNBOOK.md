# Procurement Network — Runbook

An autonomous buyer agent. Tell it what you need; it discovers vendors on the
web (Firecrawl), emails them from its own inbox (AgentMail), parses and
normalizes their replies (OpenAI), negotiates within your bounds, and shows it
all live (Convex). Built for the Convex All Gas Hackathon.

> Firecrawl observes the market. AgentMail interacts with it. OpenAI reasons
> about it. Convex remembers it.

---

## 1. Prerequisites

- Node 20+ and npm
- Accounts (all have free/hackathon tiers):
  - Convex — https://convex.dev
  - OpenAI — https://platform.openai.com (API key)
  - Firecrawl — https://firecrawl.dev (API key, `fc-...`)
  - AgentMail — https://agentmail.to (API key)

## 2. Install

```bash
npm install
```

## 3. Create the Convex deployment + set secrets

```bash
# Log in and create/link a project (writes .env.local with VITE_CONVEX_URL)
npx convex dev --once --configure

# Set the three provider keys as Convex server-side env vars (never shipped to the browser)
npx convex env set OPENAI_API_KEY    "sk-..."
npx convex env set FIRECRAWL_API_KEY "fc-..."
npx convex env set AGENTMAIL_API_KEY "am_..."

# Optional model overrides (default: gpt-5.6-luna for both tiers)
# npx convex env set OPENAI_MODEL_FAST  "gpt-5.6-luna"
# npx convex env set OPENAI_MODEL_SMART "gpt-5.6-luna"
```

`npx convex dev` also regenerates `convex/_generated/` (the committed copies are
offline stubs so the project typechecks before a deployment exists).

## 4. Run locally (live mode)

```bash
npx convex dev      # terminal 1 — deploys functions + keeps them hot
npm run dev         # terminal 2 — Vite on http://localhost:5173
```

Because `.env.local` now contains `VITE_CONVEX_URL`, the app runs in **live
mode** against your deployment. Without it, the app boots in **preview mode**
(realistic seeded UI, no backend needed).

## 5. Seed demo data

Two seed actions are exposed as buttons on the home screen (and as mutations):

- **Seed demo campaign** → `seed.seedDemo`: a "started yesterday" campaign with
  the full lifecycle (negotiated offers, activity history, vendor metrics). This
  is the rich, story-complete campaign for the demo.
- **Seed live demo** → `seed.seedInstantDemo`: a fresh campaign whose vendors are
  pre-qualified and ready to be contacted, so outreach + auto-replies happen live.

Or from the CLI:
```bash
npx convex run seed:seedDemo
npx convex run seed:seedInstantDemo
```

## 6. Deploy

```bash
# Backend
npx convex deploy

# Frontend — Vercel or Netlify
#   Build command:  npm run build
#   Output dir:     dist
#   Env var:        VITE_CONVEX_URL = your deployment's cloud URL
```

Set `VITE_CONVEX_URL` in the hosting dashboard to the value from
`npx convex url` (the `https://<deployment>.convex.cloud` URL).

The AgentMail inbound webhook points at
`https://<deployment>.convex.site/agentmail-webhook` and is registered
automatically when a campaign inbox is created (`CONVEX_SITE_URL` is provided by
Convex at runtime).

## 7. Live demo script (under 3 minutes)

1. **Problem + pitch (0:00–0:15).** "Normally I'd search dozens of vendors, fill
   forms, wait for replies, and compare quotes by hand. Here I just tell it what
   I need."
2. **Create the request (0:15–0:35).** Type the wedding-photographer request on
   the home screen. Show the interpreted-requirements review, click **Start
   sourcing**.
3. **Discovery (0:35–0:55).** Watch vendor cards fill the pipeline and the
   activity feed tick. Point out a merged duplicate and the "rejected" reasons.
4. **The rich campaign (0:55–1:25).** Open the seeded campaign. Show the counters,
   the leaderboard (initial → current prices), and the savings banner.
5. **Email intelligence (1:25–1:50).** Open a vendor thread. Raw email on the
   left, normalized structured offer on the right. Emphasize it's doing more than
   summarizing.
6. **Negotiation (1:50–2:15).** Show a counteroffer in the thread and the price
   drop on the card. Stress the hard budget is enforced by code, not by prompt.
7. **The moat (2:15–2:35).** Open a vendor profile. Show reply rate, median
   initial vs final quote, typical discount, and your rating. "Every campaign
   makes the next one smarter."
8. **Architecture (2:35–2:50).** One line per sponsor (the quote above).
9. **Close (2:50–3:00).** "Make the market compete for you."

Tip: keep the **live demo** campaign running in a tab while you present — its
auto-replies keep landing in real time, so a reply can reorder the leaderboard
mid-talk.

## 8. Tests & type safety

```bash
npm test             # 34 unit tests over the deterministic core
npm run typecheck    # strict tsc across backend + frontend
npm run build        # production build
```

The deterministic core (quote normalization, offer scoring, the stage machine,
and the negotiation clamp) is fully unit-tested against the doc's own examples.

## 9. Safety rails (what the agent will never do)

- Exceed the hard budget (enforced in `lib/negotiate.ts`, not by prompt).
- Fabricate a competing offer (only real leaderboard offers are referenced).
- Accept a deal or make a payment (final selection requires user approval).
- Claim facts not in evidence (extracted claims carry source URLs).

## 10. Project map

```
convex/
  schema.ts        14 tables (campaigns, vendors, offers, threads, metrics, ...)
  campaigns.ts     campaign CRUD + pipeline/leaderboard/activity queries
  vendors.ts       entity resolution (domain/email/name merge) + qualification
  offers.ts        normalization + score recompute
  threads.ts       thread/message persistence + dedupe
  agents.ts        the autonomous pipeline (internal actions + scheduler chaining)
  openai.ts        structured-output LLM calls (fetch, retry/backoff)
  firecrawl.ts     /v2/search + /v2/scrape JSON extraction
  agentmail.ts     inboxes, send/reply, threads, webhooks
  http.ts          Svix-verified AgentMail webhook receiver
  crons.ts         inbox polling + stalled-vendor nudges (safety nets)
  seed.ts          demo data (rich campaign + live demo campaign)
  lib/             pure logic: normalize, score, stateMachine, negotiate, llmSchemas
src/
  components/      Home, RequirementReview, CampaignLive (counters+pipeline+
                   leaderboard+activity), Compare, VendorProfile, Thread, Preview
  fixtures/        realistic demo data for preview/QA mode
test/              vitest suite for the deterministic core
```
