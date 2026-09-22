# Counteroffer — Runbook

Setup, local development, deployment, and verification.

## 1. Prerequisites

- Node 20+ and npm
- Provider accounts:
  - Convex — https://convex.dev
  - OpenAI — https://platform.openai.com (API key)
  - Firecrawl — https://firecrawl.dev (API key, `fc-...`)
  - AgentMail — https://agentmail.to (API key)

## 2. Install

```bash
npm ci
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

`npx convex dev` also regenerates `convex/_generated/` for your deployment.

## 4. Run locally (connected backend)

```bash
npx convex dev      # terminal 1 — deploys functions + keeps them hot
npm run dev         # terminal 2 — Vite on http://localhost:5173
```

With `VITE_CONVEX_URL`, the app connects to your Convex deployment. Without it,
the app boots in preview mode with fixture data and no backend.

The AgentMail integration supports live delivery and inbound replies. The demo
uses `EMAIL_TRANSPORT=mock` to avoid emailing real people. For live delivery, set
`EMAIL_TRANSPORT=live` and `AGENTMAIL_API_KEY` on your deployment; demo-marked
vendors remain simulated. OpenAI and Firecrawl require their provider credentials.

The public application has no authentication or tenant isolation. Use sample data.
Store provider credentials only in Convex server-side environment variables; never
put them in a `VITE_` variable or commit them.

## 5. Seed demo data

Three seed mutations are exposed as buttons on the home screen:

- **Wedding photographer** → `seed.seedDemo`: a "started yesterday" campaign with
  the full lifecycle (negotiated offers, activity history, vendor metrics).
- **Live pipeline** → `seed.seedInstantDemo`: a fresh campaign whose vendors are
  pre-qualified and ready to be contacted, so outreach + auto-replies happen live.

- **Catering** → `seed.seedCateringDemo`: the second buying category.

These buttons change the connected deployment. For a development deployment,
you can also seed from the CLI:
```bash
npx convex run seed:seedDemo
npx convex run seed:seedInstantDemo
```

## 6. Deploy to the selected hackathon host

The frontend uses **Convex static hosting**. The component is
already installed and registered in `convex/convex.config.ts`.

Deploy:

```bash
npm run deploy
```

This runs the static-hosting deployment command configured in `package.json`.
Verify the deployment target and provider configuration before running it. The
frontend must connect to the matching `https://<deployment>.convex.cloud` backend.
The published frontend uses `https://<deployment>.convex.site`.

After deployment, check the frontend, `/health`, and the full product workflow.
The AgentMail inbound webhook uses `/agentmail-webhook` on the same site host;
registration occurs when a live campaign inbox is created. Static hosting routes
are registered last so the health and webhook routes retain precedence.

## 7. Tests & type safety

```bash
npm test             # unit tests and optional extraction tests
npm run typecheck    # strict tsc across backend + frontend
npm run build        # production build
```

The unit suite covers quote normalization, scoring, state transitions, negotiation
decisions, and ranking explanations. Set `OPENAI_API_KEY` in the test process
to run the optional OpenAI extraction tests.

## 8. Project map

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
