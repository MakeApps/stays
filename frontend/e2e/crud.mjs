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

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 980 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push(String(e)));
let passed = 0;
let total = 0;
const ok = (c, l, x = "") => {
  total += 1;
  if (c) passed += 1;
  console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`);
};

async function fresh(url) {
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(1400);
}

await fresh(`${BASE}/login`);
await p.fill("#email", EMAIL);
await p.fill("#password", PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL(u => !u.pathname.includes("/login"), { timeout: 20000 });

// Start from a known state: a previous run that died midway would otherwise
// still hold the PW-0707 code and this suite could never create its own.
await fresh(`${BASE}/condos`);
await cleanupTestData(p);

// ---- CREATE ----
await fresh(`${BASE}/condos?new=1`);
await p.fill('input[name="name"]', "Playwright Tower 0707");
await p.fill('input[name="code"]', "pw-0707");
await p.fill('input[name="size_sqm"]', "51");
await p.fill('input[name="night_rate"]', "2450.50");
await p.fill('input[name="month_rate"]', "44000");
await p.click('button[type="submit"]');
await p.waitForSelector("text=Playwright Tower 0707", { timeout: 15000 });
ok(true, "created condo appears in the grid");

// ---- DUPLICATE CODE ----
await fresh(`${BASE}/condos?new=1`);
await p.fill('input[name="name"]', "Duplicate");
await p.fill('input[name="code"]', "PW-0707");
await p.click('button[type="submit"]');
await p.waitForSelector("small.error", { timeout: 10000 });
const dup = await p.locator("small.error").first().innerText();
ok(dup.toLowerCase().includes("taken"), "server duplicate error maps onto the code field", `"${dup}"`);

// ---- PERSISTED ACROSS RELOAD ----
await fresh(`${BASE}/condos`);
await p.waitForSelector("text=Playwright Tower 0707", { timeout: 15000 });
const card = () => p.locator('[role="button"]', { hasText: "Playwright Tower 0707" }).first();
const txt = await card().innerText();
ok(txt.includes("฿2,451"), "2450.50 baht round-tripped through satang", txt.match(/฿[\d,]+/g)?.join(" "));
ok(txt.includes("51 m²"), "size persisted (field the prototype never had)");

// ---- EDIT via deep link ----
const id = await p.evaluate(() => {
  const el = [...document.querySelectorAll('[role="button"]')]
    .find(e => e.textContent?.includes("Playwright Tower 0707"));
  return el ? "found" : null;
});
await card().click();
await p.waitForFunction(() => location.search.includes("condo="), { timeout: 8000 });
const condoId = new URL(p.url()).searchParams.get("condo");
await fresh(`${BASE}/condos?edit=${condoId}`);
await p.waitForSelector("text=Condo code", { timeout: 10000 });
await p.fill('input[name="night_rate"]', "3100");
await p.click('button[type="submit"]');
await p.waitForTimeout(2500);
await fresh(`${BASE}/condos`);
await p.waitForSelector("text=Playwright Tower 0707", { timeout: 15000 });
ok((await card().innerText()).includes("฿3,100"), "edit persisted after reload");

// ---- FULL DETAIL PAGE ----
await fresh(`${BASE}/condos/${condoId}`);
ok((await p.locator("h1").innerText()) === "Playwright Tower 0707", "full detail page renders");
ok((await p.locator("text=Per night").count()) > 0, "detail page shows rates");

// ---- DELETE ----
await fresh(`${BASE}/condos?confirm=${condoId}`);
await p.waitForSelector("text=Remove condo", { timeout: 10000 });
await p.click("text=Remove condo");
await p.waitForTimeout(2500);
await fresh(`${BASE}/condos`);
ok((await p.locator("text=Playwright Tower 0707").count()) === 0, "soft delete removes it from the grid");

// ---- CODE REUSABLE AFTER SOFT DELETE ----
await fresh(`${BASE}/condos?new=1`);
await p.fill('input[name="name"]', "Reuse Check");
await p.fill('input[name="code"]', "PW-0707");
await p.click('button[type="submit"]');
await p.waitForTimeout(2500);
ok((await p.locator("text=Reuse Check").count()) > 0, "code is reusable after soft delete");

// ---- CLEAN UP ----
// Leaving these behind keeps the PW-0707 code taken, so the next run cannot
// create its own, and every screen reports 10 units instead of the seeded 9.
await cleanupTestData(p);
await p.waitForTimeout(800);
await fresh(`${BASE}/condos`);
ok(
  !/Playwright|Reuse Check/.test(await p.locator("main").innerText()),
  "suite cleans up the condos it created",
);

console.log("\npage errors: " + (errs.length ? errs.join("; ") : "none"));
console.log(`\n${passed}/${total} passed`);
await b.close();
if (passed !== total || errs.length) process.exit(1);
