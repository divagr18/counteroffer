/**
 * Submission screenshots.
 *
 * Runs the seeded campaign for real first, so every shot has a worked board
 * behind it rather than empty columns, then captures each screen at 2x for
 * print-sharp output (3840x2160).
 *
 *   node docs/demo/screenshots.cjs [--skip-run]
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("D:/AdBreak/data/demo-recording/runtime/node_modules/playwright");
const { ConvexHttpClient } = require("convex/browser");
const { anyApi } = require("convex/server");

const SITE = process.env.DEMO_SITE_URL || "https://lovely-cod-509.convex.site";
const CLOUD = process.env.DEMO_CLOUD_URL || "https://lovely-cod-509.convex.cloud";
const CHROME =
  process.env.DEMO_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(__dirname, "../../data/demo-recording/screenshots");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const convex = new ConvexHttpClient(CLOUD);

const CLEAN_CHROME = `
  *{scrollbar-width:none!important}
  ::-webkit-scrollbar{display:none!important}
  *{caret-color:transparent!important}
`;

async function recordedCampaign() {
  const list = await convex.query(anyApi.campaigns.list, {});
  const row = list.find((e) => e.campaign.title === "Wedding Photographer — Mumbai");
  if (!row) throw new Error("seed the campaigns first");
  return row.campaign._id;
}

/** Put the board in the state worth photographing. */
async function runPipeline(campaignId) {
  const before = await convex.query(anyApi.campaigns.get, { campaignId });
  if (before.counts.contacted === 0 && before.counts.replied === 0) {
    console.log("starting outreach (mock transport — no mail is sent)");
    await convex.mutation(anyApi.campaigns.contactVendors, { campaignId });
  }
  const deadline = Date.now() + 8 * 60 * 1000;
  let last = "";
  while (Date.now() < deadline) {
    const d = await convex.query(anyApi.campaigns.get, { campaignId });
    const k = d.counts;
    const line = `c${k.contacted} r${k.replied} n${k.negotiating} f${k.finalist} e${k.eliminated}`;
    if (line !== last) {
      last = line;
      console.log(
        `  ${line}  best ${d.bestOffer ? d.bestOffer.offer.estimatedTotal : "-"}`,
      );
    }
    if (k.finalist + k.selected >= 2 && k.eliminated >= 1 && k.negotiating <= 1) {
      console.log("  board is worth photographing");
      return;
    }
    await sleep(4000);
  }
  console.log("  proceeding with whatever the board has");
}

/** Open the campaign that has run, not a draft that shares its title. */
async function openWorkedBoard(page) {
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: CLEAN_CHROME });
  await sleep(1800);
  const row = page
    .locator("tr")
    .filter({ hasText: "Wedding Photographer — Mumbai" })
    .filter({ hasText: "₹" });
  if ((await row.count()) === 0) throw new Error("no worked campaign on the home table");
  await row.first().click();
  await page.waitForSelector("text=Quote board", { timeout: 40000 });
  await page.waitForSelector("tbody tr", { timeout: 40000 });
  await sleep(2500);
}

async function shoot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`  ${name}.png  ${kb}kb`);
}

(async () => {
  const campaignId = await recordedCampaign();
  if (!process.argv.includes("--skip-run")) await runPipeline(campaignId);

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    // --- home ---------------------------------------------------------------
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: CLEAN_CHROME });
    await sleep(2500);
    await shoot(page, "01-home");

    // --- the board that has actually run -------------------------------------
    await openWorkedBoard(page);
    await shoot(page, "02-board");

    // --- why a vendor ranks where it does ------------------------------------
    const why = page.getByRole("button", { name: "why?" });
    const whyCount = await why.count();
    if (whyCount > 0) {
      await why.nth(Math.min(4, whyCount - 1)).click();
      await sleep(1400);
      await shoot(page, "03-why-it-ranks-there");
      await page.getByRole("button", { name: "hide" }).first().click();
      await sleep(700);
    }

    // --- a thread: the email beside what the agent understood ----------------
    const emails = page.getByRole("button", { name: "Emails" });
    if (await emails.count()) {
      await emails.first().click();
      await sleep(2800);
      await shoot(page, "04-thread");
      await page.getByRole("button", { name: "Close" }).first().click();
      await sleep(1200);
    }

    // --- offers side by side --------------------------------------------------
    await page.getByRole("button", { name: "Compare" }).first().click();
    await sleep(2200);
    await shoot(page, "05-compare");
    await page.getByRole("button", { name: "Board" }).first().click();
    await sleep(1200);

    // --- the approval gate ----------------------------------------------------
    const choose = page.getByRole("button", { name: "Choose" });
    if (await choose.count()) {
      await choose.first().click();
      await sleep(2800);
      await shoot(page, "06-waiting-on-you");
    }

    // --- the supplier network it keeps ---------------------------------------
    await page.locator('nav button[aria-label="Supplier network"]').click();
    await sleep(2800);
    await shoot(page, "07-supplier-network");
    const vendorRow = page.locator("tbody tr").first();
    if (await vendorRow.count()) {
      await vendorRow.click();
      await sleep(2400);
      await shoot(page, "08-supplier");
    }

    // --- requirements review, last: it creates a draft campaign ---------------
    await page.goto(SITE, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: CLEAN_CHROME });
    await sleep(1600);
    await page
      .locator("textarea")
      .first()
      .fill(
        "Wedding photographer in Mumbai on October 18. Eight hours, candid photography and a highlight video. Keep it between ₹32,000 and ₹40,000.",
      );
    await sleep(500);
    await page.getByRole("button", { name: "Start sourcing" }).first().click();
    await page.waitForSelector("text=Must have", { timeout: 90000 }).catch(() => {});
    await sleep(2800);
    await shoot(page, "09-requirements");
  } finally {
    await browser.close();
  }
  console.log(`screenshots in ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
