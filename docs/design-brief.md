# Counteroffer

## Hackathon
**Convex All Gas Hackathon**  
Sponsors: **Convex × OpenAI × Firecrawl × AgentMail**

## Working Title
**Counteroffer**

### Alternate Names
- **Make Them Compete**
- **BidForMe**
- **Reverse Market**
- **Buyer**
- **Tender**
- **Get Me a Quote**
- **Source**
- **Procure**

---

# 1. One-Line Pitch

> **Tell it what you need. It finds vendors, contacts them, negotiates, compares the actual offers, and builds a private supplier network that gets better every time you use it.**

Instead of searching Google, opening ten tabs, filling ten forms, waiting for replies, comparing inconsistent quotes, and negotiating manually, the user creates a **procurement campaign**.

The system does the rest.

Example:

> “I need a wedding photographer in Mumbai on October 18. Budget ₹40,000. Need 8 hours of coverage, edited photos, and a 3-minute highlight reel.”

Counteroffer:

1. Searches and crawls the web for relevant photographers.
2. Extracts structured vendor capabilities, pricing clues, location, reviews, contact information, and portfolio quality signals.
3. Deduplicates the same vendor across multiple websites.
4. Shortlists the most promising candidates.
5. Gives the campaign its own email inbox.
6. Contacts vendors with tailored RFQs.
7. Parses replies and normalizes quotes.
8. Automatically asks follow-up questions when offers are incomplete.
9. Negotiates within user-defined constraints.
10. Updates a live comparison board as replies arrive.
11. Recommends finalists with evidence.
12. Saves every interaction into a persistent vendor graph for future procurement.

The important distinction:

**This is not AI search.**  
**This is not a quote comparison site.**  
**This is an autonomous buyer.**

---

# 2. Why This Is a Strong Hackathon Project

The project sits in the sweet spot of:

- immediately understandable
- visibly dynamic
- technically nontrivial
- impossible to represent honestly as a single prompt
- dependent on all four sponsor products
- useful to normal people
- easy to demo in under three minutes
- capable of accumulating a genuine data moat

The product can look simple to a user while containing substantial systems depth underneath.

The user gives the system a buying objective.

The system creates a persistent campaign that lives for hours or days, continuously incorporating:

- newly discovered vendors
- crawl results
- emails sent
- emails received
- updated quotes
- negotiation outcomes
- constraints
- eliminated candidates
- user preferences
- historical vendor behavior

This makes the product fundamentally different from something a coding agent could reproduce in twenty minutes after seeing a screenshot.

A clone can reproduce the UI.

It cannot reproduce:

- historical quote data
- response-rate statistics
- past negotiation outcomes
- supplier reliability
- vendor identity resolution
- ongoing email threads
- campaign state
- accumulated pricing distributions
- user-specific procurement history
- cross-campaign supplier intelligence

The application becomes better through use.

---

# 3. Hackathon Flashiness Gate

A project should pass this test:

> **Can a judge understand why this is cool from a 10–15 second screen recording with the sound off?**

Counteroffer scores extremely well.

| Dimension | Score | Why |
|---|---:|---|
| Instant legibility | 5/5 | “Make businesses compete for you.” |
| Visible motion | 5/5 | vendors appear, get contacted, reply, move columns, and change rank |
| Transformation | 5/5 | raw request → verified offers → negotiated winner |
| Real-world contact | 5/5 | actual businesses receive and respond to email |
| Demo climax | 5/5 | incoming reply changes the winning quote live |
| Screenshotability | 5/5 | live quote board + savings + vendor pipeline |
| **Total** | **30/30** | |

### Ideal 15-Second Clip

The screen shows:

**Wedding Photographer · Mumbai · ₹40k maximum**

Counters animate:

- 43 vendors found
- 19 qualified
- 12 contacted
- 8 replied
- 3 negotiating

Then an email arrives.

A vendor card jumps:

**₹38,000 → ₹31,000**

The leaderboard reorders.

A banner appears:

> **New best offer. You’ve saved ₹9,000 against your original target.**

No explanation should be necessary.

---

# 4. Codex Resistance Gate

The second gate:

> **Could another team reproduce 80% of the perceived product in twenty minutes after seeing it?**

The project should deliberately put its value in places that are expensive to copy quickly.

## What Is Easy to Clone

- a prompt input
- a nice dashboard
- a Firecrawl search call
- sending one email
- extracting one quote
- an LLM-generated recommendation

These are not the project.

## What Is Hard to Clone

### Persistent Procurement Campaigns

A campaign stays alive across hours or days and can be resumed from any state.

### Vendor Identity Resolution

The same photographer might appear as:

- `samarthphotography.com`
- `Samarth Weddings` on WedMeGood
- `samarth.photo@gmail.com`
- `Samarth Photography Mumbai` on another directory

They must resolve into one vendor.

### Quote Normalization

Offers arrive in wildly different formats:

> “35k all inclusive”

> “₹28,000 photography + 8,000 video + tax”

> “Our silver package starts at 32K for six hours”

The system converts these into structured comparable offers.

### Constraint Tracking

The cheapest quote may fail important requirements.

Example:

```text
Vendor A
₹29,000
8 hours ✓
Video ✓
Drone ✗
Available ✓

Vendor B
₹32,000
8 hours ✓
Video ✓
Drone ✓
Available ✓
```

### Autonomous Follow-Up

If a vendor says:

> “Yes, we are available. Packages start at 30k.”

The system should know that this is **not yet a complete quote** and ask:

- exact price
- coverage duration
- deliverables
- taxes
- travel fees
- editing timeline

### Negotiation State

A vendor can move through:

```text
Initial offer
→ clarification
→ counteroffer
→ revised offer
→ final offer
```

The system remembers the entire trajectory.

### Historical Vendor Intelligence

Across campaigns:

- median initial quote
- median accepted quote
- typical discount
- average response latency
- ghost rate
- fulfillment rating
- categories
- areas served
- seasonal price changes
- negotiation elasticity

That historical state becomes the long-term product moat.

---

# 5. Core User Experience

## 5.1 Create a Campaign

The user writes naturally:

> “Need catering for 35 people in Bandra next Saturday. Vegetarian, preferably North Indian, around ₹900/head, setup included.”

OpenAI converts this into a structured procurement specification.

Example:

```json
{
  "category": "catering",
  "location": "Bandra, Mumbai",
  "date": "2026-09-05",
  "quantity": 35,
  "budget": {
    "type": "per_person",
    "target": 900,
    "currency": "INR"
  },
  "requirements": [
    "vegetarian",
    "north indian preferred",
    "setup included"
  ],
  "negotiable": [
    "menu composition",
    "dessert",
    "service staff"
  ]
}
```

The user sees the interpreted requirements and can edit them.

Then they press:

**Start sourcing**

---

# 6. Campaign Lifecycle

A campaign progresses through explicit stages.

```text
REQUEST
  ↓
DISCOVERY
  ↓
ENRICHMENT
  ↓
QUALIFICATION
  ↓
OUTREACH
  ↓
RESPONSE COLLECTION
  ↓
CLARIFICATION
  ↓
NEGOTIATION
  ↓
FINALISTS
  ↓
SELECTED
```

These should not be purely cosmetic labels.

Every stage corresponds to persistent state and events in Convex.

---

# 7. Discovery

## Goal

Find a broad pool of plausible vendors.

## Firecrawl Responsibilities

Firecrawl performs:

- web search
- vendor-site crawling
- directory crawling where allowed
- structured extraction
- contact-page discovery
- portfolio/service-page extraction
- pricing-page extraction
- review/testimonial extraction

## Example Search Expansion

User asks for:

> Wedding photographer in Mumbai under ₹40k

Search plan could include:

```text
wedding photographer Mumbai
wedding photographer Bandra
Mumbai candid wedding photographer
Mumbai wedding cinematographer
wedding photographer price Mumbai
site:instagram.com Mumbai wedding photographer
```

The search planner can create multiple search angles instead of relying on one query.

---

# 8. Vendor Enrichment

Each discovered vendor becomes a structured entity.

Example:

```json
{
  "name": "Samarth Weddings",
  "canonicalDomain": "samarthweddings.in",
  "category": "photographer",
  "locations": ["Mumbai", "Thane"],
  "services": [
    "wedding photography",
    "candid photography",
    "cinematography"
  ],
  "pricingSignals": [
    {
      "value": 35000,
      "currency": "INR",
      "source": "website"
    }
  ],
  "contacts": {
    "email": "hello@samarthweddings.in",
    "phone": "+91..."
  },
  "sourceUrls": [],
  "evidence": [],
  "confidence": 0.91
}
```

Every extracted fact should retain provenance.

A judge should be able to click:

**Why do we think this vendor offers videography?**

and see the source.

---

# 9. Entity Resolution

This is one of the technically interesting layers.

## Problem

Search results may contain multiple records for the same real-world business.

## Signals

Possible matching signals:

- normalized business name
- website domain
- email domain
- phone number
- address
- social handles
- logo/image similarity
- overlapping portfolio links
- textual similarity

## Resolution Output

Instead of:

```text
Samarth Photography
Samarth Weddings
samarthweddings.in
Samarth Photo Mumbai
```

the system creates:

```text
Canonical Vendor: Samarth Weddings
Aliases: 4
Sources: 7
```

Entity resolution also makes later campaigns stronger because old and new evidence can merge.

---

# 10. Qualification

Before emailing everyone, the system ranks vendors.

## Qualification Factors

- relevant service
- geographic fit
- approximate budget fit
- date availability if known
- minimum requirements
- contactability
- website freshness
- historical response rate
- previous user ratings
- prior procurement outcomes

## Example

```text
42 discovered

19 strong matches
11 uncertain
12 rejected
```

Rejected vendors remain inspectable.

Reasons:

- outside budget
- wrong geography
- missing required service
- inactive site
- duplicate
- no contact path

This makes the reasoning visible rather than magical.

---

# 11. Campaign Inbox

Every campaign receives its own AgentMail inbox.

Example:

```text
photographer-7fx3@agentmail.to
```

This is extremely useful conceptually.

All campaign communications are isolated.

The inbox becomes part of the procurement state machine.

## Email Thread States

```text
drafted
sent
delivered
replied
needs clarification
negotiating
finalized
closed
```

---

# 12. Outreach

The system sends individualized RFQs rather than one generic spam template.

Example:

```text
Hi Samarth,

I'm looking for wedding photography in Mumbai on October 18.

Requirements:
- roughly 8 hours of coverage
- candid + traditional photography
- short highlight video
- edited photo delivery

Could you confirm:
1. availability
2. complete price including taxes/travel
3. exact deliverables
4. expected delivery timeline

Thanks.
```

OpenAI can adapt wording based on vendor information.

For example, if their website says they specialize in intimate weddings, the email can reference the relevant service without pretending to know anything unsupported.

---

# 13. Response Parsing

When an email arrives, AgentMail triggers the processing pipeline.

OpenAI extracts:

```json
{
  "availability": true,
  "basePrice": 38000,
  "currency": "INR",
  "coverageHours": 8,
  "deliverables": [
    "edited photos",
    "highlight film"
  ],
  "taxIncluded": true,
  "travelIncluded": true,
  "deliveryTimelineDays": 30,
  "missingFields": [
    "raw photos"
  ]
}
```

The result is saved into Convex immediately.

The frontend updates in real time.

---

# 14. Quote Normalization

The key product problem is not receiving quotes.

It is making quotes comparable.

Different vendors package things differently.

Example:

### Vendor A
```text
₹28,000 photography
₹8,000 video
₹2,000 travel
GST extra
```

### Vendor B
```text
₹39,000 all-inclusive package
```

The system derives normalized totals.

Example:

```text
Vendor A estimated total: ₹44,840
Vendor B total: ₹39,000
```

with assumptions visible.

This should support:

- fixed price
- per-hour price
- per-person price
- package pricing
- taxes
- optional addons
- travel
- minimum quantities
- deposits

---

# 15. Missing Information Detection

A response may look useful while still being insufficient.

Example:

> “We're available and packages start at ₹30,000.”

Missing:

- exact package
- number of hours
- video inclusion
- taxes
- travel
- final price

The agent should automatically detect incomplete fields.

Then it asks the smallest necessary follow-up.

This is a strong place to demonstrate agent autonomy without producing reckless behavior.

---

# 16. Negotiation

This is the feature that makes the project memorable.

The user chooses negotiation bounds.

Example:

```text
Target price: ₹32,000
Hard maximum: ₹40,000

Agent may:
✓ ask for package discount
✓ remove optional deliverables
✓ request price match
✓ ask for weekday/off-peak rate

Agent may not:
✗ accept booking
✗ pay deposit
✗ misrepresent competing offers
✗ exceed ₹40,000
```

## Negotiation Strategy

The model can reason from:

- current quote
- target
- historical vendor discount behavior
- competing quotes
- optional features
- budget constraints

Example:

Initial:

```text
₹38,000
```

Agent asks:

> If we keep the same 8-hour coverage but remove the raw footage delivery, is there any flexibility closer to ₹32,000?

Vendor:

```text
We can do ₹34,000.
```

Agent:

> Thanks. We have another comparable option at ₹32,500. If you can do ₹33,000 all-inclusive, we'd be comfortable shortlisting you as the preferred option.

Vendor:

```text
₹33,000 works.
```

Campaign updates:

```text
₹38,000 → ₹33,000
Saved: ₹5,000
```

The system should never fabricate competitor quotes.

---

# 17. Negotiation Safety

Autonomous negotiation needs explicit boundaries.

## Hard Rules

The agent cannot:

- make payments
- sign agreements
- claim the user has accepted
- fabricate competing offers
- provide false personal information
- exceed hard budget limits
- commit to dates the user has not approved
- negotiate prohibited categories

## Approval Gates

Optional user approval before:

- sending first outreach
- making a counteroffer
- accepting a final offer
- sharing personal details

For the hackathon version, the safest configuration is:

**agent may negotiate, user must approve selection.**

---

# 18. Vendor Pipeline UI

The campaign screen should feel alive.

Potential columns:

```text
DISCOVERED
QUALIFIED
CONTACTED
REPLIED
NEGOTIATING
FINALISTS
```

Vendor cards move between columns in real time.

Each card displays:

```text
Samarth Weddings

₹38,000 → ₹33,000
Available ✓

8h coverage ✓
Video ✓
Travel ✓
GST ✓

Responded in 19m

[View thread]
[Compare]
```

---

# 19. Quote Leaderboard

A second view ranks offers.

Example:

| Vendor | Initial | Current | Requirements | Response | Status |
|---|---:|---:|---:|---:|---|
| Pixel House | ₹36k | **₹31k** | 96% | 14m | Negotiating |
| Samarth | ₹38k | **₹33k** | 100% | 19m | Finalist |
| Frame Co | ₹29k | ₹29k | 72% | 3h | Missing video |
| Stories Studio | ₹42k | ₹36k | 100% | 44m | Negotiating |

Do not rank purely by price.

A cheap incomplete offer should not automatically win.

---

# 20. Offer Scoring

Possible scoring model:

```text
score =
  price_fit
+ requirement_coverage
+ availability
+ historical_reliability
+ response_quality
+ user_preferences
- uncertainty
- missing_fields
```

The scoring formula should remain understandable.

A judge should be able to inspect:

> Why is Samarth ranked above Frame Co even though Frame Co is cheaper?

Example answer:

```text
Frame Co is ₹4,000 cheaper, but:
- video coverage is missing
- taxes are unclear
- delivery timeline is unknown

Samarth satisfies every required condition.
```

---

# 21. Historical Vendor Graph

This is the long-term differentiator.

Every vendor accumulates history across campaigns.

Example:

## Samarth Weddings

```text
Campaigns seen: 4
Times contacted: 3
Replies: 3
Median response time: 21 min

Median initial quote: ₹38,000
Median final quote: ₹33,500
Typical negotiated reduction: 11.8%

User-selected: 1 time
User rating: 4.7 / 5
```

Future campaign ranking improves immediately.

The system can eventually know things search engines do not.

---

# 22. Procurement Memory

The system should learn both vendor-specific and user-specific patterns.

## Vendor Memory

- normal price range
- actual accepted prices
- negotiation elasticity
- response latency
- seasonal effects
- locations served
- service capabilities
- reliability

## User Memory

- prefers bundled pricing
- values responsiveness
- often chooses mid-priced vendor over cheapest
- refuses deposits above X%
- prefers vendors near a certain location
- values certain deliverables

This enables:

> “Find me another photographer like the one we used last time.”

without starting from scratch.

---

# 23. User-Level Supplier Network

Over time, the user gets a private graph:

```text
                  PHOTOGRAPHY
                 /            \
        Samarth                  Pixel House
         4.7★                      4.4★

CATERING -------- Bombay Bites
                     |
                   ₹830/head
                     |
                   17m reply

MOVERS ---------- FastShift
```

This is the deeper product thesis:

> **The application gradually builds your own private market of known suppliers.**

The web discovers them.

Interactions validate them.

Transactions teach the system.

---

# 24. Convex's Role

Convex should be foundational, not a database attached at the end.

## Convex Owns

- users
- campaigns
- requirements
- vendor entities
- vendor aliases
- crawl jobs
- crawl evidence
- qualification decisions
- campaign-vendor state
- inbox/thread metadata
- parsed responses
- offers
- offer revisions
- negotiation state
- agent actions
- approvals
- activity timeline
- historical vendor metrics
- real-time subscriptions

## Why Convex Matters

A campaign is a continuously changing object.

When:

- Firecrawl discovers another vendor
- an email is sent
- a reply arrives
- a quote changes
- a constraint becomes satisfied
- a vendor is eliminated

the interface should change immediately.

That makes Convex's reactive model visible in the actual product.

---

# 25. Suggested Convex Schema

Conceptual schema:

```text
users
campaigns
campaignRequirements

vendors
vendorAliases
vendorContacts
vendorEvidence

campaignVendors

crawlJobs
crawlDocuments

mailboxes
threads
messages

offers
offerItems
offerRevisions

agentActions
approvalRequests

vendorMetrics
campaignEvents
```

---

# 26. Campaign Schema

```ts
campaigns {
  _id
  userId

  title
  category
  description

  location
  targetDate

  currency
  targetBudget
  hardBudget

  status

  createdAt
  updatedAt

  mailboxId

  discoveredCount
  qualifiedCount
  contactedCount
  repliedCount
  negotiatingCount
  finalistCount
}
```

---

# 27. Campaign Vendor State

```ts
campaignVendors {
  campaignId
  vendorId

  stage

  qualificationScore
  offerScore

  contactedAt
  repliedAt

  availability

  currentOfferId

  missingRequirements
  satisfiedRequirements

  eliminationReason

  lastAgentActionAt
}
```

---

# 28. Offers

```ts
offers {
  campaignId
  vendorId

  revisionNumber

  totalPrice
  currency

  taxesIncluded
  travelIncluded

  validUntil

  completenessScore

  sourceMessageId
  extractedAt
}
```

Line items:

```ts
offerItems {
  offerId

  label
  quantity
  unitPrice
  totalPrice

  required
  included
}
```

This allows normalized comparison.

---

# 29. Event Log

Every important change creates an immutable event.

Example:

```text
13:04 Vendor discovered
13:05 Website crawled
13:05 Vendor qualified
13:07 RFQ sent
13:29 Reply received
13:29 Offer extracted: ₹38,000
13:30 Missing field detected
13:30 Clarification sent
14:12 Revised details received
14:13 Negotiation started
15:01 Revised offer: ₹33,000
```

This gives:

- observability
- auditability
- demo richness
- deterministic replay potential
- an excellent hackathon build log story

---

# 30. Agent Architecture

Avoid pretending the app needs fifteen agents.

A clean architecture is stronger.

## Roles

### Sourcing Planner

Turns the campaign into:

- search queries
- target directories
- qualification criteria

### Vendor Analyst

Processes crawled pages and maintains structured vendor records.

### Correspondence Agent

Handles:

- outreach
- clarification
- follow-up
- negotiation

### Procurement Controller

Maintains campaign-level state and decides:

- whether more vendors are needed
- who to contact
- who needs follow-up
- whether an offer is complete
- whether a vendor should be eliminated
- whether negotiation should continue

The controller should use deterministic constraints around LLM decisions.

---

# 31. Event-Driven Agent Loop

The application should respond to events rather than repeatedly running a giant agent prompt.

Example:

```text
EVENT: campaign.created
→ plan sourcing

EVENT: vendor.discovered
→ enrich vendor

EVENT: vendor.enriched
→ qualify

EVENT: vendor.qualified
→ maybe contact

EVENT: message.received
→ classify message
→ extract structured fields
→ update offer
→ identify missing info
→ choose next action

EVENT: offer.updated
→ recompute ranking
→ evaluate negotiation

EVENT: campaign.stalled
→ follow up or source additional vendors
```

This architecture is naturally compatible with Convex.

---

# 32. Human-in-the-Loop Controls

The UI should expose agent authority clearly.

Example:

## Agent Permissions

```text
Discovery                 AUTO
Vendor outreach           AUTO
Clarification             AUTO
Negotiation               AUTO
Accept final offer        ASK
Share phone number        ASK
Pay deposit               NEVER
```

This makes the product feel trustworthy and serious.

---

# 33. Firecrawl Integration

Firecrawl should perform real product work.

## Use Cases

### Discovery
Find relevant businesses.

### Site Extraction
Extract:

- service lists
- pricing
- locations
- policies
- portfolio details
- contact data

### Contact Discovery
Locate valid email/contact pages.

### Freshness
Re-crawl vendors when old data becomes stale.

### Evidence
Preserve source URL and extracted snippet for claims.

### Supplier Monitoring
Long-term version could detect:

- changed prices
- new services
- closed business
- new service areas

---

# 34. AgentMail Integration

AgentMail is not merely used to send an initial message.

It is the product's real-world action channel.

## AgentMail Powers

- campaign-specific inboxes
- outbound RFQs
- inbound responses
- email threading
- follow-ups
- clarification questions
- negotiation
- attachments
- persistent communication history

Every thread maps to:

```text
campaign
→ vendor
→ thread
→ messages
→ offers
```

---

# 35. OpenAI / Codex Role

## OpenAI Runtime Tasks

- parse natural-language procurement requests
- create structured requirements
- generate search strategies
- extract vendor facts
- resolve ambiguous vendor records
- parse emails
- normalize offers
- detect missing information
- draft correspondence
- negotiate under constraints
- explain rankings

## Codex During Build

The hackathon explicitly values Codex usage.

Use Codex to:

- scaffold the Convex application
- iterate on schema
- build reactive views
- implement components
- maintain `/hackathon` logs
- review Convex usage
- create test fixtures
- verify deployment

The final project can clearly demonstrate both **Codex as the builder** and **OpenAI models as product intelligence**.

---

# 36. Main Screens

## Screen 1 — Home

One big input:

> **What do you need?**

Example chips:

- Wedding photographer
- Movers
- Catering
- Private tutor
- Repair service
- Event venue

CTA:

**Make them compete**

---

# 37. Screen 2 — Requirement Review

Show interpreted requirements.

Example:

```text
Wedding Photographer
Mumbai · Oct 18

Budget
Target: ₹32k
Maximum: ₹40k

Required
✓ Available Oct 18
✓ 8h coverage
✓ Edited photos
✓ Highlight video

Preferred
○ Drone footage
○ Raw photos
```

CTA:

**Start sourcing**

---

# 38. Screen 3 — Live Campaign

Hero area:

```text
Wedding Photographer

43 found
19 qualified
12 contacted
8 replied
3 negotiating
```

Below:

live pipeline.

Side panel:

**Activity**

```text
14:32 Pixel House replied
14:32 Quote extracted: ₹36,000
14:33 Missing travel fee detected
14:33 Follow-up sent
14:37 Samarth revised offer
14:37 ₹38,000 → ₹33,000
```

This should update through Convex subscriptions.

---

# 39. Screen 4 — Compare

A structured comparison.

Rows:

- current price
- initial price
- availability
- required services
- optional services
- taxes
- travel
- response time
- delivery time
- confidence
- historical data

The user can instantly see why the system prefers one vendor.

---

# 40. Screen 5 — Vendor Profile

Shows accumulated private intelligence.

Example:

```text
Samarth Weddings

Website
Mumbai

Campaign history: 4

Average initial quote     ₹38,200
Average final quote       ₹33,900
Average discount          11.3%
Median response time      21m
Reply rate                100%
User rating               4.7
```

This screen communicates the defensibility story.

---

# 41. Screen 6 — Thread

A clean email thread.

Alongside it:

```text
STRUCTURED OFFER

₹33,000 all-inclusive

8 hours        ✓
Video          ✓
Travel         ✓
GST            ✓
Raw footage    ✗

Confidence: 97%
```

The relationship between unstructured human conversation and structured procurement state becomes obvious.

---

# 42. The Demo

The demo must not begin from a blank campaign and wait for real businesses.

Use two layers:

1. a fresh campaign to show discovery
2. a seeded campaign with realistic historical state to show the complete lifecycle

## Demo Scenario

**Wedding Photographer · Mumbai**

### Opening

Say:

> “Normally I'd search dozens of photographers, fill forms, wait for responses, and compare quotes manually. Here I just tell Counteroffer what I need.”

Enter:

> “Wedding photographer in Mumbai on October 18. Eight hours, candid photography and highlight video. Try to stay under ₹40,000.”

Click:

**Start sourcing**

---

# 43. Demo Beat 1 — Discovery

Immediately show:

```text
Searching the web...
12 vendors
27 vendors
43 vendors
```

Vendor cards appear.

Firecrawl evidence can be opened.

One vendor gets merged with a duplicate.

Small visual moment:

```text
Samarth Photography
+
Samarth Weddings
→ Same vendor
```

This signals technical depth quickly.

---

# 44. Demo Beat 2 — Existing Campaign

Switch to:

**Started yesterday**

Now:

```text
43 discovered
19 qualified
12 contacted
8 replied
3 negotiating
```

Show the quote leaderboard.

Best current offer:

```text
₹33,000
```

Original average quote:

```text
₹39,400
```

Savings:

```text
₹6,400
```

---

# 45. Demo Beat 3 — Email Intelligence

Open a vendor email.

Actual message:

> “We can do 8 hours at 35k plus GST. Video included, but travel outside Mumbai is extra.”

Alongside, the app has extracted:

```text
₹41,300 estimated total
8 hours ✓
Video ✓
GST extra
Travel uncertain
```

The viewer immediately understands the system is doing more than summarization.

---

# 46. Demo Beat 4 — Live Reply

This is the climax.

Arrange for a controlled test vendor to reply during the demo.

Incoming message:

> “We can match ₹31,000 all-inclusive if you confirm this week.”

AgentMail receives it.

Convex updates.

The card visibly moves/reorders.

```text
Pixel House

₹36,000
↓
₹31,000
```

Banner:

> **New best offer**

The leaderboard changes instantly.

This demonstrates all key technologies in one moment.

---

# 47. Demo Beat 5 — Long-Term Moat

Finish by opening the vendor profile.

Say:

> “And none of this disappears after the campaign. Every quote and negotiation becomes part of your private supplier network.”

Show:

```text
Typical initial quote: ₹36,700
Typical final quote: ₹31,900
Typical discount: 13%
Median response time: 14m
```

Final line:

> **The first campaign saves you time. Every campaign after that makes the system a better buyer.**

---

# 48. Video Structure — Under 3 Minutes

## 0:00–0:15
Problem + one-line pitch.

## 0:15–0:35
Create request.

## 0:35–0:55
Firecrawl discovery and qualification.

## 0:55–1:25
Existing campaign with real emails and normalized quotes.

## 1:25–1:50
Negotiation history.

## 1:50–2:15
Live inbound email changes best offer.

## 2:15–2:35
Vendor intelligence/history.

## 2:35–2:50
Architecture / sponsor stack.

## 2:50–3:00
Closing statement.

Talk less.

Click more.

---

# 49. Seed Data Strategy

The hackathon demo should not depend on random real businesses replying at the right time.

Create a small controlled vendor universe for the full-lifecycle demo.

Possible setup:

- 8–12 test vendor inboxes
- realistic vendor websites/pages
- pre-scripted reply behavior
- distinct pricing patterns
- missing fields
- one negotiable vendor
- one expensive premium vendor
- one low-price incomplete vendor
- one nonresponsive vendor

Then separately demonstrate Firecrawl against real public websites for discovery.

This gives deterministic demo quality while preserving a real working system.

Clearly label test/demo vendors if necessary.

Do not fabricate claims about real businesses.

---

# 50. Example Vendor Behaviors

### Vendor A — Cheapest but incomplete

```text
₹29,000
No video
Slow response
```

### Vendor B — Strong overall

```text
₹36,000 → ₹31,000
All requirements
Fast response
```

### Vendor C — Premium

```text
₹52,000
Excellent portfolio
No negotiation
```

### Vendor D — Hidden fees

```text
₹30,000 advertised
+ GST
+ travel
+ video addon

Actual: ₹43,400
```

This makes quote normalization visually meaningful.

---

# 51. Anti-Clone Features

Do not spend hackathon time on features that merely make the UI larger.

Prioritize features that deepen the core system.

## Tier 1

- persistent campaigns
- real AgentMail threads
- Firecrawl evidence
- quote normalization
- multi-turn follow-up
- negotiation history
- vendor identity resolution
- real-time state updates

## Tier 2

- vendor historical metrics
- cross-campaign supplier memory
- price distributions
- response latency metrics
- learned ranking

## Tier 3

- collaboration
- vendor recommendations from previous campaigns
- recurring sourcing
- automatic re-tendering
- calendar integration
- payments

---

# 52. Scope for Hackathon

Do not attempt a generic procurement platform for every possible service on day one.

The engine can be generic internally.

The demo should focus on **one or two categories**.

Best demo categories:

### Wedding / Event Photography

Pros:

- easy to understand
- large price differences
- rich package details
- visually attractive
- negotiation plausible

### Catering

Pros:

- pricing has line items
- per-person normalization
- date/quantity constraints
- many local vendors

### Movers

Pros:

- obvious pain point
- quotes vary substantially
- many hidden fees
- easy consumer value

Recommended:

**Primary demo: wedding photographer**  
**Secondary demo: catering**

This proves generality without losing focus.

---

# 53. MVP

A legitimate MVP should support:

1. Create procurement request.
2. Parse structured requirements.
3. Firecrawl search/discovery.
4. Build canonical vendor records.
5. Qualify shortlist.
6. Create AgentMail campaign inbox.
7. Send RFQ.
8. Receive replies.
9. Parse structured offer.
10. Normalize price.
11. Update campaign in real time.
12. Detect missing fields.
13. Send one automatic follow-up.
14. Compare vendors.
15. Store vendor history.

If those work beautifully, the project is already strong.

---

# 54. Winning Version

After MVP:

1. Multi-round negotiation.
2. Duplicate vendor resolution.
3. Historical negotiation metrics.
4. Persistent supplier graph.
5. Evidence/provenance view.
6. Human approval boundaries.
7. Strong live activity feed.
8. Controlled live-email demo.
9. Polished public deployment.
10. Social-media-ready visual clip.

---

# 55. Build Sequence

## Phase 1 — Skeleton

- initialize Convex project
- create schema
- build campaign creation
- build reactive campaign UI
- deploy early

Verification:

- public URL works
- campaign persists
- live subscription works

---

# 56. Phase 2 — Firecrawl

Implement:

- search planner
- vendor discovery
- page extraction
- evidence storage
- contact extraction

Verification:

Given:

> wedding photographer Mumbai

the system should produce structured vendor records with evidence.

---

# 57. Phase 3 — AgentMail

Implement:

- inbox creation per campaign
- outbound RFQ
- inbound thread sync
- vendor/thread mapping

Verification:

Send a real email from a test account and confirm:

```text
email arrives
→ Convex event created
→ UI updates without refresh
```

---

# 58. Phase 4 — Offer Extraction

Implement:

- message classification
- quote extraction
- line-item parsing
- completeness detection

Verification fixtures:

- package quote
- taxes excluded
- per-hour quote
- ambiguous quote
- multiple packages
- missing price
- no availability

---

# 59. Phase 5 — Comparison

Implement:

- normalized totals
- requirement matrix
- ranking
- explanation

Verification:

A cheaper but incomplete vendor should not automatically outrank a complete offer.

---

# 60. Phase 6 — Follow-Up

Implement:

```text
reply
→ missing fields
→ follow-up generated
→ sent
→ second reply
→ offer updated
```

This is the minimum credible autonomous loop.

---

# 61. Phase 7 — Negotiation

Add:

- target
- hard maximum
- allowed tactics
- negotiation state
- revision history

Verification:

Agent should never:

- exceed hard max
- fabricate competitor offer
- accept a deal

---

# 62. Phase 8 — Historical Intelligence

Add aggregates:

- response rate
- median response time
- initial price
- final price
- negotiated delta
- campaign count

This turns the demo from “cool workflow” into “network that compounds.”

---

# 63. Phase 9 — Demo Polish

Focus heavily on:

- animation
- transitions
- counters
- activity timeline
- quote-change visuals
- clear evidence
- beautiful comparison view

Do not confuse polish with unnecessary UI.

The most important visual moments are:

1. vendor cards appearing
2. duplicate records merging
3. emails arriving
4. offer extraction
5. quote changing
6. ranking reordering

---

# 64. Testing Strategy

## Deterministic Fixtures

Create test emails for:

- clear quote
- incomplete quote
- multiple packages
- rejection
- unavailable vendor
- counteroffer
- price reduction
- hidden tax
- attachment mention
- unrelated email

## Agent Tests

Check:

- extraction accuracy
- missing-field detection
- negotiation boundary adherence
- no fabricated claims
- no accidental acceptance

## State Machine Tests

Check valid transitions.

Example:

```text
discovered → qualified
qualified → contacted
contacted → replied
replied → negotiating
negotiating → finalist
```

Invalid transitions should be rejected.

---

# 65. Evaluation Metrics

Even for a hackathon, having real metrics makes the project feel serious.

Possible metrics:

## Vendor Discovery Precision

Of discovered vendors, how many actually match category/location?

## Quote Extraction Accuracy

How often are:

- total
- tax
- deliverables
- availability
- missing fields

correctly extracted?

## Offer Completeness

Before vs after autonomous clarification.

Example:

```text
Initial response completeness: 61%
After follow-up: 94%
```

## Negotiation Improvement

```text
Median initial quote: ₹38,000
Median final quote: ₹33,000
Median reduction: 13.2%
```

## User Effort Reduction

```text
Manual emails written: 0
Vendor pages opened manually: 0
Quotes normalized manually: 0
```

These can appear directly in the demo.

---

# 66. Judging Criteria Alignment

## Everyday Apps

Extremely strong.

Normal people routinely need:

- movers
- photographers
- caterers
- tutors
- repair services
- venues
- contractors

The workflow is familiar.

---

# 67. Creativity and Usefulness

The novelty is not simply:

> AI recommends vendors.

The system becomes the buyer:

```text
discover
→ qualify
→ contact
→ clarify
→ negotiate
→ compare
→ remember
```

This is both useful immediately and structurally interesting.

---

# 68. Convex Depth

Convex runs:

- campaign state
- supplier graph
- reactive live board
- event logs
- email-derived updates
- historical metrics
- background workflows
- queries
- mutations

It is integral to the system.

---

# 69. Sponsor Stack

## Convex

Persistent reactive world state.

## Firecrawl

Observes the web and extracts suppliers/evidence.

## AgentMail

Acts on the outside world through email.

## OpenAI

Reasons over requirements, vendors, correspondence, and offers.

Clean framing:

> **Firecrawl observes the market. AgentMail interacts with it. OpenAI reasons about it. Convex remembers it.**

That sentence should probably appear somewhere in the submission.

---

# 70. Social Proof Potential

The product naturally creates good social clips.

Potential launch clip:

```text
I told an agent I needed a wedding photographer under ₹40k.

It found 43.
Emailed 12.
Got 8 replies.
Negotiated with 3.

Best quote:
₹38k → ₹31k.

I never opened Google.
```

Then show the live UI.

That is far more shareable than a generic dashboard demo.

---

# 71. Potential Risks

## Email Spam

Mitigation:

- cap vendors per campaign
- require qualification threshold
- rate limits
- user approval option
- no repeated unsolicited follow-ups

## Bad Extraction

Mitigation:

- preserve source messages
- confidence scores
- visible assumptions
- user correction

## Hallucinated Vendor Facts

Mitigation:

- provenance on extracted claims
- never assert unsupported facts
- separate crawled evidence from inference

## Reckless Negotiation

Mitigation:

- deterministic hard limits
- approval controls
- no binding commitments

## Scraping Restrictions

Mitigation:

- respect website policies
- use public pages
- avoid restricted/private sources
- cache intelligently

---

# 72. Product Extensions

Longer-term possibilities:

## Business Procurement

SMBs sourcing:

- printing
- logistics
- office supplies
- contractors
- agencies
- equipment

## Group Purchasing

Multiple buyers combine demand.

Example:

```text
12 apartments need AC servicing.
```

The agent negotiates bulk pricing.

## Reverse Auctions

Qualified vendors can submit structured bids.

## Recurring Procurement

Example:

> Re-source our office snack supplier every quarter.

## Price Intelligence

Build true transaction-informed local price benchmarks.

## Supplier CRM

For buyers rather than sellers.

---

# 73. Strongest Long-Term Insight

Google and marketplaces mostly tell you:

> **Who exists?**

Counteroffer gradually learns:

> **Who actually responds?**

> **What do they really charge?**

> **How much will they negotiate?**

> **What are they good at?**

> **Will they work for this specific user?**

That information is much harder to crawl from the public web because it emerges through interaction.

The product converts private interactions into structured buyer intelligence.

---

# 74. Final Product Thesis

The first version looks like an autonomous quote-shopping agent.

The deeper product is:

> **A private procurement graph built from the combination of public web knowledge and private market interactions.**

Every campaign expands the graph.

Every email validates it.

Every negotiation adds price intelligence.

Every completed purchase teaches the system what the user actually values.

Eventually, procurement starts with the user's existing supplier network rather than the public internet.

That is the defensibility.

---

# 75. Hackathon North Star

Do not optimize for the number of features.

Optimize for one magical loop working end-to-end:

```text
USER NEED
   ↓
WEB DISCOVERY
   ↓
VENDOR SHORTLIST
   ↓
REAL EMAIL
   ↓
REAL RESPONSE
   ↓
STRUCTURED OFFER
   ↓
AUTONOMOUS FOLLOW-UP
   ↓
BETTER OFFER
   ↓
LIVE UI UPDATE
   ↓
PERSISTENT SUPPLIER INTELLIGENCE
```

If that loop feels real, fast, and visually alive, the project will look substantially more ambitious than a typical weekend AI application while still being understandable to anyone in seconds.

---

# 76. One-Sentence Submission Version

> **Counteroffer is an autonomous buyer that searches the web for suppliers, contacts and negotiates with them over its own inbox, compares live offers in real time, and builds a private supplier network that gets smarter with every purchase.**

---

# 77. One-Sentence Demo Version

> **Instead of searching for vendors and asking for quotes yourself, tell Counteroffer what you need and make the market compete for you.**
