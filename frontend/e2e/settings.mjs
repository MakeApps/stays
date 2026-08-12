import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "settings-e2e@localshouts.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD to the password of E2E_EMAIL's account.");
  process.exit(2);
}

/**
 * Settings, and the password change on it.
 *
 * Run this against a throwaway account, not the admin: it really does change
 * the password. It changes it back at the end, so a clean run leaves the
 * account exactly as it found it — a crash midway does not, and the account is
 * then on TEMP below.
 *
 * The load-bearing check is that a wrong current password is a field error and
 * not a sign-out. The server returns 422 rather than 401 precisely so the
 * browser client does not read it as a dead session and bounce the person who
 * is standing there trying to fix a typo.
 */
const TEMP = "temporary-e2e-password";

const errs = [];
let passed = 0;
let total = 0;
const ok = (c, l, x = "") => {
  total += 1;
  if (c) passed += 1;
  console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(String(e)));

const fresh = async (path) => {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
};

const signIn = async (password) => {
  await fresh("/login");
  await p.fill("#email", EMAIL);
  await p.fill("#password", password);
  await p.click('button[type="submit"]');
};

const changePassword = async (current, next) => {
  await p.fill('input[name="current_password"]', current);
  await p.fill('input[name="new_password"]', next);
  await p.fill('input[name="confirm_password"]', next);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(1800);
};

try {
  // ---- reaching the screen ----
  await signIn(PASSWORD);
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
  ok(true, "signs in with the starting password");

  // The pill is the only way in, so a broken overlay link makes the whole
  // screen unreachable rather than merely awkward.
  await p.click(".user-pill a[aria-label='Settings']");
  await p.waitForURL((u) => u.pathname === "/settings", { timeout: 20000 });
  await p.waitForTimeout(1200);
  ok(true, "the sidebar user pill opens /settings");

  ok(
    await p.locator(".sign-out").isVisible(),
    "the sign-out button survives the overlay link",
  );

  // ---- client-side guards ----
  await p.fill('input[name="current_password"]', PASSWORD);
  await p.fill('input[name="new_password"]', TEMP);
  await p.fill('input[name="confirm_password"]', `${TEMP}-different`);
  await p.click('button[type="submit"]');
  await p.waitForTimeout(700);
  ok(
    (await p.locator(".field small.error").filter({ hasText: "do not match" }).count()) > 0,
    "a mismatched confirmation is caught before the request",
  );

  await p.fill('input[name="new_password"]', "short");
  await p.fill('input[name="confirm_password"]', "short");
  await p.click('button[type="submit"]');
  await p.waitForTimeout(700);
  ok(
    (await p.locator(".field small.error").filter({ hasText: "8 characters" }).count()) > 0,
    "a too-short password is caught before the request",
  );

  // ---- the wrong current password must not end the session ----
  await changePassword("definitely-not-the-password", TEMP);
  ok(p.url().includes("/settings"), "a wrong current password does not bounce to /login", p.url());
  ok(
    (await p.locator(".field small.error").count()) > 0,
    "a wrong current password reports against the field",
  );

  // ---- the real change ----
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await changePassword(PASSWORD, TEMP);
  ok(p.url().includes("/settings"), "stays on settings after the change", p.url());

  // Revoking every session is the point; re-issuing one is what stops that
  // logging out the person who asked for it.
  await fresh("/");
  ok(!p.url().includes("/login"), "the calling session survives the change", p.url());

  // ---- the new password is the real one ----
  await p.click(".sign-out");
  await p.waitForURL((u) => u.pathname.includes("/login"), { timeout: 20000 });

  await signIn(PASSWORD);
  await p.waitForTimeout(1600);
  ok(p.url().includes("/login"), "the old password no longer signs in");

  await signIn(TEMP);
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
  ok(true, "the new password signs in");

  // ---- put it back ----
  await fresh("/settings");
  await changePassword(TEMP, PASSWORD);
  await fresh("/");
  ok(!p.url().includes("/login"), "restored the starting password");
} catch (error) {
  ok(false, "run completed without throwing", String(error).slice(0, 200));
}

ok(errs.length === 0, "no uncaught page errors", errs.slice(0, 2).join(" | "));

await b.close();
console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);
