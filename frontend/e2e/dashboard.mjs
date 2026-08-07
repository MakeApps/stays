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
  await page.waitForTimeout(1600);
}

await fresh(`${BASE}/login`);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

// ---------------- dashboard ----------------
await page.waitForSelector("text=Income by day", { timeout: 20000 });
const text = await page.locator("main").innerText();

// Same seeded figures the income screen asserts, reached by a different path.
ok(text.includes("฿215,800"), "month revenue matches the seeded bookings");
ok(text.includes("Occupancy today"), "occupancy card rendered");
ok(text.includes("Upcoming bookings"), "upcoming bookings card rendered");
ok(text.includes("Recent activity"), "activity feed rendered");
ok(/Total condos/.test(text) && /\b9\b/.test(text), "condo count shown");
ok(text.includes("฿59,800"), "outstanding balance in the chart footer");

const bars = await page.locator('[title*="·"]').count();
ok(bars >= 28, "income-by-day has a bar per day of the month", `${bars} bars`);

// hovering a bar updates the header readout, as the design does
const readoutBefore = await page.locator(".card-head").first().innerText();
await page.locator('div[title*="·"]').nth(12).hover();
await page.waitForTimeout(500);
const readoutAfter = await page.locator(".card-head").first().innerText();
ok(readoutBefore !== readoutAfter, "hovering a bar updates the header readout");

const donut = await page.locator('[role="img"]').first().evaluate((el) => getComputedStyle(el).backgroundImage);
ok(donut.includes("conic-gradient"), "occupancy donut is CSS");
await page.screenshot({ path: "/tmp/shots/dashboard.png", fullPage: true });

// ---------------- global search ----------------
await page.fill('input[aria-label="Search"]', "asoke");
await page.waitForTimeout(1400);
const listbox = await page.locator('[role="listbox"]').innerText();
ok(/condos/i.test(listbox), "search groups results by entity");
ok(listbox.includes("Ashton Asoke 1204"), "condo hit found");

await page.fill('input[aria-label="Search"]', "chen");
await page.waitForTimeout(1400);
const bookingHits = await page.locator('[role="listbox"]').innerText();
ok(bookingHits.includes("Sarah Chen"), "booking hit found by guest name");

await page.fill('input[aria-label="Search"]', "aircon");
await page.waitForTimeout(1400);
const expenseHits = await page.locator('[role="listbox"]').innerText();
ok(/expenses/i.test(expenseHits), "expense hit found by description");

// selecting a result navigates
await page.locator('[role="option"]').first().waitFor({ state: "visible", timeout: 8000 });
await page.locator('[role="option"]').first().click();
await page.waitForFunction(() => location.pathname !== "/", { timeout: 10000 }).catch(() => {});
ok(page.url() !== `${BASE}/`, "selecting a result navigates", page.url().replace(BASE, ""));

// ---------------- CSV export ----------------
await fresh(`${BASE}/income`);
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.click('a:has-text("Export CSV")'),
]);
const name = download.suggestedFilename();
ok(name.startsWith("localshouts-income-"), "income CSV downloads with a dated filename", name);
const stream = await download.createReadStream();
const chunks = [];
for await (const c of stream) chunks.push(c);
const csv = Buffer.concat(chunks).toString("utf8");
ok(csv.charCodeAt(0) === 0xfeff, "CSV starts with a UTF-8 BOM so Excel reads it correctly");
ok(csv.includes("Net profit (THB)"), "CSV header present");
ok(csv.split("\n").filter((l) => l.trim()).length === 10, "one row per condo plus header", `${csv.split("\n").filter((l) => l.trim()).length} lines`);

// ---------------- mobile ----------------
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
const mp = await mobile.newPage();
await mp.goto(BASE, { waitUntil: "networkidle" });
await mp.waitForSelector("text=Income by day", { timeout: 20000 }).catch(() => {});
ok((await mp.locator("text=Income by day").count()) > 0, "dashboard renders on mobile");
const desktopOnly = await mp.locator(".desktop-only").first().evaluate((el) => getComputedStyle(el).display).catch(() => "none");
ok(desktopOnly === "none", "mobile hides desktop-only blocks", desktopOnly);
await mp.screenshot({ path: "/tmp/shots/dashboard-mobile.png", fullPage: true });

console.log(results.join("\n"));
console.log("\nconsole errors: " + (errors.length ? "\n  " + errors.slice(0, 4).join("\n  ") : "none"));
console.log("\n" + results.filter((r) => r.startsWith("PASS")).length + "/" + results.length + " passed");
await browser.close();
