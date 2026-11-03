// End-to-end check of the vertical slice against a running server.
//   npm run build && npx next start -p 3100
//   node e2e/slice.cjs            (BASE=http://localhost:3100 by default)
// Uses the pre-installed Playwright; /replica-test turns this into specs.
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:3100";
const errors = [];
const watch = (page, tag) => {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${tag}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
};
const step = (s) => console.log("✓", s);
const isoDay = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  watch(page, "office");
  const name = `Projector ${Date.now().toString(36)}`;

  // 1. a product with a single unit
  await page.goto(`${BASE}/inventory/new`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Unit IDs").fill(`PRJ-${Date.now().toString(36).toUpperCase()}`);
  await page.getByRole("button", { name: "Save product" }).click();
  await page.waitForURL(/\/inventory\/prd_/);
  await page.getByText("In stock", { exact: true }).first().waitFor();
  step("created a tracked product with one unit");

  // 2. back-office booking: customer, dates, item, reserve, hand out, take back
  await page.goto(`${BASE}/bookings/new`);
  await page.waitForURL(/\/bookings\/ord_/);
  await page.getByLabel("Find a customer").fill("Ana");
  await page.getByRole("button", { name: /Ana Lima/ }).click();
  await page.getByText("ana@example.com").waitFor();
  await page.getByLabel("Pickup", { exact: true }).fill(`${isoDay(3)}T10:00`);
  await page.getByLabel("Return", { exact: true }).fill(`${isoDay(5)}T10:00`);
  await page.getByRole("button", { name: "Set dates" }).click();
  await page.getByText("Dates saved.").waitFor();
  await page.getByLabel("Add items").fill(name);
  await page.getByRole("list", { name: "Matching products" }).getByRole("button", { name: "Add" }).click();
  await page.getByText("2 days at").waitFor();
  await page.getByRole("button", { name: "Reserve" }).click();
  await page.getByText("Reserved. The items are held").waitFor();
  step("back-office booking reserved");

  await page.getByRole("button", { name: "Hand out", exact: true }).click();
  await page.getByRole("button", { name: /Hand out 1 item/ }).click();
  await page.getByText("1 item handed out.").waitFor();
  step("handed the unit out");
  await page.getByRole("button", { name: "Take back", exact: true }).click();
  await page.getByLabel("Keep from the deposit").fill("25");
  await page.getByLabel("Keep from the deposit").blur();
  await page.getByLabel("Why").fill("Lens cap missing");
  await page.getByRole("button", { name: /Take back 1 item/ }).click();
  await page.getByText("1 item back in stock.").waitFor();
  await page.getByText("Lens cap missing").waitFor();
  step("took it back and kept $25 of the deposit");

  // 3. storefront race: two customers, the only unit, same dates, same moment
  const a = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pa = await a.newPage();
  const pb = await b.newPage();
  watch(pa, "customer A");
  watch(pb, "customer B");
  const next = new Date();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const ym = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  for (const [p, who] of [
    [pa, "a"],
    [pb, "b"],
  ]) {
    await p.goto(`${BASE}/shop/demo`);
    await p.getByRole("link", { name }).click();
    await p.getByRole("heading", { name: "When do you need it?" }).waitFor();
    await p.getByRole("button", { name: "Next month" }).click();
    await p.locator(`button[data-day="${ym}-10"]`).click();
    await p.locator(`button[data-day="${ym}-12"]`).click();
    await p.getByRole("button", { name: "Add to cart" }).click();
    await p.waitForURL(/\/cart$/);
    await p.getByRole("link", { name: "Continue to checkout" }).click();
    await p.waitForURL(/\/checkout$/);
    await p.getByLabel("Full name").fill(`Racer ${who.toUpperCase()}`);
    await p.getByLabel("Email").fill(`racer-${who}@example.com`);
  }
  step("both customers have the only unit in their cart for the same dates");
  await Promise.all([pa.getByRole("button", { name: "Book now" }).click(), pb.getByRole("button", { name: "Book now" }).click()]);
  const settle = async (p) => {
    for (let i = 0; i < 40; i++) {
      if (/\/order\//.test(p.url())) return "booked";
      // Next.js adds an empty route announcer with role=alert; read only ones with text
      const alert = await p.getByRole("alert").filter({ hasText: /\S/ }).first().textContent({ timeout: 200 }).catch(() => null);
      if (alert) return alert;
      await p.waitForTimeout(250);
    }
    return "no outcome";
  };
  const [ra, rb] = await Promise.all([settle(pa), settle(pb)]);
  console.log("   customer A:", ra);
  console.log("   customer B:", rb);
  const booked = [ra, rb].filter((r) => r === "booked").length;
  if (booked !== 1) throw new Error(`expected exactly one booking, got ${booked}`);
  const loser = ra === "booked" ? rb : ra;
  const loserPage = ra === "booked" ? pb : pa;
  if (!/just booked|booked out|free for these dates/i.test(loser)) {
    await loserPage.screenshot({ path: "e2e/race-loser.png", fullPage: true });
    throw new Error(`the losing customer was not told why: "${loser}" at ${loserPage.url()} (screenshot e2e/race-loser.png)`);
  }
  step("race: exactly one booking, the other customer told it was just taken");

  await page.goto(`${BASE}/bookings?tab=all`);
  await page.getByText(/Racer [AB]/).first().waitFor();
  const rows = await page.getByText(/Racer [AB]/).count();
  if (rows !== 1) throw new Error(`expected one racer booking in the list, got ${rows}`);
  step("the winning online booking appears in Bookings");

  console.log("console errors:", errors.length ? errors : "none");
  await browser.close();
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error("✗", e.message.split("\n")[0]);
  console.log("console errors:", errors.length ? errors : "none");
  process.exit(1);
});
