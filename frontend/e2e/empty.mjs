import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "info@localshouts.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD to the admin password (stored in the database, not in .env).");
  process.exit(2);
}

/**
 * Every screen against a completely empty database.
 *
 * Empty states are written early and then almost never exercised, because
 * development happens against seeded data. This is where divide-by-zero,
 * NaN and "undefined" leak into a money screen.
 */
const errors = [];
const results = [];
let passed = 0;
const ok = (c, l, x = "") => {
  results.push(`${c ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`);
  if (c) passed += 1;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

async function visit(path) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  return res?.status() ?? 0;
}

await visit("/login");
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
await page.waitForTimeout(2500);

const BAD = /\bNaN\b|\bundefined\b|\bnull\b|\[object Object\]|Infinity/;

for (const [path, label] of [
  ["/", "dashboard"],
  ["/condos", "condos"],
  ["/bookings", "bookings"],
  ["/bookings/new", "booking form"],
  ["/calendar", "calendar"],
  ["/income", "income"],
  ["/expenses", "expenses overview"],
  ["/expenses?tab=list", "expenses list"],
]) {
  const status = await visit(path);
  const text = await page.locator("main").innerText().catch(() => "");
  ok(status === 200, `${label} responds 200`, String(status));
  ok(!BAD.test(text), `${label} shows no NaN/undefined/null`, BAD.exec(text)?.[0] ?? "");
  ok(text.trim().length > 40, `${label} renders content rather than a blank page`);
}

// The specific empty states the design defines.
await visit("/condos");
ok(
  (await page.locator("text=No condos yet").count()) > 0,
  "condos shows its empty state",
);
await visit("/bookings");
ok(
  (await page.locator("text=No bookings yet").count()) > 0,
  "bookings shows its empty state",
);
await visit("/expenses?tab=list");
ok(
  (await page.locator("text=No expenses yet").count()) > 0,
  "expenses shows its empty state",
);

// Percentages divide by a total that is now zero.
await visit("/income");
const income = await page.locator("main").innerText();
ok(/0%|฿0/.test(income), "income handles a zero denominator", income.match(/\d+%/)?.[0] ?? "");
await visit("/");
const dash = await page.locator("main").innerText();
ok(/0%/.test(dash) || /฿0/.test(dash), "dashboard handles a zero denominator");

// A booking cannot be made without a condo — the form must say so, not break.
await visit("/bookings/new");
ok(
  (await page.locator('button:has-text("Save booking")').count()) > 0,
  "booking form still renders with no condos to choose",
);

console.log(results.join("\n"));
console.log("\nconsole errors: " + (errors.length ? "\n  " + errors.slice(0, 6).join("\n  ") : "none"));
console.log(`\n${passed}/${results.length} passed`);
await browser.close();
if (passed !== results.length || errors.length) process.exit(1);
