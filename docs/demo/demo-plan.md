# Counteroffer — demo

**Recorded.** `data/demo-recording/final/counteroffer-demo.mp4` — 2:30,
1920×1080, 30fps, one video stream and nothing else.

Subtitles are never burned into the picture. The narration lives in
`final/captions/counteroffer-demo.srt`, deliberately not beside the
video: a .srt sharing the video's basename makes most players turn captions on
by themselves, which looks identical to a burned-in track. Upload the .srt as a
caption file where you want captions, and ignore it where you do not.

Everything on screen is the deployed app at https://lovely-cod-509.convex.site.
No slides, no terminals, no static screens. The one non-app shot in the earlier
plan (the Convex dashboard) was dropped: the app carries the story on its own.

## No mail reaches anyone

The deployment runs with `EMAIL_TRANSPORT=mock`, so no inbox is created at
AgentMail and nothing is delivered. Vendors answer from the scripted persona
engine, and those answers still go through the real pipeline: the model parses
them, quotes are normalized, the negotiator counters, and the budget rules
eliminate whoever breaks them. The campaign inbox on screen reads
`…@sandbox.agentmail.to` so the recording never implies otherwise, and the
narration says it out loud at 0:59.

This is also what made it safe to film real discovery. Firecrawl searches the
live web and finds actual Mumbai studios; with the transport mocked, none of
them can be emailed.

Set `EMAIL_TRANSPORT=live` to send for real.

## How it was made

```
docs/demo/capture.cjs    drives the deployed app in Chrome, records three takes,
                         writes marks.json (label + second) for every beat
docs/demo/edit.json      the cut list: source, in-point, source length, out length
docs/demo/assemble.cjs   ffmpeg per-clip cut + speed remap + concat, and it
                         refuses to build a timeline shorter than the narration
docs/demo/vo_script.srt  28 cues, 150.5s
docs/demo/screenshots.cjs runs the board for real, then captures every screen
                         at 2x (3840x2160) into data/demo-recording/screenshots
```

Run order:

```bash
node docs/demo/capture.cjs      # ~20 min: prep, live take, close-ups, discovery
node docs/demo/assemble.cjs     # ~2 min
```

`capture.cjs --skip-prep` reuses the current deployment state, and
`--only=live,detail,discovery` records a subset.

### The three takes

| Take | Length | What it is |
|---|---|---|
| `live` | 9:25 | One unbroken take of the board while the agent works: RFQs going out 12s apart, replies landing, quotes extracted, counters sent, prices dropping, two vendors eliminated over the hard budget. The cold open comes from here. |
| `detail` | 1:16 | The close-ups once the board settled: a thread, the ranking explanation, the elimination reasons, the approval gate, compare, closing the campaign, the supplier network. |
| `discovery` | 5:32 | A campaign created from the home screen with real Firecrawl discovery: 6 queries, 35 candidate URLs, duplicates merged, unreachable vendors rejected with the reason. |

The capture script polls the activity feed and writes a mark whenever it
changes, so `edit.json` cuts to seconds that were observed rather than guessed.
Camera motion is built in: the pointer travels to whatever the feed just
mentioned, hovers so hover states fire, and drifts across the quote board
during quiet stretches. Nothing sits still.

## What the recording actually shows

Numbers below are from the take that was cut, not estimates.

| Vendor | Opening | Final | Outcome |
|---|---|---|---|
| Pixel House | ₹39,000 | ₹31,000 | best offer |
| Samarth Weddings | ₹38,500 | ₹31,000 | negotiating |
| Stories Studio | ₹33,500 | ₹27,140 | chosen, after approval |
| Verde Studio | ₹38,500 | ₹36,000 | finalist |
| Frame Co | ₹27,140 | ₹27,140 | cheapest, ranked 5th on a 17% complete quote |
| BudgetClicks | ₹30,090 headline | ₹43,890 all-in | eliminated, over the ₹40,000 hard budget |
| Aurora Films | ₹59,000 | ₹59,000 | eliminated, over the hard budget |

Best offer ₹31,000, which is ₹6,961 under the average opening quote.

Frame Co is the beat that matters: it is the cheapest quote in the room and it
loses, because the board ranks on requirement coverage and how complete a quote
is, not on price alone.

## If you re-record

- The board must be scored. Seeds call the scorer directly; if you load data any
  other way, run `offers:recomputeScores` or the ranking silently falls back to
  cheapest.
- Keep the two seeded campaigns distinct. `seedDemo` is the past campaign that
  gives vendors their history ("Engagement Shoot — Bandra"); `seedInstantDemo`
  is the one that gets recorded.
- `seed:resetDemoData` is internal, so it runs from the CLI and cannot be
  reached from the published URL.
- Narrate only numbers you have seen in the finished cut.

## Screenshots

`node docs/demo/screenshots.cjs` puts the seeded campaign through a real run
first, waits until there are finalists and at least one vendor eliminated, then
captures nine screens at 3840×2160:

| File | What it shows |
|---|---|
| `01-home.png` | The request box and the live campaign table |
| `02-board.png` | The worked board: four finalists, price drops, both budget eliminations with their reasons, best offer ₹31,000 at ₹6,961 under the average opening quote |
| `03-why-it-ranks-there.png` | The ranking explanation expanded under a row |
| `04-thread.png` | The RFQ the agent wrote, the vendor's reply, the counteroffer citing a real competing quote, and the structured offer beside it |
| `05-compare.png` | Every offer on the same basis |
| `06-waiting-on-you.png` | The approval gate before anything is committed |
| `07-supplier-network.png` | What past campaigns taught it about each supplier |
| `08-supplier.png` | One supplier's record |
| `09-requirements.png` | The interpreted requirements, editable before anything is sent |

`--skip-run` reuses the board as it stands. The requirements shot is captured
last because it creates a draft campaign; `seed:deleteDraftCampaigns` clears
those afterwards so the live site has no empty duplicates.

