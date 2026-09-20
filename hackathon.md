# Hackathon log

- **Project:** Procurement Network
- **Event:** Convex All Gas Hackathon
- **What it does:** An autonomous buyer that discovers vendors on the web (Firecrawl), contacts and negotiates with them from a per-campaign email inbox (AgentMail), parses and normalizes their quotes (OpenAI), and shows the whole pipeline live while building a persistent private supplier graph (Convex).
- **Live app:** not deployed
- **Repo:** https://github.com/divagr18/procurement-network
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** schema, tables, indexes, full-text search, queries, mutations, actions, HTTP actions, crons, scheduled functions, realtime queries
- **Auth:** none
- **AI models:** gpt-5.6-luna
- **Started:** 2026-08-26T09:25:06Z
- **Last updated:** 2026-09-15T13:05:00Z

## Log

### 2026-08-26
Built the first complete version in one session. Backend: 14-table schema
(campaigns, vendors, vendorEvidence, campaignVendors, crawlJobs, mailboxes,
threads, messages, offers, agentActions, approvalRequests, campaignEvents,
vendorMetrics, users) and an event-driven agent pipeline — request parsing,
Firecrawl search/scrape discovery with entity resolution, deterministic
qualification with visible rejection reasons, per-campaign AgentMail inbox with
Svix-verified inbound webhook, structured reply parsing, quote normalization
with explicit assumptions, clarification follow-ups, and negotiation clamped by
code (hard budget, real competing offers only). Frontend: six-screen React UI
(home, requirement review, live campaign with pipeline/leaderboard/activity,
compare, thread with structured offer, vendor profile) plus a no-backend
preview mode and two demo seeds (rich campaign, live demo campaign with
scripted vendor replies fed through the real pipeline). 34 vitest unit tests
over the deterministic core (normalization, scoring, stage machine,
negotiation). Convex features: schema, indexes, full-text search, queries,
mutations, actions, HTTP actions, crons, scheduled functions, realtime queries
(`convex/schema.ts`, `convex/agents.ts`, `convex/http.ts`, `convex/crons.ts`,
`convex/seed.ts`, `src/App.tsx`, `src/components/`).

### 2026-09-15 - working tree
Hackathon environment setup. Installed the managed Convex AI files (AGENTS.md,
CLAUDE.md, `convex/_generated/ai/guidelines.md`, project-local Convex skills),
global Convex agent skills plus a user-level `convex` MCP server for the
current agent, and the convex-hackathon-skill build-log skill
(`.agents/skills/convex-hackathon-skill/`). Started this log. Frontend hosting
decision recorded: Convex static hosting (`convex.site`), to be configured with
@convex-dev/static-hosting once a deployment exists. Then closed the remaining
gaps versus the hackathon plan, verified in the browser (preview mode) with
37 unit tests green and a clean strict typecheck: editable interpreted
requirements (`src/components/RequirementReview.tsx` wired to
`campaigns.updateSpec`); human-in-the-loop UI — approval cards with
approve/reject, Select on finalists, and Close campaign which finalizes
cross-campaign vendor metrics (`src/components/Approvals.tsx`,
`src/components/CampaignLive.tsx`); deterministic "why?" ranking explanations
with unit tests (`src/lib/explain.ts`); supplier network + user procurement
memory screen backed by a new `users.memory` query
(`src/components/Network.tsx`); catering as secondary demo category
(`seed.seedCateringDemo` plus category-aware scripted vendor replies in
`convex/agents.ts`); framer-motion polish (pipeline card and leaderboard row
layout animations, price-change flash, count-up counters); and a 10-email
extraction fixture suite that runs when OPENAI_API_KEY is set
(`test/extraction.test.ts`).
