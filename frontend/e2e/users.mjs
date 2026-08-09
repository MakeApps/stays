import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "admin@localshouts.co.th";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD (see backend/.env.local ADMIN_PASSWORD).");
  process.exit(2);
}

/**
 * The Users screen.
 *
 * The load-bearing checks are the two that cost real money to get wrong: a
 * created account can actually do the job, and it cannot reach this screen to
 * create more.
 */
const errs = [];
let passed = 0;
let total = 0;
const ok = (c, l, x = "") => {
  total += 1;
  if (c) passed += 1;
  console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? " - " + x : ""}`);
};

const TEST_EMAIL = "pwuser@localshouts.test";
const TEST_PASSWORD = "playwright-user-pw";

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(String(e)));

const fresh = async (path) => {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1400);
};

await fresh("/login");
await p.fill("#email", EMAIL);
await p.fill("#password", PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

const call = (path, init) =>
  p.evaluate(
    async ({ path, init }) => {
      const res = await fetch(path, {
        ...init,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { path, init },
  );

async function cleanup() {
  const list = await call("/api/v1/users?per_page=100");
  for (const u of list.body?.items ?? []) {
    if (/@localshouts\.test$/.test(u.email)) {
      await call(`/api/v1/users/${u.id}`, { method: "DELETE" });
    }
  }
  const condos = await call("/api/v1/condos?per_page=100");
  for (const c of condos.body?.items ?? []) {
    if (/^PWUser/.test(c.name)) await call(`/api/v1/condos/${c.id}`, { method: "DELETE" });
  }
}
await cleanup();

// ------------------------------------------------------------------- nav ---
await fresh("/");
ok(
  (await p.locator('.sidebar-item:has-text("Users")').count()) === 1,
  "the admin sees a Users item in the nav",
);

// ------------------------------------------------------------------ list ---
await fresh("/users");
ok(p.url().endsWith("/users"), "the Users screen loads", p.url());
const listText = await p.locator("main").innerText();
ok(listText.includes(EMAIL), "the admin's own account is listed");
ok(/Admin/.test(listText), "the owner account is marked");
ok(!/NaN|undefined|\[object Object\]/.test(listText), "no broken values");
// A password or its hash reaching the browser would be the worst bug here.
const listPayload = await call("/api/v1/users");
ok(
  JSON.stringify(listPayload.body).match(/password/i) === null,
  "no password field is sent to the browser",
);

// The owner account offers no self-destruct.
const adminRow = p.locator("tr", { hasText: EMAIL });
ok(
  (await adminRow.locator('button:has-text("Suspend")').count()) === 0,
  "the owner account offers no Suspend button",
);
ok(
  (await adminRow.locator(`button[aria-label*="Remove"]`).count()) === 0,
  "the owner account offers no Remove button",
);
// And the server refuses regardless of what the UI offers.
const adminId = listPayload.body.items.find((u) => u.email === EMAIL).id;
const selfDelete = await call(`/api/v1/users/${adminId}`, { method: "DELETE" });
ok(selfDelete.status === 422, "the server refuses to delete your own account", String(selfDelete.status));

// ---------------------------------------------------------------- create ---
await p.locator('button:has-text("Add user")').click();
await p.waitForSelector("text=Full name", { timeout: 10000 });
ok(
  (await p.locator("text=/role/i").count()) === 0,
  "the form asks for no role",
);
await p.fill('input[name="full_name"]', "Playwright User");
await p.fill('input[name="email"]', TEST_EMAIL);
await p.fill('input[name="password"]', "short");
await p.locator('button[type="submit"]').click();
await p.waitForTimeout(700);
ok((await p.locator("small.error").count()) > 0, "a short password is refused on the field");

await p.fill('input[name="password"]', TEST_PASSWORD);
await p.locator('button[type="submit"]').click();
await p.waitForTimeout(2500);
await fresh("/users");
ok(
  (await p.locator("main").innerText()).includes(TEST_EMAIL),
  "the new user appears in the list",
);

// ------------------------------------------------ what the new user can do ---
const theirs = await b.newContext({ viewport: { width: 1400, height: 950 } });
const tp = await theirs.newPage();
await tp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await tp.fill("#email", TEST_EMAIL);
await tp.fill("#password", TEST_PASSWORD);
await tp.click('button[type="submit"]');
await tp.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
ok(!tp.url().includes("/login"), "the new user can sign in", tp.url());

await tp.goto(`${BASE}/condos`, { waitUntil: "networkidle" });
await tp.waitForTimeout(1600);
ok(
  (await tp.locator('button:has-text("Add condo"), a:has-text("Add condo")').count()) > 0,
  "the new user can reach the work",
);

const theirCall = (path, init) =>
  tp.evaluate(
    async ({ path, init }) => {
      const res = await fetch(path, {
        ...init,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
      });
      return { status: res.status };
    },
    { path, init },
  );

const made = await theirCall("/api/v1/condos", {
  method: "POST",
  body: JSON.stringify({ name: "PWUser Unit", code: "PWU-1", night_rate: "1200" }),
});
ok(made.status === 201, "the new user can create a condo", String(made.status));

// The one thing they must not do.
ok(
  (await tp.locator('.sidebar-item:has-text("Users")').count()) === 0,
  "the new user sees no Users item in the nav",
);
ok((await theirCall("/api/v1/users")).status === 403, "the API refuses them the user list");
ok(
  (await theirCall("/api/v1/users", {
    method: "POST",
    body: JSON.stringify({ full_name: "Sneak", email: "sneak@x.test", password: "12345678" }),
  })).status === 403,
  "the API refuses them creating users",
);
await tp.goto(`${BASE}/users`, { waitUntil: "networkidle" });
await tp.waitForTimeout(1600);
ok(!tp.url().endsWith("/users"), "visiting /users directly redirects them away", tp.url());

// -------------------------------------------------------- suspend, resume ---
const created = (await call("/api/v1/users")).body.items.find((u) => u.email === TEST_EMAIL);
ok((await call(`/api/v1/users/${created.id}`, {
  method: "PATCH",
  body: JSON.stringify({ is_active: false }),
})).status === 200, "the admin can suspend them");

const blocked = await b.newContext();
const bp = await blocked.newPage();
await bp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await bp.fill("#email", TEST_EMAIL);
await bp.fill("#password", TEST_PASSWORD);
await bp.click('button[type="submit"]');
await bp.waitForTimeout(2500);
ok(bp.url().includes("/login"), "a suspended user cannot sign in", bp.url());

// ---------------------------------------------------------------- cleanup ---
await cleanup();
await fresh("/users");
ok(
  !(await p.locator("main").innerText()).includes(TEST_EMAIL),
  "suite cleans up after itself",
);

console.log("\npage errors: " + (errs.length ? errs.join("; ") : "none"));
console.log(`\n${passed}/${total} passed`);
await b.close();
if (passed !== total || errs.length) process.exit(1);
