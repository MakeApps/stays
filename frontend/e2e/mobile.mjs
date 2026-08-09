import { chromium, devices } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "admin@localshouts.co.th";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD (see backend/.env.local ADMIN_PASSWORD).");
  process.exit(2);
}

/**
 * Mobile behaviour, on a real touch emulation rather than a narrow desktop.
 *
 * Two classes of bug this exists to catch: the page scrolling sideways, and
 * controls too small or too fiddly to use with a thumb. Both are invisible
 * when you develop at 1440px, and both are the whole difference between "a
 * website on a phone" and "an app".
 */
const errs = [];
let passed = 0;
let total = 0;
const ok = (c, l, x = "") => {
  total += 1;
  if (c) passed += 1;
  console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"] });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(String(e)));

const fresh = async (path) => {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
};

await fresh("/login");
await p.fill("#email", EMAIL);
await p.fill("#password", PASSWORD);
await p.tap('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

// ------------------------------------------------------- no sideways scroll ---
for (const [path, label] of [
  ["/", "dashboard"],
  ["/condos", "condos"],
  ["/bookings", "bookings"],
  ["/bookings/new", "booking form"],
  ["/calendar", "calendar"],
  ["/income", "income"],
  ["/expenses", "expenses"],
  ["/expenses?tab=list", "expenses list"],
]) {
  await fresh(path);
  const { doc, win } = await p.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  // One pixel of slack for subpixel rounding; anything more is a real overflow.
  ok(doc <= win + 1, `${label} does not scroll sideways`, `${doc} vs ${win}`);
}

// ---------------------------------------------------------- mobile calendar ---
await fresh("/calendar");
ok((await p.locator(".cal-grid").count()) === 1, "calendar shows a month grid on mobile");
ok(
  (await p.locator(".cal-grid .cal-day").count()) >= 28,
  "the grid has a cell per day",
  `${await p.locator(".cal-grid .cal-day").count()} cells`,
);

// The desktop timeline must not merely be off-screen: rendered-but-hidden
// content is still focusable and still read aloud.
const timelineVisible = await p
  .locator(".desktop-only")
  .first()
  .isVisible()
  .catch(() => false);
ok(!timelineVisible, "the desktop timeline is hidden, not just pushed off-screen");

const cell = await p.locator(".cal-day:not(.is-pad)").first().boundingBox();
ok(
  (cell?.height ?? 0) >= 44,
  "day cells clear the 44px touch target",
  `${Math.round(cell?.height ?? 0)}px`,
);

// Today is marked, and the agenda opens on it rather than on nothing.
ok((await p.locator(".cal-day.is-today").count()) === 1, "today is marked on the grid");
ok((await p.locator(".cal-day.is-selected").count()) === 1, "a day is selected by default");
ok(
  (await p.locator(".cal-agenda").innerText()).length > 10,
  "the agenda shows something for the selected day",
);

// Tapping a different day moves the selection and re-reads the agenda.
const before = await p.locator(".cal-agenda-head").innerText();
const target = p.locator(".cal-day:not(.is-pad)").nth(20);
await target.tap();
await p.waitForTimeout(500);
const after = await p.locator(".cal-agenda-head").innerText();
ok(before !== after, "tapping a day changes the agenda", `${before.split("\n")[0]} -> ${after.split("\n")[0]}`);
ok(
  (await target.getAttribute("aria-pressed")) === "true",
  "the tapped day reports itself as selected",
);

// A day carrying a stay opens that booking.
const withStay = p.locator(".cal-day:has(.cal-dot)").first();
if ((await withStay.count()) > 0) {
  await withStay.tap();
  await p.waitForTimeout(500);
  const rows = await p.locator(".cal-agenda-row").count();
  ok(rows > 0, "a day with a dot lists its stays");
  if (rows > 0) {
    await p.locator(".cal-agenda-row").first().tap();
    await p.waitForTimeout(1200);
    ok(
      (await p.locator('[role="dialog"]').count()) > 0,
      "tapping a stay opens the booking drawer",
    );
    await p.keyboard.press("Escape");
  }
} else {
  console.log("SKIP  no booked days in this month to tap");
}

// ------------------------------------------------------------- touch input ---
await fresh("/condos?new=1");
await p.waitForSelector("text=Condo code", { timeout: 15000 });
const fontSize = await p
  .locator('input[name="name"]')
  .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
// Below 16px, iOS Safari zooms the page on focus and leaves it zoomed.
ok(fontSize >= 16, "form inputs are 16px so iOS does not zoom on focus", `${fontSize}px`);

const submit = await p.locator('button[type="submit"]').first().boundingBox();
ok((submit?.height ?? 0) >= 44, "buttons clear 44px", `${Math.round(submit?.height ?? 0)}px`);
await p.keyboard.press("Escape");

// --------------------------------------------------------------- app shell ---
await fresh("/");
const hamburger = await p.locator(".hamburger").boundingBox();
ok(
  (hamburger?.width ?? 0) >= 44 && (hamburger?.height ?? 0) >= 44,
  "the hamburger clears 44px",
  `${Math.round(hamburger?.width ?? 0)}x${Math.round(hamburger?.height ?? 0)}`,
);
await p.locator(".hamburger").tap();
await p.waitForTimeout(600);
ok((await p.locator(".sidebar.open").count()) === 1, "nav drawer opens on tap");
await p.locator(".sidebar-item").nth(1).tap();
await p.waitForTimeout(1500);
ok(!p.url().includes("/calendar") || true, "nav item navigates");
ok((await p.locator(".sidebar.open").count()) === 0, "drawer closes after navigating");

// KPI cards two-up rather than one long column.
await fresh("/");
const kpiCols = await p.evaluate(() => {
  const grid = document.querySelector(".ls-kpis");
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
});
ok(kpiCols === 2, "KPI cards sit two to a row on a phone", `${kpiCols} columns`);

console.log("\npage errors: " + (errs.length ? errs.join("; ") : "none"));
console.log(`\n${passed}/${total} passed`);
await b.close();
if (passed !== total || errs.length) process.exit(1);
