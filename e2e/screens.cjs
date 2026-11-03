// Screenshots of every built screen at 1440 and 390 wide into
// replica/clone-screens, plus checks per screen: console errors, horizontal
// overflow at 390, and a 60-character product name.
//   node e2e/screens.cjs   (server running on BASE, default :3100)
const { chromium } = require("playwright");
const path = require("path");

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = path.join(__dirname, "..", "replica", "clone-screens");
const problems = [];

(async () => {
  const browser = await chromium.launch();
  const setup = await (await browser.newContext()).newPage();

  // long content: a 60 character product name
  const longName = "Extra wide heavy duty event marquee with sidewalls and pegs 6";
  await setup.goto(`${BASE}/inventory/new`);
  await setup.getByLabel("Name").fill(longName.slice(0, 60));
  await setup.getByLabel("Unit IDs").fill(`MRQ-${Date.now().toString(36).toUpperCase()}`);
  await setup.getByRole("button", { name: "Save product" }).click();
  await setup.waitForURL(/\/inventory\/prd_/);
  const productPath = new URL(setup.url()).pathname;

  // ids for detail screens
  await setup.goto(`${BASE}/bookings?tab=all`);
  const bookingPath = await setup.locator('a[href^="/bookings/ord_"]').first().getAttribute("href");
  await setup.goto(`${BASE}/customers`);
  const customerPath = await setup.locator('a[href^="/customers/cus_"]').first().getAttribute("href");

  // a storefront cart and a finished booking
  const shopCtx = await browser.newContext();
  const shop = await shopCtx.newPage();
  await shop.goto(`${BASE}/shop/demo`);
  await shop.getByRole("link", { name: /Video tripod/ }).click();
  await shop.waitForURL(/\/p\//);
  const productShopPath = new URL(shop.url()).pathname;
  await shop.getByRole("button", { name: "Next month" }).click();
  const next = new Date();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const ym = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  await shop.locator(`button[data-day="${ym}-20"]`).click();
  await shop.locator(`button[data-day="${ym}-22"]`).click();
  await shop.getByRole("button", { name: "Add to cart" }).click();
  await shop.waitForURL(/\/cart$/);
  const cookies = await shopCtx.cookies();

  const screens = [
    ["S03-today", "/dashboard"],
    ["S04-bookings", "/bookings?tab=all"],
    ["S05-booking", bookingPath],
    ["S11-inventory", "/inventory"],
    ["S12-new-product", "/inventory/new"],
    ["S13-product", productPath],
    ["S19-customers", "/customers"],
    ["S20-customer", customerPath],
    ["S28-store", "/shop/demo"],
    ["S29-store-product", productShopPath],
    ["S31-cart", "/shop/demo/cart"],
    ["S32-checkout", "/shop/demo/checkout"],
  ];

  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies(cookies);
    for (const [id, url] of screens) {
      const page = await ctx.newPage();
      page.on("console", (m) => m.type() === "error" && problems.push(`${id}@${w}: console: ${m.text()}`));
      page.on("pageerror", (e) => problems.push(`${id}@${w}: ${e.message}`));
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      // capture the whole page: the back office scrolls inside <main>
      await page.addStyleTag({ content: ".h-dvh{height:auto!important} main{overflow:visible!important}" });
      await page.screenshot({ path: path.join(OUT, `${id}${w === 390 ? "-390" : ""}.png`), fullPage: true });
      if (w === 390) {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 0) {
          const culprits = await page.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && ![...e.children].some((c) => c.getBoundingClientRect().right > window.innerWidth + 1))
              .slice(0, 3)
              .map((e) => `<${e.tagName.toLowerCase()} class="${String(e.className?.baseVal ?? e.className).slice(0, 60)}"> "${(e.textContent ?? "").trim().slice(0, 40)}"`),
          );
          problems.push(`${id}@390: ${over}px horizontal overflow from ${culprits.join(" | ")}`);
        }
      }
      await page.close();
    }
    await ctx.close();
  }

  // confirmation page: book the cart
  await shop.goto(`${BASE}/shop/demo/checkout`);
  await shop.getByLabel("Full name").fill("Screenshot Customer");
  await shop.getByLabel("Email").fill("shots@example.com");
  await shop.getByRole("button", { name: "Book now" }).click();
  await shop.waitForURL(/\/order\//);
  await shop.setViewportSize({ width: 1440, height: 900 });
  await shop.screenshot({ path: path.join(OUT, "S33-confirmation.png"), fullPage: true });
  await shop.setViewportSize({ width: 390, height: 844 });
  await shop.screenshot({ path: path.join(OUT, "S33-confirmation-390.png"), fullPage: true });

  console.log(`${screens.length + 1} screens x 2 widths saved to replica/clone-screens`);
  console.log("problems:", problems.length ? problems : "none");
  await browser.close();
  if (problems.length) process.exit(1);
})().catch((e) => {
  console.error("✗", e.message.split("\n")[0]);
  process.exit(1);
});
