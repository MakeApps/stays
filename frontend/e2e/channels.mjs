import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const API = process.env.E2E_API ?? "http://localhost:8000";
const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!EMAIL || !PASSWORD) {
  console.error("Set E2E_EMAIL and E2E_PASSWORD to an admin account.");
  process.exit(2);
}

/**
 * The Channels screen, and the outbound calendar it publishes.
 *
 * Deliberately does not press "Sync now". That makes a real request to
 * airbnb.com, so the inbound half is covered by tests/test_channels.py with the
 * socket stubbed instead. What is checked here is everything that can be
 * verified end to end without Airbnb:
 *
 *   connect -> map a listing -> the feed URL serves a real calendar
 *
 * The load-bearing assertions are the two the feature would be dishonest
 * without: that the screen says pricing is *not* supported over this
 * connection, and that the published feed carries no guest name.
 *
 * Needs PUBLIC_BASE_URL set on the API (see backend/.env.example) or the feed
 * assertions are skipped with a note rather than silently passing.
 *
 * Cleans up after itself: the mapping is removed and the channel disconnected.
 */
const AIRBNB_URL = "https://www.airbnb.com/calendar/ical/999000111.ics?s=e2e-not-a-real-token";

const errs = [];
let passed = 0;
let total = 0;
let skipped = 0;
const ok = (c, l, x = "") => {
  total += 1;
  if (c) passed += 1;
  console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);
};
const skip = (l, why) => {
  skipped += 1;
  console.log(`SKIP  ${l} - ${why}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(String(e)));

const fresh = async (path) => {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
};

try {
  // ---- reaching the screen ----
  await fresh("/login");
  await p.fill("#email", EMAIL);
  await p.fill("#password", PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

  await p.click('.sidebar-item[aria-label="Channels"]');
  await p.waitForURL((u) => u.pathname === "/channels", { timeout: 20000 });
  await p.waitForTimeout(1200);
  ok(true, "the sidebar reaches /channels");

  // ---- the honesty check ----
  // If this ever reads "Synced", the UI is claiming a capability the iCal
  // transport does not have, and someone will trust it with their rates.
  const body = await p.locator("section").first().innerText();
  ok(/Pricing[\s\S]{0,80}Not supported/i.test(body), "pricing is declared unsupported over iCal");
  ok(
    /Live updates[\s\S]{0,80}Polled/i.test(body),
    "webhooks are declared as polling, not push",
  );

  // ---- connect ----
  const connect = p.locator("button", { hasText: "Connect Airbnb" });
  if (await connect.count()) {
    await connect.first().click();
    await p.waitForTimeout(1500);
  }
  ok(
    (await p.locator(".pill", { hasText: "Connected" }).count()) > 0,
    "Airbnb reports connected",
  );

  // ---- map a listing ----
  await p.click('button:has-text("Map a listing")');
  await p.waitForTimeout(800);

  const options = await p.locator('.modal select[name="condo_id"] option').count();
  if (options < 2) {
    throw new Error("no condos to map — run `flask seed-demo` first");
  }
  await p.selectOption('.modal select[name="condo_id"]', { index: 1 });

  // A URL that is not on airbnb.com must be refused before anything is stored:
  // the server is the one that fetches it, so this is the SSRF guard.
  await p.fill('.modal input[name="import_url"]', "https://evil.example.com/x.ics");
  await p.click('.modal button[type="submit"]');
  await p.waitForTimeout(1200);
  ok(
    (await p.locator(".modal").count()) > 0,
    "a non-Airbnb calendar URL is refused and the modal stays open",
  );

  await p.fill('.modal input[name="import_url"]', AIRBNB_URL);
  await p.click('.modal button[type="submit"]');
  await p.waitForTimeout(2000);
  ok((await p.locator(".modal").count()) === 0, "a valid Airbnb URL is accepted");

  const row = p.locator("table.data-table tbody tr").first();
  ok((await row.count()) > 0, "the mapping appears in the listings table");
  ok(
    (await row.innerText()).includes("999000111"),
    "the listing id was read out of the URL rather than typed",
  );

  // ---- the published feed ----
  const feedCell = await row.locator("code").count();
  if (!feedCell) {
    skip("the feed URL serves a calendar", "PUBLIC_BASE_URL is not set on the API");
    skip("the feed carries no guest name", "PUBLIC_BASE_URL is not set on the API");
  } else {
    const feedUrl = (await row.locator("code").first().getAttribute("title")) ?? "";
    ok(feedUrl.startsWith(API), "the feed URL is built from PUBLIC_BASE_URL", feedUrl);

    // Fetched with no cookies at all — this is the route a channel hits.
    const anon = await b.newContext();
    const res = await anon.request.get(feedUrl);
    const ics = await res.text();
    ok(res.status() === 200, "the feed answers unauthenticated", String(res.status()));
    ok(ics.startsWith("BEGIN:VCALENDAR"), "the feed is a calendar");
    ok(
      res.headers()["content-type"]?.includes("text/calendar") ?? false,
      "the feed is served as text/calendar",
    );

    // Whatever bookings exist for that condo, none of their guests may appear.
    // A leaked feed URL must disclose occupancy and nothing else.
    const named = /SUMMARY:(?!Not available)(?!.*VCALENDAR).+/i.exec(ics);
    ok(named === null, "the feed carries no guest name", named ? named[0] : "");

    const junk = await anon.request.get(`${API}/api/v1/channels/feed/not-a-token.ics`);
    ok(junk.status() === 404, "an unknown token is a 404", String(junk.status()));
    await anon.close();
  }

  // ---- the log records the mapping's first attempt ----
  ok(
    (await p.locator(".card-title", { hasText: "Sync log" }).count()) > 0,
    "the sync log is on the screen",
  );

  // ---- clean up ----
  p.once("dialog", (d) => d.accept());
  await p.click('button:has-text("Unmap")');
  await p.waitForTimeout(1800);
  ok(
    (await p.locator("table.data-table tbody tr").count()) === 0 ||
      !(await p.locator("table.data-table tbody tr").first().innerText()).includes("999000111"),
    "unmapping removes the row",
  );

  await p.click('button:has-text("Disconnect")');
  await p.waitForTimeout(1500);
  ok(
    (await p.locator(".pill", { hasText: "Disconnected" }).count()) > 0,
    "disconnecting returns the card to its starting state",
  );
} catch (error) {
  ok(false, "run completed without throwing", String(error).slice(0, 250));
}

ok(errs.length === 0, "no uncaught page errors", errs.slice(0, 2).join(" | "));

console.log(`\n${passed}/${total} passed${skipped ? `, ${skipped} skipped` : ""}`);
await b.close();
process.exit(passed === total ? 0 : 1);
