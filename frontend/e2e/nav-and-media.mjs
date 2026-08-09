import { chromium } from "playwright";

import { cleanupTestData } from "./cleanup.mjs";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "admin@localshouts.co.th";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const FIXTURE = process.env.E2E_IMAGE ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD (see backend/.env.local ADMIN_PASSWORD).");
  process.exit(2);
}

const errs = [];
let passed = 0;
let total = 0;
const ok = (c, l, x = "") => {
  total += 1;
  if (c) passed += 1;
  console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 980 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(String(e)));

async function fresh(url) {
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
}
const railWidth = () => p.locator(".sidebar").evaluate((el) => getComputedStyle(el).width);

await fresh(`${BASE}/login`);
await p.fill("#email", EMAIL);
await p.fill("#password", PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
await fresh(`${BASE}/condos`);
await cleanupTestData(p);

// ---------------------------------------------------------------- photos ---
// A condo photo is served through a signed URL with no download_name, which is
// the case send_file cannot infer a MIME type for. It 500'd for every photo
// while the API tests stayed green, because they only asserted the URL was
// produced — never that it loaded.
if (FIXTURE) {
  await fresh(`${BASE}/condos?new=1`);
  await p.fill('input[name="name"]', "Playwright Photo Unit");
  await p.fill('input[name="code"]', "pw-img");
  await p.fill('input[name="night_rate"]', "1900");
  await p.click('button[type="submit"]');
  await p.waitForSelector("text=Playwright Photo Unit", { timeout: 15000 });

  const card = () => p.locator('[role="button"]', { hasText: "Playwright Photo Unit" }).first();
  await card().click();
  await p.waitForFunction(() => location.search.includes("condo="), { timeout: 8000 });
  const condoId = new URL(p.url()).searchParams.get("condo");
  await p.keyboard.press("Escape");

  await fresh(`${BASE}/condos?edit=${condoId}`);
  await p.setInputFiles('input[type="file"]', FIXTURE);
  await p.waitForTimeout(3500);
  await p.keyboard.press("Escape");

  await fresh(`${BASE}/condos`);
  await p.waitForSelector("text=Playwright Photo Unit", { timeout: 15000 });
  await p.waitForTimeout(2000);

  // naturalWidth is the only honest check: a broken <img> still has a src, a
  // layout box and an alt attribute.
  const loaded = await card()
    .locator("img")
    .first()
    .evaluate((img) => ({ w: img.naturalWidth, src: img.currentSrc || img.src }))
    .catch(() => ({ w: 0, src: "no <img> rendered" }));
  ok(loaded.w > 0, "condo card photo actually decodes", `naturalWidth=${loaded.w}`);

  await fresh(`${BASE}/condos/${condoId}`);
  await p.waitForTimeout(2000);
  const detail = await p
    .locator("main img")
    .first()
    .evaluate((img) => img.naturalWidth)
    .catch(() => 0);
  ok(detail > 0, "condo detail page photo decodes", `naturalWidth=${detail}`);
} else {
  console.log("SKIP  photo checks (set E2E_IMAGE to a jpg/png path)");
}

// ------------------------------------------------------------ sidebar rail ---
await fresh(`${BASE}/condos`);
ok((await railWidth()) === "248px", "sidebar starts at the DS width", await railWidth());

await p.click(".nav-toggle");
await p.waitForTimeout(500);
ok((await railWidth()) === "64px", "toggle collapses it to the DS rail width", await railWidth());
ok(
  (await p.locator(".sidebar .nav-label").first().isVisible()) === false,
  "labels are hidden in the rail",
);
ok(
  (await p.locator('.sidebar-item[aria-label="Condos"]').count()) > 0,
  "rail items keep an accessible name once the label is hidden",
);
// Hidden by CSS rather than dropped from the DOM: the same markup is the
// mobile drawer, where Quick add must stay. display:none removes it from the
// accessibility tree and tab order too, so "hidden" here means hidden.
ok(
  (await p.locator('.sidebar-item:has-text("New condo")').isVisible()) === false,
  "quick add leaves the rail rather than becoming three identical plus signs",
);
const railVisible = await p
  .locator(".sidebar .sidebar-item")
  .evaluateAll((els) => els.filter((el) => el.offsetParent !== null).length);
ok(
  railVisible === 6,
  "the rail shows exactly the six nav destinations",
  `${railVisible} visible items`,
);

await fresh(`${BASE}/condos`);
ok((await railWidth()) === "64px", "collapse survives a reload", await railWidth());
ok(
  (await p.evaluate(() => document.cookie.includes("ls_nav_collapsed=1"))) === true,
  "preference is stored where the server layout can read it before render",
);

await p.click(".nav-toggle");
await p.waitForTimeout(500);
ok((await railWidth()) === "248px", "toggle expands it again", await railWidth());

// ------------------------------------------------------ calendar behaviour ---
await fresh(`${BASE}/calendar`);
ok((await railWidth()) === "64px", "calendar collapses the rail on arrival", await railWidth());

await fresh(`${BASE}/income`);
ok(
  (await railWidth()) === "248px",
  "leaving the calendar restores the saved preference",
  await railWidth(),
);

// Auto-collapse is a per-visit default, not a preference change.
await fresh(`${BASE}/calendar`);
await p.click(".nav-toggle");
await p.waitForTimeout(500);
ok((await railWidth()) === "248px", "the user can expand it on the calendar");
ok(
  (await p.evaluate(() => !document.cookie.includes("ls_nav_collapsed=1"))) === true,
  "expanding on the calendar does not rewrite the saved preference",
);
await fresh(`${BASE}/calendar`);
ok((await railWidth()) === "64px", "and the override does not leak into the next visit");

// Sign-out lives below the avatar in the rail, in the bottom-left corner the
// Next dev badge also claims. Clicking it, not just finding it, is the check.
await fresh(`${BASE}/condos`);
await p.click(".nav-toggle");
await p.waitForTimeout(600);
await p.locator('.sidebar [aria-label="Sign out"]').click({ timeout: 10000 });
await p.waitForURL((u) => u.pathname.includes("/login"), { timeout: 15000 }).catch(() => {});
ok(p.url().includes("/login"), "sign out is reachable in the rail, not sitting under an overlay");

await fresh(`${BASE}/login`);
await p.fill("#email", EMAIL);
await p.fill("#password", PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
await fresh(`${BASE}/condos`);
await p.click(".nav-toggle");   // back to expanded for the checks that follow
await p.waitForTimeout(600);

// ------------------------------------------------------------------ mobile ---
const mobile = await b.newContext({
  viewport: { width: 390, height: 844 },
  storageState: await ctx.storageState(),
});
const mp = await mobile.newPage();
await mp.goto(`${BASE}/calendar`, { waitUntil: "networkidle" });
await mp.waitForTimeout(1500);
ok(
  (await mp.locator(".sidebar").evaluate((el) => getComputedStyle(el).width)) === "248px",
  "mobile keeps the full drawer — the rail is a desktop affordance",
  await mp.locator(".sidebar").evaluate((el) => getComputedStyle(el).width),
);
await mp.click(".hamburger");
await mp.waitForTimeout(600);
ok((await mp.locator(".sidebar.open").count()) === 1, "mobile drawer still opens on the calendar");

// ----------------------------------------------------------------- cleanup ---
await fresh(`${BASE}/condos`);
await cleanupTestData(p);
await p.waitForTimeout(800);
await fresh(`${BASE}/condos`);
ok(
  !/Playwright/.test(await p.locator("main").innerText()),
  "suite cleans up after itself",
);

console.log("\npage errors: " + (errs.length ? errs.join("; ") : "none"));
console.log(`\n${passed}/${total} passed`);
await b.close();
if (passed !== total || errs.length) process.exit(1);
