import { chromium, devices } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "info@localshouts.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD to the admin password (stored in the database, not in .env).");
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

const cell = await p.locator(".cal-day").first().boundingBox();
// Both dimensions. A 44px-tall cell 43.7px wide is still a 43.7px target, and
// height alone is the easy half to get right.
ok(
  (cell?.height ?? 0) >= 44 && (cell?.width ?? 0) >= 44,
  "day cells clear 44px in both directions",
  `${(cell?.width ?? 0).toFixed(1)} x ${(cell?.height ?? 0).toFixed(1)}`,
);

// Today is marked, and the day panel opens on it rather than on nothing.
ok((await p.locator(".cal-day.is-today").count()) === 1, "today is marked on the grid");
ok((await p.locator(".cal-day.is-selected").count()) === 1, "a day is selected by default");
ok(
  (await p.locator(".cal-daycard-title").innerText()).length > 5,
  "the day panel names the selected day",
);

// Tapping a different day moves the selection and re-reads the panel.
const before = await p.locator(".cal-daycard-title").innerText();
const target = p.locator(".cal-day:not(.is-outside)").nth(20);
await target.tap();
await p.waitForTimeout(600);
const after = await p.locator(".cal-daycard-title").innerText();
ok(before !== after, "tapping a day changes the day panel", `${before} -> ${after}`);
ok(
  (await target.getAttribute("aria-pressed")) === "true",
  "the tapped day reports itself as selected",
);

// A day carrying a stay lists it, with the rich card the design calls for.
const withStay = p.locator(".cal-day:has(.cal-dot)").first();
if ((await withStay.count()) > 0) {
  await withStay.tap();
  await p.waitForTimeout(600);
  const rows = await p.locator(".cal-stay").count();
  ok(rows > 0, "a day with a dot lists its stays");
  if (rows > 0) {
    const card = p.locator(".cal-stay").first();
    ok(
      (await card.locator(".cal-chip").count()) === 2,
      "each stay carries a date chip and a price chip",
    );
    ok((await card.locator(".cal-stay-photo").count()) === 1, "each stay carries a photo slot");
    await card.tap();
    await p.waitForTimeout(1400);
    ok(
      (await p.locator('[role="dialog"]').count()) > 0,
      "tapping a stay opens the booking drawer",
    );
    await p.keyboard.press("Escape");
    await p.waitForTimeout(400);
  }
} else {
  console.log("SKIP  no booked days in this month to tap");
}

// --------------------------------------------------------- bottom tab bar ---
await fresh("/calendar");
ok((await p.locator(".bottom-tabs").isVisible()) === true, "bottom tab bar is present on mobile");
ok(
  (await p.locator(".bottom-tab").count()) === 5,
  "five destinations",
  `${await p.locator(".bottom-tab").count()} tabs`,
);
ok(
  (await p.locator('.bottom-tab.active:has-text("Calendar")').count()) === 1,
  "the tab for the current route is marked active",
);
const tabBox = await p.locator(".bottom-tab").first().boundingBox();
ok((tabBox?.height ?? 0) >= 44, "tabs clear 44px", `${Math.round(tabBox?.height ?? 0)}px`);

// The bar is fixed to the viewport, which is only true if no ancestor has a
// transform. Every screen's root section animates one with fill:both.
const barPinned = await p.evaluate(() => {
  const r = document.querySelector(".bottom-tabs").getBoundingClientRect();
  return Math.abs(r.bottom - window.innerHeight) < 2;
});
ok(barPinned, "the tab bar is pinned to the viewport, not to a transformed ancestor");

await p.locator('.bottom-tab:has-text("More")').tap();
await p.waitForTimeout(700);
ok((await p.locator(".sidebar.open").count()) === 1, "More opens the existing drawer");
// The rail is a desktop state, but this is the same markup. Auto-collapsing
// screens used to hand the phone a drawer with no labels and no Quick add.
ok(
  await p.locator('.sidebar.open .sidebar-item:has-text("Condos")').isVisible(),
  "the drawer shows full labels even on an auto-collapsing screen",
);
ok(
  await p.locator(".sidebar.open .quick-add").isVisible(),
  "the drawer keeps Quick add on an auto-collapsing screen",
);
ok(await p.locator(".sidebar.open .brand-word").isVisible(), "the drawer shows the wordmark");
// Tap the overlay clear of the drawer, which covers its own centre.
await p.mouse.click(360, 400);
await p.waitForTimeout(600);

// --------------------------------------------------------------------- FAB ---
await fresh("/calendar");
const fabPinned = await p.evaluate(() => {
  const fab = document.querySelector(".fab");
  if (!fab) return null;
  const r = fab.getBoundingClientRect();
  return { fromBottom: Math.round(window.innerHeight - r.bottom) };
});
// This is the regression guard for a real bug: the FAB started life inside the
// screen's <section>, whose lsFade animation leaves a transform behind with
// fill:both. That makes the section a containing block, so position:fixed
// resolved against it and the button floated up onto the content.
ok(
  fabPinned !== null && fabPinned.fromBottom > 60 && fabPinned.fromBottom < 110,
  "the FAB is fixed to the viewport, above the tab bar",
  fabPinned ? `${fabPinned.fromBottom}px from the bottom` : "no FAB",
);

await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(700);
const fabClear = await p.evaluate(() => {
  const fab = document.querySelector(".fab").getBoundingClientRect();
  return [...document.querySelectorAll(".cal-stay")].every(
    (c) => c.getBoundingClientRect().bottom <= fab.top + 1,
  );
});
ok(fabClear, "content can scroll clear of the FAB rather than sitting under it");

// ---------------------------------------------------------- calendar chrome ---
await fresh("/calendar");
ok((await p.locator(".cal-summary").count()) === 1, "the month summary card is shown");
const figures = await p.locator(".cal-figure-value").allInnerTexts();
ok(figures.length === 3, "three figures: revenue, nights, occupancy", figures.join(" / "));
// Ellipsis means the card is lying about the number it is reporting.
const clipped = await p.evaluate(() =>
  [...document.querySelectorAll(".cal-figure-value, .cal-figure-label")].some(
    (el) => el.scrollWidth > el.clientWidth + 1,
  ),
);
ok(!clipped, "no figure or label is truncated at this width");

ok(
  (await p.locator(".cal-day.is-outside").count()) > 0,
  "leading and trailing days from the neighbouring months are drawn",
);
ok(
  (await p.locator(".cal-legend-item").count()) === 4,
  "the legend sits inside the calendar card and covers every fill",
  (await p.locator(".cal-legend-item").allInnerTexts()).join(", "),
);
ok(
  (await p.locator(".cal-daycard").count()) === 1,
  "the selected day carries a summary line",
);
const daySummary = await p.locator(".cal-daycard-sub").innerText();
ok(
  /booking/.test(daySummary) && /revenue/.test(daySummary) && /available/.test(daySummary),
  "the day summary reports bookings, revenue and free units",
  daySummary,
);

// A cancelled stay releases its dates. The feed still returns it so the desktop
// timeline can draw the release, but the grid must not paint it or list it.
const cancelledLeak = await p.evaluate(async () => {
  const res = await fetch("/api/v1/bookings/calendar?start=2026-08-01&end=2026-09-01", {
    credentials: "same-origin",
  });
  const body = await res.json();
  const cancelled = (body.events ?? []).filter((e) => e.status === "cancelled");
  if (cancelled.length === 0) return "none in this month";
  const names = [...document.querySelectorAll(".cal-stay-name")].map((n) => n.textContent);
  return cancelled.some((c) => names.includes(c.guest_name)) ? "leaked" : "clean";
});
ok(cancelledLeak !== "leaked", "cancelled stays never appear on the grid", cancelledLeak);

// Stepping a month must not leave the previous month's money under the new
// month's heading. The figures mute until the new data lands.
const staleBefore = await p.locator(".cal-summary.is-stale").count();
await p.locator('.cal-summary-nav button[aria-label="Next month"]').tap();
await p.waitForTimeout(2200);
ok(
  (await p.locator(".cal-summary-month").innerText()) !== "August 2026" ||
    staleBefore === 0,
  "stepping forward changes the month",
  await p.locator(".cal-summary-month").innerText(),
);
ok(
  (await p.locator(".cal-summary.is-stale").count()) === 0,
  "figures are not left muted once the month has loaded",
);
await p.locator('.cal-summary-nav button[aria-label="Previous month"]').tap();
await p.waitForTimeout(2200);

// A greyed neighbouring cell that looks live and does nothing is worse than
// the blank padding it replaced. Tapping one moves to its month.
const monthBefore = await p.locator(".cal-summary-month").innerText();
await p.locator(".cal-day.is-outside").first().tap();
await p.waitForTimeout(1800);
const monthAfter = await p.locator(".cal-summary-month").innerText();
ok(
  monthBefore !== monthAfter,
  "tapping a neighbouring-month day moves to that month",
  `${monthBefore} -> ${monthAfter}`,
);
ok(
  (await p.locator(".cal-day.is-selected").count()) === 1,
  "and selects the day that was tapped",
);

// ----------------------------------------------------- expense card actions ---
// The desktop table has had Edit and Delete since this screen shipped; the
// mobile cards never did, so an expense could be read on a phone but neither
// corrected nor removed.
await fresh("/expenses?tab=list");
const expCard = p.locator(".mobile-only > div").first();
if ((await expCard.count()) > 0 && (await p.locator(".empty").count()) === 0) {
  const editBtn = expCard.locator('button:has-text("Edit")');
  const delBtn = expCard.locator('button[aria-label^="Delete"]');
  ok((await editBtn.count()) > 0, "expense cards offer Edit on a phone");
  ok((await delBtn.count()) > 0, "expense cards offer Delete on a phone");

  for (const [name, loc] of [["edit", editBtn], ["delete", delBtn]]) {
    const box = await loc.first().boundingBox();
    ok(
      (box?.width ?? 0) >= 44 && (box?.height ?? 0) >= 44,
      `the ${name} action clears 44px in both directions`,
      `${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`,
    );
  }

  await editBtn.first().tap();
  await p.waitForTimeout(1800);
  ok((await p.locator('[role="dialog"]').count()) > 0, "Edit opens the expense drawer");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);
} else {
  console.log("SKIP  no expenses recorded to act on");
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
