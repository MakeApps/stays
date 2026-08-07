# End-to-end checks

Browser-driven verification of the Phase 1 slice. Both scripts assume the API
is on :8000 and Next on :3000, and that `flask create-admin` and
`flask seed-demo` have been run.

    npm run e2e

- `ui.mjs` — auth redirect, sign-in, the condo grid, filter pills, detail
  drawer, add modal, validation, and the mobile layout. Also asserts things
  that would silently regress the design integration: `.btn-primary` keeping
  the DS purple (proving Preflight is layered correctly), the card shadow
  surviving the `--ds-*` alias hop, and the 248px sidebar.
- `crud.mjs` — create, duplicate-code rejection, persistence across reload,
  edit, the full detail page, soft delete, and code reuse after soft delete.

`crud.mjs` writes real rows. It cleans up after itself on a successful run; if
it crashes midway, purge leftovers before re-running or a stale row will make
the money assertion match the wrong card:

    DELETE FROM condos WHERE code LIKE 'PW-%';

Hydration matters: Next streams the shell before the client bundle attaches,
and clicking too early triggers a native form submit instead of the React
handler. `ui.mjs` has a `hydrated()` helper for this — use it after every
navigation that is followed by interaction.

- `bookings.mjs` — the booking form's live totals and dual pricing mode, the
  conflict banner (including that a same-day turnover is *not* flagged), the
  booking list and its mobile card fallback, and the calendar timeline with a
  real pointer drag that moves a booking three days.

`bookings.mjs` also writes real rows. Purge before re-running after a crash,
or a leftover booking will trigger a conflict and the save button will read
"Resolve conflict to save" instead:

    DELETE FROM booking_nights; DELETE FROM bookings;

- `money.mjs` — the income and expenses screens against the seeded demo data.
  Because that data comes from the design, the assertions are exact figures
  rather than "renders something": revenue ฿215,800, expenses ฿73,480 with the
  cancelled bill excluded, net ฿142,320. It also checks the donut is a
  `conic-gradient` div rather than an SVG chart, that a cancelled expense is
  struck through, and that a created expense round-trips 1234.50 baht through
  satang.

**If an endpoint 404s that should exist, the Flask process is stale.** A dev
server started before a blueprint was added keeps serving the old route map.
Kill and restart it:

    powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*wsgi*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
