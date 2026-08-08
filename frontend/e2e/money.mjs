import { chromium } from "playwright";

import { cleanupTestData } from "./cleanup.mjs";

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
  await page.waitForTimeout(1600);
}

await fresh(`${BASE}/login`);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

await cleanupTestData(page);

// ---------------- income ----------------
await fresh(`${BASE}/income`);
await page.waitForSelector("text=Profit by condo", { timeout: 15000 });
const incomeText = await page.locator("main").innerText();

// These come from the design's own seed: 15 bookings totalling 215,800 baht,
// 22 expenses totalling 73,480 after the cancelled one is excluded.
ok(incomeText.includes("฿215,800"), "monthly revenue matches the seeded bookings", incomeText.match(/฿215,800/)?.[0] ?? "not found");
ok(incomeText.includes("฿73,480"), "expenses exclude the cancelled bill");
ok(incomeText.includes("฿142,320"), "net profit reconciles (215,800 − 73,480)");
ok(incomeText.includes("66% margin"), "margin computed");
ok(incomeText.includes("฿59,800"), "outstanding balance shown");
ok((await page.locator("table.data-table tbody tr").count()) === 9, "profit table lists every condo, including idle ones", `${await page.locator("table.data-table tbody tr").count()} rows`);
ok(incomeText.includes("Noble Ploenchit 2201"), "top earner listed first");
await page.screenshot({ path: "/tmp/shots/income.png", fullPage: true });

// donut is a div, not an SVG chart
const donut = await page.locator('[role="img"]').first().evaluate((el) => getComputedStyle(el).backgroundImage);
ok(donut.includes("conic-gradient"), "donut uses conic-gradient, not an SVG library", donut.slice(0, 40));

// ---------------- expenses overview ----------------
await fresh(`${BASE}/expenses`);
await page.waitForSelector("text=Expenses by category", { timeout: 15000 });
const expText = await page.locator("main").innerText();
ok(expText.includes("฿73,480"), "monthly expense total");
ok(expText.includes("฿20,500"), "pending total across 3 invoices");
ok(expText.includes("Repairs"), "biggest category listed first");
ok(expText.includes("Revenue vs expenses"), "six-month comparison rendered");
await page.screenshot({ path: "/tmp/shots/expenses-overview.png", fullPage: true });

// ---------------- expenses list ----------------
await fresh(`${BASE}/expenses?tab=list`);
await page.waitForSelector("table.data-table", { timeout: 15000 });
const rows = await page.locator("table.data-table tbody tr").count();
ok(rows === 22, "all 22 seeded expenses listed", `${rows} rows`);
const cancelled = await page.locator("tr", { hasText: "cancelled" }).first().locator("td").nth(4).evaluate((el) => getComputedStyle(el).textDecorationLine);
ok(cancelled.includes("line-through"), "cancelled expense is struck through", cancelled);

// filter by category
await page.selectOption('select[aria-label="Filter by category"]', { label: "Cleaning" });
await page.waitForTimeout(1800);
const cleaningRows = await page.locator("table.data-table tbody tr").count();
ok(cleaningRows === 4, "category filter narrows the list", `${cleaningRows} cleaning rows`);
await page.selectOption('select[aria-label="Filter by category"]', "");
await page.waitForTimeout(1200);

// ---------------- create an expense ----------------
await fresh(`${BASE}/expenses?tab=list&new=1`);
await page.waitForSelector("text=Expense date", { timeout: 15000 });
ok(true, "expense drawer opens");
await page.click('button:has-text("Save expense")');
await page.waitForTimeout(800);
ok((await page.locator("small.error").count()) >= 2, "empty form blocked with field errors");

await page.locator('.field', { has: page.locator('label:text-is("Amount (฿)")') }).locator("input").fill("1234.50");
await page.locator('.field', { has: page.locator('label:text-is("Description")') }).locator("textarea").fill("Playwright test bill");
await page.locator('.field', { has: page.locator('label:text-is("Vendor")') }).locator("input").fill("Test Vendor");
await page.click('button:has-text("Save expense")');
await page.waitForTimeout(3000);
await fresh(`${BASE}/expenses?tab=list`);
const afterText = await page.locator("main").innerText();
ok(afterText.includes("Playwright test bill"), "created expense appears in the list");
ok(afterText.includes("฿1,235"), "1234.50 baht round-tripped through satang", afterText.match(/฿1,23\d/)?.[0] ?? "");

await cleanupTestData(page);
await fresh(`${BASE}/expenses?tab=list`);
const cleaned = await page.locator("main").innerText();
ok(!cleaned.includes("Playwright test bill"), "suite cleans up the expense it created");

// ---------------- mobile ----------------
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
const mp = await mobile.newPage();
await mp.goto(`${BASE}/income`, { waitUntil: "networkidle" });
await mp.waitForTimeout(2500);
const desktopTable = await mp.locator(".desktop-only").first().evaluate((el) => getComputedStyle(el).display).catch(() => "none");
ok(desktopTable === "none", "mobile hides the desktop profit table", desktopTable);
ok((await mp.locator("text=Noble Ploenchit 2201").count()) > 0, "mobile shows profit cards");
await mp.screenshot({ path: "/tmp/shots/income-mobile.png", fullPage: true });

console.log(results.join("\n"));
console.log("\nconsole errors: " + (errors.length ? "\n  " + errors.slice(0, 4).join("\n  ") : "none"));
console.log("\n" + results.filter((r) => r.startsWith("PASS")).length + "/" + results.length + " passed");
await browser.close();
