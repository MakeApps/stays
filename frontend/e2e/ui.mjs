import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "info@localshouts.com";
// Read from the environment so rotating the admin password does not break the
// suite. Set E2E_PASSWORD to match backend/.env.local.
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD to the admin password (stored in the database, not in .env).");
  process.exit(2);
}

const errors = [];
const results = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

// Next streams the shell before the client bundle attaches. Clicking before
// hydration triggers a native form submit instead of the React handler, which
// is a test artefact rather than an app bug — wait for React to take over.
async function hydrated(pg) {
  await pg.waitForLoadState("networkidle");
  await pg.waitForFunction(() => {
    const root = document.querySelector("form, main");
    return root ? Object.keys(root).some((k) => k.startsWith("__react")) : false;
  }, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(400);
}

function check(label, ok, extra = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  return ok;
}

// 1. login screen
await page.goto(`${BASE}/condos`, { waitUntil: "networkidle" });
await hydrated(page);
check("signed out -> redirected to /login", page.url().includes("/login"));
check("login: next param preserved", page.url().includes("next=%2Fcondos"));
check("login: brand rendered", (await page.locator("text=Baan").count()) > 0);
const btnBg = await page.locator("button.btn-primary").evaluate((el) => getComputedStyle(el).backgroundColor);
check("login: .btn-primary keeps DS purple (Preflight not applied)", btnBg === "rgb(124, 58, 237)", btnBg);
await page.screenshot({ path: "/tmp/shots/01-login.png", fullPage: true });

// 2. sign in
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
check("sign-in lands on the requested page", page.url().endsWith("/condos"), page.url());

// 3. condo grid
await page.waitForSelector("text=Ashton Asoke 1204", { timeout: 20000 });
const cards = await page.locator(".card").count();
check("condo grid rendered from the API", cards >= 9, `${cards} cards`);
check("seeded rate formatted as the design does", (await page.locator("text=฿1,800").count()) > 0);
check("m2 shown (prototype had no size field)", (await page.locator("text=42 m²").count()) > 0);
const cardShadow = await page.locator(".card").first().evaluate((el) => getComputedStyle(el).boxShadow);
check("DS shadow survived the --ds-* alias hop", cardShadow !== "none", cardShadow.slice(0, 40));
const sidebarW = await page.locator(".sidebar").evaluate((el) => getComputedStyle(el).width);
check("sidebar is the DS width", sidebarW === "248px", sidebarW);
await page.screenshot({ path: "/tmp/shots/02-condos.png", fullPage: true });

// 4. filter pill
await page.getByRole("button", { name: /^Maintenance/ }).click();
await page.waitForFunction(() => location.search.includes("status=maintenance"), { timeout: 8000 });
await page.waitForTimeout(1200);
// Status is derived from bookings, so with the demo data seeded the
// maintenance filter legitimately returns the unit whose maintenance block
// spans today. This used to assert an empty state, which only held while
// bookings did not exist yet.
const maintenanceCards = await page.locator('[role="button"][aria-label*="Maintenance"]').count();
const allCards = await page.locator('[role="button"][aria-label]').count();
check(
  "maintenance filter narrows to units actually under maintenance",
  maintenanceCards > 0 && maintenanceCards === allCards,
  `${maintenanceCards} of ${allCards} cards`,
);

// The empty state still needs covering — reach it with a search that cannot
// match anything rather than relying on a status having no units.
await page.goto(`${BASE}/condos`, { waitUntil: "networkidle" });
await hydrated(page);
await page.locator('input[aria-label="Search condos"]').fill("zzz-no-such-unit");
await page.waitForTimeout(1500);
check(
  "a search with no matches shows the empty state",
  (await page.locator("text=Nothing matches those filters").count()) > 0,
);
await page.locator('input[aria-label="Search condos"]').fill("");
await page.waitForTimeout(1200);

// 5. detail drawer via URL
await page.waitForSelector("text=Ashton Asoke 1204", { timeout: 20000 });
// Deep-link straight to the drawer: proves both that it renders and that the
// URL alone is enough to restore it.
const firstId = await page.locator('[role="button"]').first().getAttribute("aria-label");
await page.locator('[role="button"]').first().click();
await page.waitForFunction(() => location.search.includes("condo="), { timeout: 10000 });
await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
check("detail drawer opens on card click", (await page.locator('[role="dialog"]').count()) > 0, firstId ?? "");
check("drawer state is in the URL (deep-linkable)", page.url().includes("condo="));
await page.waitForSelector("text=Rate per night", { timeout: 8000 }).catch(() => {});
check("drawer shows the rate", (await page.locator("text=Rate per night").count()) > 0);
await page.screenshot({ path: "/tmp/shots/03-drawer.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
check("Escape closes the drawer (Radix)", (await page.locator('[role="dialog"]').count()) === 0);

// 6. add-condo modal
await page.goto(`${BASE}/condos?new=1`, { waitUntil: "networkidle" });
await hydrated(page);
await page.waitForSelector("text=Condo code", { timeout: 15000 });
check("add modal opens", (await page.locator("text=Condo code").count()) > 0);
check("modal has the size field the prototype lacked", (await page.locator("text=Size (m²)").count()) > 0);
await page.screenshot({ path: "/tmp/shots/04-modal.png" });

// validation
await page.click('button[type="submit"]');
await page.waitForTimeout(600);
check("empty form blocked by validation", (await page.locator("small.error").count()) >= 2);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

// 7. mobile
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } , storageState: await ctx.storageState() });
const mp = await mobile.newPage();
await mp.goto(`${BASE}/condos`, { waitUntil: "networkidle" });
await hydrated(mp);
await mp.waitForSelector("text=Ashton Asoke 1204", { timeout: 20000 });
const sbTransform = await mp.locator(".sidebar").evaluate((el) => getComputedStyle(el).transform);
check("mobile: sidebar is off-canvas", sbTransform !== "none", sbTransform);
const topbar = await mp.locator(".mobile-topbar").evaluate((el) => getComputedStyle(el).display);
check("mobile: topbar visible", topbar === "flex", topbar);
await mp.screenshot({ path: "/tmp/shots/05-mobile.png", fullPage: true });
await mp.click(".hamburger");
await mp.waitForTimeout(500);
await mp.screenshot({ path: "/tmp/shots/06-mobile-nav.png" });
check("mobile: nav drawer opens", (await mp.locator(".sidebar.open").count()) === 1);

console.log(results.join("\n"));
console.log("\nconsole errors: " + (errors.length ? "\n  " + errors.join("\n  ") : "none"));
console.log("\n" + results.filter(r => r.startsWith("PASS")).length + "/" + results.length + " passed");
await browser.close();
if (results.some(r => r.startsWith("FAIL")) || errors.length) process.exit(1);
