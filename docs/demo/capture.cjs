/**
 * Demo capture.
 *
 * Drives the deployed app in a real browser and records two videos:
 *
 *   live/    one continuous take of the board while the agent actually works
 *            (outreach going out, replies landing, prices moving, vendors
 *            being eliminated). This is where the cold open comes from.
 *   detail/  the scripted close-ups once the board has matured: a thread, the
 *            ranking explanation, the budget guardrail, the approval gate, the
 *            supplier network.
 *
 * Both write marks.json — a label plus the second it happened — so edit.json
 * can cut to real moments instead of guessed timestamps.
 *
 * Nothing here sends email: the deployment runs with EMAIL_TRANSPORT=mock.
 *
 *   node docs/demo/capture.cjs [--skip-prep]
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("D:/AdBreak/data/demo-recording/runtime/node_modules/playwright");
const { ConvexHttpClient } = require("convex/browser");
const { anyApi } = require("convex/server");

const SITE = process.env.DEMO_SITE_URL || "https://lovely-cod-509.convex.site";
const CLOUD = process.env.DEMO_CLOUD_URL || "https://lovely-cod-509.convex.cloud";
const CHROME =
  process.env.DEMO_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(__dirname, "../../data/demo-recording");
const VIEWPORT = { width: 1920, height: 1080 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const convex = new ConvexHttpClient(CLOUD);

// ---------------------------------------------------------------------------
// Camera motion: nothing on screen is allowed to sit still for long.
// ---------------------------------------------------------------------------

async function moveTo(page, x, y, steps = 26) {
  await page.mouse.move(x, y, { steps });
}

/** Travel to an element and stop on it, so its hover state fires on camera. */
async function hoverEl(page, locator, hold = 500) {
  const one = locator.first();
  const box = await one.boundingBox().catch(() => null);
  if (!box) return false;
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(hold);
  return true;
}

/** Run a step; a selector that does not match must not end the take. */
async function safe(label, fn) {
  try {
    return await fn();
  } catch (e) {
    const first = String(e.message).split("\n")[0];
    console.log(`  (skipped ${label}: ${first.slice(0, 90)})`);
    return null;
  }
}

async function clickEl(page, locator, hold = 420) {
  const one = locator.first();
  const ok = await hoverEl(page, one, hold);
  if (!ok) return false;
  await one.click({ timeout: 8000 }).catch(() => {});
  return true;
}

async function smoothWheel(page, amount, steps = 9, delay = 85) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, amount / steps);
    await sleep(delay);
  }
}

async function typewriter(page, locator, text) {
  await locator.click();
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(28 + Math.random() * 55);
  }
}

// ---------------------------------------------------------------------------
// Recording harness
// ---------------------------------------------------------------------------

async function record(browser, name, run) {
  const dir = path.join(OUT, "raw", name);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir, size: VIEWPORT },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const started = Date.now();
  const marks = [];
  const mark = (label) => {
    const seconds = (Date.now() - started) / 1000;
    marks.push({ label, seconds });
    fs.writeFileSync(
      path.join(dir, "marks.json"),
      JSON.stringify({ started, marks }, null, 2),
    );
    console.log(`  ${name} @${seconds.toFixed(1)}s  ${label}`);
    return seconds;
  };
  const hold = async (label, seconds) => {
    mark(label);
    await sleep(seconds * 1000);
  };

  const videoPath = await page.video().path();
  try {
    await run(page, mark, hold);
  } finally {
    mark("end");
    await context.close();
    fs.writeFileSync(path.join(dir, "video-path.txt"), videoPath);
    console.log(`  ${name} -> ${videoPath}`);
  }
  return { dir, videoPath, marks };
}

// ---------------------------------------------------------------------------
// Prep: put the deployment in a known state, then set it running.
// ---------------------------------------------------------------------------

function cli(args) {
  return execFileSync("npx", ["convex", ...args], {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function prepare() {
  console.log("prep: resetting deployment");
  cli(["run", "--prod", "seed:resetDemoData", "{}"]);
  console.log("prep: seeding past campaign (supplier history)");
  cli(["run", "--prod", "seed:seedDemo", "{}"]);
  console.log("prep: seeding the campaign we record");
  const out = cli(["run", "--prod", "seed:seedInstantDemo", "{}"]);
  const campaignId = JSON.parse(out.slice(out.indexOf("{"))).campaignId;
  console.log(`prep: campaign ${campaignId}`);
  return campaignId;
}

async function currentCampaignId() {
  const list = await convex.query(anyApi.campaigns.list, {});
  const row = list.find((e) => e.campaign.title === "Wedding Photographer — Mumbai");
  if (!row) throw new Error("recording campaign not found — run prep first");
  return row.campaign._id;
}

// ---------------------------------------------------------------------------
// Take 1: the live board
// ---------------------------------------------------------------------------

async function liveTake(browser, campaignId) {
  return record(browser, "live", async (page, mark, hold) => {
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: "*{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}",
    });
    await sleep(1500);
    await hold("home", 2);

    // Type the request so the viewer sees where a campaign comes from.
    const box = page.locator("textarea").first();
    await typewriter(
      page,
      box,
      "Wedding photographer in Mumbai on October 18. Eight hours, candid photography and a highlight video. Try to stay under \u20b940,000.",
    );
    mark("typed-request");
    await sleep(1200);

    // Travel across the example chips rather than submitting: the campaign we
    // record is the seeded one, so discovery is not re-run on camera.
    for (const label of ["Catering", "Movers"]) {
      await safe(label, () =>
        hoverEl(page, page.getByRole("button", { name: label, exact: true }), 450),
      );
    }
    await hold("examples", 1);

    await clickEl(
      page,
      page.locator("tr", { hasText: "Wedding Photographer — Mumbai" }).first(),
    );
    await page.waitForSelector("text=Pipeline", { timeout: 30000 });
    mark("board-open");
    await sleep(1500);

    // Kick the agent off from inside the UI.
    const contact = page.getByRole("button", { name: /Contact \d+ vendors/ });
    if (await contact.count()) {
      await clickEl(page, contact, 700);
      mark("contact-clicked");
    }

    // Follow the work. Every time the activity feed changes, mark it and move
    // the camera to whatever just moved.
    const feedTop = page.locator("ol li").first();
    let last = "";
    const deadline = Date.now() + 9 * 60 * 1000;
    let idle = 0;

    while (Date.now() < deadline) {
      const text = await feedTop.innerText().catch(() => "");
      if (text && text !== last) {
        last = text;
        const line = text.replace(/\s+/g, " ").slice(0, 70);
        mark(`event: ${line}`);
        idle = 0;

        // Point at the vendor the event is about, if it is on the board.
        const name = [
          "Pixel House",
          "Samarth Weddings",
          "Stories Studio",
          "Frame Co",
          "Aurora Films",
          "BudgetClicks",
          "Verde Studio",
        ].find((n) => text.includes(n));
        if (name) {
          const card = page
            .locator("div")
            .filter({ hasText: new RegExp(`^${name}`) })
            .first();
          await hoverEl(page, card, 900).catch(() => {});
        }
      } else {
        idle += 1;
        // Quiet stretch: drift over the quote board so the frame keeps moving.
        if (idle % 4 === 0) {
          const rows = page.locator("tbody tr");
          const n = await rows.count().catch(() => 0);
          if (n > 0) {
            await hoverEl(page, rows.nth(idle % n), 700).catch(() => {});
          }
        }
      }

      const counts = await convex
        .query(anyApi.campaigns.get, { campaignId })
        .then((d) => d.counts)
        .catch(() => null);
      if (counts && counts.finalist + counts.selected >= 2 && counts.negotiating === 0) {
        mark("pipeline-settled");
        break;
      }
      await sleep(1200);
    }

    await hold("live-end", 3);
  });
}

// ---------------------------------------------------------------------------
// Take 3: real discovery
//
// Types a request and starts sourcing for real: Firecrawl searches the live
// web and vendors land in the pipeline as they are found. Safe to film only
// because the transport is mocked — the businesses this finds are real.
// ---------------------------------------------------------------------------

async function discoveryTake(browser) {
  return record(browser, "discovery", async (page, mark, hold) => {
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: "*{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}",
    });
    await sleep(1200);

    const box = page.locator("textarea").first();
    await typewriter(
      page,
      box,
      "Wedding photographer in Mumbai on October 18. Eight hours, candid photography and a highlight video. Try to stay under ₹40,000.",
    );
    mark("typed");
    await sleep(900);
    await clickEl(page, page.getByRole("button", { name: "Start sourcing" }), 700);
    mark("submitted");

    // Interpreted requirements.
    await page.waitForSelector("text=Budget", { timeout: 60000 }).catch(() => {});
    await sleep(2000);
    mark("requirements");
    await safe("budget", () => hoverEl(page, page.getByText("the most you will pay"), 1400));
    await safe("musthave", () => hoverEl(page, page.getByText("Must have"), 1200));
    await smoothWheel(page, 180, 6, 95);
    await sleep(900);

    await clickEl(page, page.getByRole("button", { name: "Start sourcing" }), 800);
    mark("sourcing-started");

    // Watch real discovery fill the board.
    const feedTop = page.locator("ol li").first();
    let last = "";
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      const text = await feedTop.innerText().catch(() => "");
      if (text && text !== last) {
        last = text;
        mark(`event: ${text.replace(/\s+/g, " ").slice(0, 70)}`);
      }
      const cards = page.locator("tbody tr, .grid > div");
      const n = await cards.count().catch(() => 0);
      if (n > 0) await safe("drift", () => hoverEl(page, cards.nth(n - 1), 700));
      await sleep(1500);
    }
    await hold("discovery-end", 2);
  });
}

// ---------------------------------------------------------------------------
// Take 2: the close-ups, once the board has settled
// ---------------------------------------------------------------------------

async function detailTake(browser) {
  return record(browser, "detail", async (page, mark, hold) => {
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: "*{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}",
    });
    await sleep(1200);
    await clickEl(
      page,
      page.locator("tr", { hasText: "Wedding Photographer — Mumbai" }).first(),
    );
    await page.waitForSelector("text=Quote board", { timeout: 30000 });
    await sleep(1500);
    mark("board");

    // --- a thread: raw email on the left, structured offer on the right ---
    const emailLinks = page.getByRole("button", { name: "Emails" });
    if (await emailLinks.count()) {
      await clickEl(page, emailLinks.first(), 600);
      await sleep(1800);
      mark("thread-open");
      await smoothWheel(page, 320, 10, 110);
      await sleep(1800);
      // trace the structured offer rows
      for (const label of ["Taxes", "Travel", "How complete this quote is"]) {
        await safe(label, () =>
          hoverEl(page, page.getByText(label, { exact: false }), 750),
        );
      }
      mark("offer-traced");
      await sleep(2200);
      await clickEl(page, page.getByRole("button", { name: "Close" }).first(), 400);
      await sleep(1200);
    }

    // --- why this one is ranked where it is ---
    const why = page.getByRole("button", { name: "why?" });
    if (await why.count()) {
      const target = why.nth(Math.min(3, (await why.count()) - 1));
      await clickEl(page, target, 650);
      mark("why-open");
      await sleep(5000);
      await clickEl(page, page.getByRole("button", { name: "hide" }).first(), 300);
      await sleep(700);
    }

    // --- the budget guardrail: an eliminated vendor and its reason ---
    const rejected = page.locator("button", { hasText: "exceeds hard budget" });
    if (await rejected.count()) {
      await hoverEl(page, rejected.first(), 5000);
      mark("guardrail-tooltip");
    }
    const perms = page.getByText("What the agent may do on its own");
    if (await perms.count()) {
      await safe("perms", () => hoverEl(page, perms, 800));
      await safe("accept-row", () =>
        hoverEl(page, page.getByText("Accept the final offer"), 2200),
      );
      mark("permissions");
    }

    // --- the human gate ---
    const choose = page.getByRole("button", { name: "Choose" });
    if (await choose.count()) {
      await clickEl(page, choose.first(), 700);
      mark("choose-clicked");
      await sleep(3000);
      const approve = page.getByRole("button", { name: "Approve" });
      if (await approve.count()) {
        await hoverEl(page, approve.first(), 1200);
        await clickEl(page, approve.first(), 400);
        mark("approved");
        await sleep(4000);
      }
    }

    // --- compare ---
    await clickEl(page, page.getByRole("button", { name: "Compare" }), 500);
    await sleep(1600);
    mark("compare");
    await smoothWheel(page, 300, 10, 110);
    await sleep(3000);
    await clickEl(page, page.getByRole("button", { name: "Board" }), 400);
    await sleep(1000);

    // --- close the campaign, then the supplier network ---
    const close = page.getByRole("button", { name: "Close campaign" });
    if (await close.count()) {
      await clickEl(page, close.first(), 700);
      mark("campaign-closed");
      await sleep(3000);
    }

    await clickEl(page, page.locator('nav button[aria-label="Supplier network"]'), 600);
    await sleep(2500);
    mark("network");
    await smoothWheel(page, 260, 9, 110);
    await sleep(3000);
    const vendorRow = page.locator("tbody tr").first();
    if (await vendorRow.count()) {
      await clickEl(page, vendorRow, 600);
      await sleep(2200);
      mark("vendor-profile");
      await smoothWheel(page, 200, 8, 110);
      await sleep(3500);
    }
    await hold("detail-end", 2);
  });
}

// ---------------------------------------------------------------------------

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const skipPrep = process.argv.includes("--skip-prep");

  let campaignId;
  if (skipPrep) {
    campaignId = await currentCampaignId();
    console.log(`reusing campaign ${campaignId}`);
  } else {
    campaignId = prepare();
  }

  const only = process.argv.find((a) => a.startsWith("--only="));
  const takes = only ? only.slice(7).split(",") : ["live", "detail", "discovery"];

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    if (takes.includes("live")) {
      console.log("recording: live board");
      await liveTake(browser, campaignId);
    }
    if (takes.includes("detail")) {
      console.log("recording: close-ups");
      await detailTake(browser);
    }
    if (takes.includes("discovery")) {
      console.log("recording: real discovery");
      await discoveryTake(browser);
    }
  } finally {
    await browser.close();
  }
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
