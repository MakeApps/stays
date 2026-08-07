import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "admin@localshouts.co.th";
// Read from the environment so rotating the admin password does not break the
// suite. Set E2E_PASSWORD to match backend/.env.local.
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD (see backend/.env.local ADMIN_PASSWORD).");
  process.exit(2);
}

const errors = [];
const results = [];
const ok = (c, l, x = "") => results.push(`${c ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

async function fresh(url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
}

// sign in
await fresh(`${BASE}/login`);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

// ---------------- booking form: live totals ----------------
await fresh(`${BASE}/bookings/new`);
ok((await page.locator("text=Live total").count()) > 0, "booking form renders with live summary");

await page.fill('input[placeholder="e.g. Sarah Chen"]', "Sarah Chen");
await page.fill('input[type="date"] >> nth=0', "2026-10-01");
await page.fill('input[type="date"] >> nth=1', "2026-10-09");
await page.waitForTimeout(700);

const nightsChip = await page.locator("text=nights").first().locator("xpath=..").innerText();
ok(nightsChip.includes("8"), "nights computed from the dates", nightsChip.replace(/\n/g, " "));

// The seeded condo is ฿1,500/night: 8 x 1500 = 12,000 + 500 cleaning = 12,500,
// VAT 7% = 875, total 13,375.
const summary = await page.locator("text=Live total").locator("xpath=ancestor::div[contains(@class,'card')]").innerText();
ok(summary.includes("฿13,375"), "live total matches the server formula", summary.match(/฿[\d,]+/g)?.slice(0,6).join(" "));

// ---------------- dual pricing mode ----------------
await page.click("text=Enter total manually");
await page.waitForTimeout(500);
const field = (label) =>
  page.locator(".field", { has: page.locator(`label:text-is("${label}")`) }).locator("input");
const totalInput = field("Total amount");
ok((await totalInput.inputValue()) === "12000", "switching to total mode seeds the subtotal", await totalInput.inputValue());
await totalInput.fill("10000");
await page.waitForTimeout(600);
const rateInput = field("Night rate (calculated)");
ok((await rateInput.inputValue()) === "1250", "night rate derived from the manual total", await rateInput.inputValue());
ok(await rateInput.isDisabled(), "night rate is read-only in total mode");

await page.click("text=Calculate from night rate");
await page.waitForTimeout(500);
ok(await field("Subtotal (calculated)").isDisabled(), "subtotal is read-only in nightly mode");

// ---------------- save ----------------
await field("Amount received").fill("5000");
await page.waitForTimeout(600);
await page.click('button:has-text("Save booking")');
await page.waitForURL((u) => u.pathname === "/bookings", { timeout: 20000 });
await page.waitForTimeout(2000);
ok(page.url().includes("booking="), "saving opens the new booking's drawer", page.url().split("?")[1] ?? "");
const drawer = await page.locator('[role="dialog"]').innerText();
ok(drawer.includes("Sarah Chen"), "drawer shows the guest");
ok(drawer.includes("Partial"), "payment status derived as partial", drawer.match(/Paid|Partial|Pending/)?.[0] ?? "");
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// ---------------- conflict detection ----------------
await fresh(`${BASE}/bookings/new`);
await page.fill('input[placeholder="e.g. Sarah Chen"]', "Clasher");
await page.fill('input[type="date"] >> nth=0', "2026-10-03");
await page.fill('input[type="date"] >> nth=1', "2026-10-06");
await page.waitForTimeout(2500);
ok((await page.locator("text=Booking conflict").count()) > 0, "overlapping dates raise the conflict banner");
ok((await page.locator('button:has-text("Resolve conflict to save")').count()) > 0, "save button restyles rather than disabling");

// same-day turnover must be allowed
await page.fill('input[type="date"] >> nth=0', "2026-10-09");
await page.fill('input[type="date"] >> nth=1', "2026-10-12");
await page.waitForTimeout(2500);
ok((await page.locator("text=Booking conflict").count()) === 0, "same-day turnover is not flagged as a conflict");

// ---------------- booking list ----------------
await fresh(`${BASE}/bookings`);
await page.waitForSelector("text=Sarah Chen", { timeout: 15000 });
ok((await page.locator("table.data-table").count()) > 0, "booking list renders a table on desktop");
ok((await page.locator("text=Sarah Chen").count()) > 0, "the saved booking appears");

// ---------------- calendar ----------------
await fresh(`${BASE}/calendar`);
await page.waitForTimeout(2000);
ok((await page.locator("text=Legend").count()) > 0, "calendar renders with the legend");
const sidebarCell = await page.locator("text=Ashton Asoke").first().count();
ok(sidebarCell > 0, "condo resource rows render");

// navigate to October where the booking lives
await page.click('button[aria-label="Next month"]');
await page.waitForTimeout(1500);
await page.click('button[aria-label="Next month"]');
await page.waitForTimeout(2500);
const bars = await page.locator('[role="button"][aria-label*="Sarah Chen"]').count();
ok(bars > 0, "booking bar renders on the timeline", `${bars} bar(s)`);

if (bars > 0) {
  const bar = page.locator('[role="button"][aria-label*="Sarah Chen"]').first();
  const before = await bar.getAttribute("aria-label");
  const box = await bar.boundingBox();
  if (box) {
    // Drag the bar body three days to the right.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const dayW = box.width / 8;
    await page.mouse.move(box.x + box.width / 2 + dayW * 3, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(3000);
    const after = await page.locator('[role="button"][aria-label*="Sarah Chen"]').first().getAttribute("aria-label");
    ok(before !== after, "drag moved the booking", `${before} -> ${after}`);
  }
}

// ---------------- mobile ----------------
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
const mp = await mobile.newPage();
await mp.goto(`${BASE}/bookings`, { waitUntil: "networkidle" });
await mp.waitForTimeout(2500);
const tableDisplay = await mp.locator(".desktop-only").first().evaluate((el) => getComputedStyle(el).display).catch(() => "none");
ok(tableDisplay === "none", "mobile hides the desktop table", tableDisplay);
ok((await mp.locator("text=Sarah Chen").count()) > 0, "mobile shows booking cards");
await mp.screenshot({ path: "/tmp/shots/bookings-mobile.png", fullPage: true });

console.log(results.join("\n"));
console.log("\nconsole errors: " + (errors.length ? "\n  " + errors.slice(0, 5).join("\n  ") : "none"));
console.log("\n" + results.filter((r) => r.startsWith("PASS")).length + "/" + results.length + " passed");
await browser.close();
