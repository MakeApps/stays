import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "admin@localshouts.co.th";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Set E2E_PASSWORD (see backend/.env.local ADMIN_PASSWORD).");
  process.exit(2);
}

/**
 * Leases, lease costs and refundable deposits.
 *
 * The assertions that matter are the accounting ones: a deposit must never
 * move net profit, and a lease cost must. Everything else is presentation.
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
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(String(e)));

const fresh = async (url) => {
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(1400);
};

await fresh(`${BASE}/login`);
await p.fill("#email", EMAIL);
await p.fill("#password", PASSWORD);
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

/** API calls reusing the page's session cookies. */
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
  // Bookings first. Removing a condo is a soft delete and leaves its bookings
  // live, so they would keep showing up under "Upcoming bookings" against a
  // unit that no longer exists.
  const bookings = await call("/api/v1/bookings?per_page=100");
  for (const bk of bookings.body?.items ?? []) {
    if (/^PWLease/.test(bk.guest_name)) {
      await call(`/api/v1/bookings/${bk.id}`, { method: "DELETE" });
    }
  }
  const list = await call("/api/v1/condos?per_page=100");
  for (const c of list.body?.items ?? []) {
    if (/^PWLease/.test(c.name)) await call(`/api/v1/condos/${c.id}`, { method: "DELETE" });
  }
}
await cleanup();

// Baselines first. This suite runs against whatever portfolio exists, so
// portfolio-wide totals are asserted as *contributions* rather than absolutes —
// otherwise it only passes on an empty database, which is the one state real
// use never has.
const baht = (label) => Number(String(label).replace(/[^\d.-]/g, ""));
const before = {
  income: (await call("/api/v1/income/summary")).body,
  dash: (await call("/api/v1/dashboard")).body,
};

// ------------------------------------------------------------------ setup ---
const created = await call("/api/v1/condos", {
  method: "POST",
  body: JSON.stringify({
    name: "PWLease Tower",
    code: "PWL-1",
    night_rate: "3000",
    security_deposit: "50000",
    monthly_lease_amount: "25000",
    lease_start_date: "2020-01-01",
    lease_end_date: "2026-12-31",
  }),
});
ok(created.status === 201, "condo created with a lease and a deposit", String(created.status));
const condoId = created.body.id;

ok(created.body.deposit_status === "held", "deposit starts held", created.body.deposit_status);
ok(
  created.body.deposit_outstanding_label === "฿50,000",
  "full deposit outstanding",
  created.body.deposit_outstanding_label,
);

// ------------------------------------------------------------ profit maths ---
const income = await call("/api/v1/income/summary");
const row = income.body.by_condo.find((r) => r.condo_id === condoId);
ok(
  row?.lease_cost_label === "฿25,000",
  "lease cost lands on the condo row",
  row?.lease_cost_label,
);
ok(
  row?.net_label === "-฿25,000",
  "net = revenue - lease - expenses, with no deposit in it",
  row?.net_label,
);
ok(
  baht(income.body.money_held.deposits) - baht(before.income.money_held.deposits) === 50000,
  "the deposit adds to money held",
  `${before.income.money_held.deposits} -> ${income.body.money_held.deposits}`,
);
ok(!("deposit" in income.body.kpis), "no deposit term anywhere in the KPIs");

const dash = await call("/api/v1/dashboard");
ok(
  baht(dash.body.kpis.deposits_held) - baht(before.dash.kpis.deposits_held) === 50000,
  "dashboard deposits held rises by exactly the deposit",
  `${before.dash.kpis.deposits_held} -> ${dash.body.kpis.deposits_held}`,
);
// The load-bearing assertion: a ฿50,000 deposit and a ฿25,000 lease were both
// added, and profit moved by the lease alone.
ok(
  baht(before.dash.kpis.net_month) - baht(dash.body.kpis.net_month) === 25000,
  "profit falls by the lease cost only, not by the deposit",
  `${before.dash.kpis.net_month} -> ${dash.body.kpis.net_month}`,
);

// --------------------------------------------------------------- bookings ---
const past = await call("/api/v1/bookings", {
  method: "POST",
  body: JSON.stringify({
    condo_id: condoId,
    guest_name: "PWLease Guest",
    check_in: "2026-12-28",
    check_out: "2027-01-04",
    mode: "nightly",
    night_rate: "3000",
  }),
});
ok(past.status === 422, "a stay past the lease end is refused", String(past.status));
ok(
  past.body?.error?.message === "Booking exceeds lease period",
  "with the exact wording from the brief",
  past.body?.error?.message,
);

const upTo = await call("/api/v1/bookings", {
  method: "POST",
  body: JSON.stringify({
    condo_id: condoId,
    guest_name: "PWLease Guest",
    check_in: "2026-12-28",
    check_out: "2026-12-31",
    mode: "nightly",
    night_rate: "3000",
  }),
});
ok(upTo.status === 201, "checking out on the lease end date is allowed", String(upTo.status));

// ----------------------------------------------------------------- refund ---
const over = await call(`/api/v1/condos/${condoId}/deposit/refunds`, {
  method: "POST",
  body: JSON.stringify({ refund_date: "2026-12-31", refunded_amount: "60000" }),
});
ok(over.status === 422, "recovering more than is held is refused", String(over.status));

const refund = await call(`/api/v1/condos/${condoId}/deposit/refunds`, {
  method: "POST",
  body: JSON.stringify({
    refund_date: "2026-12-31",
    refunded_amount: "45000",
    deducted_amount: "5000",
    deduction_reason: "Wall repair",
  }),
});
ok(refund.status === 201, "refund with a deduction recorded", String(refund.status));
ok(refund.body?.status === "refunded", "deposit closes out", refund.body?.status);

const after = await call("/api/v1/income/summary");
ok(
  baht(after.body.money_held.deposits) === baht(before.income.money_held.deposits),
  "money held returns to its starting level once recovered",
  `back to ${after.body.money_held.deposits}`,
);
const afterRow = after.body.by_condo.find((r) => r.condo_id === condoId);
ok(
  afterRow?.expenses_label === "฿0",
  "the deduction never became an operating expense",
  afterRow?.expenses_label,
);

// --------------------------------------------------------------------- UI ---
await fresh(`${BASE}/condos/${condoId}`);
const detail = await p.locator("main").innerText();
ok(/Lease & investment/i.test(detail), "condo page shows the Lease & investment card");
ok(/25,000/.test(detail), "monthly lease shown");
ok(/Refunded/.test(detail), "deposit status shown");
ok(/Lease cost/.test(detail), "lease cost appears in the finance panels");
ok(
  !/NaN|undefined|\[object Object\]/.test(detail),
  "condo page renders no broken values",
  /NaN|undefined|\[object Object\]/.exec(detail)?.[0] ?? "",
);

await fresh(`${BASE}/income`);
const incomeText = await p.locator("main").innerText();
ok(/Money held/i.test(incomeText), "income screen has a Money held section");
ok(/Lease costs/i.test(incomeText), "income screen shows lease costs");
ok(!/NaN|undefined/.test(incomeText), "income screen renders no broken values");

await fresh(`${BASE}/`);
const dashText = await p.locator("main").innerText();
ok(/Refundable deposits/i.test(dashText), "dashboard has the refundable deposits card");
await p.locator('button.stat:has-text("Refundable deposits")').click();
await p.waitForTimeout(800);
ok(
  (await p.locator("text=Total refundable security deposits currently held").count()) > 0,
  "clicking the card reveals the per-condo list",
);
ok(!/NaN|undefined/.test(await p.locator("main").innerText()), "dashboard renders no broken values");

await fresh(`${BASE}/bookings/new`);
const formText = await p.locator("main").innerText();
ok(!/NaN|undefined/.test(formText), "booking form renders no broken values");

await cleanup();
console.log("\npage errors: " + (errs.length ? errs.join("; ") : "none"));
console.log(`\n${passed}/${total} passed`);
await b.close();
if (passed !== total || errs.length) process.exit(1);
