# Hackathon log

- **Project:** Counteroffer
- **Event:** Convex All Gas Hackathon
- **What it does:** A shared buyer demo that discovers vendors with Firecrawl, parses replies with OpenAI, compares and negotiates quotes, and persists the live pipeline in Convex; AgentMail delivers mail in live transport mode, while the default mock mode simulates replies.
- **Live app:** https://lovely-cod-509.convex.site
- **Repo:** https://github.com/divagr18/counteroffer
- **Frontend:** Convex static hosting
- **Convex deployment:** https://lovely-cod-509.convex.cloud
- **Components:** @convex-dev/static-hosting, @convex-dev/rate-limiter, @convex-dev/action-retrier
- **Convex features:** schema, tables, indexes, full-text search, queries, mutations, actions, HTTP actions, crons, scheduled functions, realtime queries, components, static hosting
- **Auth:** none
- **AI models:** gpt-5.6-luna
- **Started:** 2026-09-20T13:59:26Z
- **Last updated:** 2026-09-22T18:10:00Z

## Demo video

Recorded at 1920 × 1080, 150.5 seconds. Public video link to be added.

AgentMail live delivery and replies work; the demo simulates email to avoid
contacting real people.

The Started field uses the first meaningful Git commit, `18a53a5`. Earlier dates
below are preserved from the existing build log as previously recorded history;
the available Git history does not independently verify those session dates.

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

### 2026-09-20
Shipped it live, installed three Convex components, and made the email path real.

**Deployed.** Backend on the `lovely-cod-509` production deployment, frontend
published to the same deployment at https://lovely-cod-509.convex.site via
`@convex-dev/static-hosting`. One `npm run deploy` builds, pushes and uploads.
`OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY` and
`LIVE_VENDOR_EMAIL` are set as deployment env vars on dev and prod; no secret
reaches the browser. Both LLM tiers run gpt-5.6-luna. Production is seeded with
the rich wedding-photographer campaign (8 vendors, 3 replied), the catering
campaign, and the live-demo campaign (7 vendors).

Verified against the live URL: the app serves, SPA fallback resolves, and
critically `/health` and `/agentmail-webhook` still answer from the app rather
than the static catch-all.

**Components.** `convex/convex.config.ts` registers static hosting, the rate
limiter and the action retrier, with instances in `convex/lib/components.ts`.

Static hosting is mounted *without* an `httpPrefix`; its catch-all is registered
last inside the existing router through `registerStaticRoutes`. Exact routes
win, so the AgentMail webhook keeps its root URL and no already-registered
webhook had to move.

The rate limiter puts the agent's politeness in code rather than in a prompt: a
per-vendor token bucket (4/hour, burst 2) on any email that actually leaves, a
per-campaign fixed window (40/hour) over all outbound mail, and a per-campaign
discovery bucket (3/hour, burst 1) so a repeated Start-sourcing click cannot
re-crawl the web on our bill. Suppressed sends are written to the event log as
`email.throttled` / `discovery.throttled` and show in the activity feed instead
of vanishing. Scripted demo vendors bypass the per-vendor bucket, since their
transport is local and throttling them protects nobody.

The action retrier wraps RFQ delivery, the one step where a transient failure
silently costs a vendor: no email, no reply, no offer. `startOutreach` still
staggers vendors 12s apart, but each is scheduled through a new
`agents.enqueueRfq` mutation that hands `agents.sendRfq` to the retrier (4
attempts, exponential backoff from 1s). Fixed an ordering bug found while wiring
it: a vendor was marked `contacted` before the send, so an OpenAI or AgentMail
failure left them stuck with nothing delivered and a retry returning early at
the stage guard. Contact is now recorded only after the email is out.

**One real vendor.** `seed.seedInstantDemo` seeds Verde Studio alongside the six
scripted personas: `isDemoVendor: false`, on a real mailbox from
`LIVE_VENDOR_EMAIL`. Its RFQ is drafted by the model and genuinely delivered by
AgentMail, and the reply returns through the Svix-verified webhook into the same
parsing, normalization and negotiation pipeline as everything else. It carries
no demo badge in the UI, which is the on-screen proof that the email path is not
simulated.

**In-app outreach trigger.** Added `campaigns.contactVendors` and a
"Contact N vendors" button on the campaign screen, shown when a campaign has
qualified vendors and none contacted. The pre-qualified live-demo campaign now
runs end to end from the UI with no CLI step.

**Demo materials.** `docs/demo/demo-plan.md` and `docs/demo/vo_script.srt`: a
2:42 continuous-motion product video, 26 narration cues, shot list, per-take
camera choreography, timings derived from the pipeline's own delays, and a prep
checklist. Entirely in-app apart from one Convex dashboard shot; no terminals,
no slides, no static screens.

Verification: strict typecheck clean, 37 unit tests green, production build
clean (475 modules), live URL responding.

Open: record the demo video, and post the build on X / LinkedIn.

### 2026-09-21
Redesigned the interface, recorded the demo, and fixed three bugs the recording
exposed.

**Interface.** Rebuilt around a full-bleed shell: a persistent left rail, a
fluid centre and a fixed live tape on the right, all inside one viewport with
independent scroll regions, so the campaign screen never scrolls the page and
the width carries the board instead of empty margin. The funnel counters moved
inline into the top bar; empty pipeline stages collapse so the space goes where
vendors actually are. Light, paper-white palette with hairline borders and no
drop shadows, one burnt-orange accent for agent activity and teal for money,
Inter for text and IBM Plex Mono for every number so figures line up in columns.
Home became two columns: the request on the left, live campaigns on the right.

**Mock email by default.** `EMAIL_TRANSPORT` now gates the transport and
defaults to `mock`: no AgentMail inbox is created, nothing is delivered, and
every vendor answers from the persona engine through the real parsing,
normalization and negotiation path. Discovery still crawls the live web, so the
safe default has to be the one that cannot mail the real businesses it finds.
Set it to `live` to send.

**Three bugs, all found by watching the product rather than the tests.**

1. The seeds never scored their offers, so `offerScore` was unset, ranking fell
   through to the cheapest quote, and the board presented an incomplete lowball
   as the best offer — contradicting the ranking rule printed underneath it.
   The scorer is now a shared helper the seeds call directly.
2. Every negotiation round rebuilt the offer from the newest email alone. A
   reply that restated only a price erased the coverage, deliverables and
   timeline agreed two messages earlier, so each round looked less complete than
   the last and the sparse cheap vendor won. Revisions now carry forward what a
   vendor has already said, and `missingFields` is recomputed across the whole
   conversation. Two completeness checks also compared optional fields against
   `null`, so they always read as known.
3. `gpt-5.6-luna` rejects any temperature but the default, so every RFQ draft
   failed with HTTP 400. The retrier retried four times and gave up silently,
   leaving vendors stuck with nothing in the activity feed. Temperature is no
   longer sent unless `OPENAI_ALLOW_TEMPERATURE` is set, and a terminal retrier
   failure now writes an `outreach.failed` event.

**Recording.** `docs/demo/` holds the capture pipeline: `capture.cjs` drives
the deployed app in Chrome and records three takes while writing a mark for
every activity-feed change, `edit.json` is the cut list, and `assemble.cjs`
cuts, speed-remaps and concatenates with ffmpeg, refusing to build a timeline
shorter than the narration. The finished cut is 2:30 at 1920×1080.

The takes: nine and a half minutes of the live board working, a minute of
close-ups, and five and a half minutes of real Firecrawl discovery finding
actual Mumbai studios, merging duplicates and rejecting the ones with no
contact path. In the cut, the cheapest quote in the room (₹27,140) ranks fifth
on a 17% complete quote, one vendor's ₹30,090 headline becomes ₹43,890 all-in
and is eliminated over the ₹40,000 hard budget, and the final selection waits
on a human approval. Best offer ₹31,000, ₹6,961 under the average opening quote.

Also added `seed:resetDemoData` (internal, CLI-only) so the deployment can be
put into a known state before recording. Production is seeded with three
campaigns and the live board is ready to run.

Screenshots: `docs/demo/screenshots.cjs` runs the board for real, then captures
nine screens at 3840×2160 into `data/demo-recording/screenshots/` — home, the
worked board, the ranking explanation, a full email thread beside the structured
offer, compare, the approval gate, the supplier network, one supplier, and the
interpreted requirements. Added `seed:deleteDraftCampaigns` (internal) to clear
the draft the requirements shot leaves behind.

Open: post the build on X / LinkedIn.


### 2026-09-21 - working tree
Added the README with the buyer workflow, sponsor responsibilities, and Convex
implementation evidence. Updated the runbook for Convex static hosting and
clarified that demo email is simulated to avoid contacting real people while
the AgentMail integration supports live delivery and replies.

### 2026-09-22
Renamed the project to **Counteroffer**, after the one move the agent makes on
your behalf: it reads a vendor's quote, cites a real competing offer, and asks
for a better number. The rename went through the app, the rail mark, the page
title, package metadata, the docs, the narration and the GitHub repo, which is
now `divagr18/counteroffer`.

Shipped and pushed: the redesigned board, mock-by-default email transport, the
three Convex components, the three product bug fixes, the 2:30 demo cut and the
nine screenshots. Repo description, homepage and topics set.

One thing attempted and abandoned: narrating the demo in a cloned voice. Both
local options were tried on a real GPU box over SSH. Chatterbox ran on CPU but
sounded poor and forced a 1.25x tempo squeeze on the tightest cues. IndexTTS-2
loaded but its 2.5 checkpoints ship a tiktoken vocabulary while the code wants
`bpe.model`; pairing the 2.0 vocabulary with 2.5 weights corrupted the
token-to-duration mapping and produced speech roughly two and a half times too
fast. Qwen3-TTS installed cleanly with CUDA and the model downloaded after a
hung Hugging Face transfer was killed and retried, but the deadline arrived
first. The video ships silent with its caption file, which was always the
fallback. `docs/demo/qwen_tts.py` is the closest working path if anyone picks
this up.

