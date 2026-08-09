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

- `dashboard.mjs` — the dashboard's KPIs and income-by-day chart (including
  that hovering a bar updates the header readout, as the design does), global
  search across all three entity types with navigation, and a real CSV download
  checked for its UTF-8 BOM and row count.

## Two mutually exclusive fixtures

`npm run e2e` asserts **exact figures from the seeded demo data** and needs it
loaded:

    cd backend && flask --app wsgi seed-demo --force

`npm run e2e:empty` asserts the opposite - that every screen survives a
**completely empty** database - and needs it cleared:

    cd backend && flask --app wsgi reset-data --yes

They cannot both pass at once, by design. Empty states are written early and
then almost never exercised, because development happens against seeded data,
and that is exactly where divide-by-zero and stray `undefined` reach a money
screen. `empty.mjs` walks all eight screens and fails on any of `NaN`,
`undefined`, `null`, `[object Object]` or `Infinity` appearing in the rendered
text.

## A known flake in the backend suite

The backend suite intermittently fails with a MySQL error on an unrelated
statement — usually inside the `auth_client` login fixture:

    OperationalError: (1213, 'Deadlock found when trying to get lock')
    OperationalError: (1412, 'Table definition has changed, please retry')

It looks exactly like a bug in whatever you just changed. It is not.

`tests/conftest.py` commits for real and truncates every table between tests
(see its docstring for why). That means the outer test session and the
request's own session are two connections contending over the same rows, plus
DDL from `create_all`/`drop_all` at session boundaries. Anything that adds
load makes it likelier.

Observed, honestly: it has failed and passed under both random and fixed
ordering, and with the dev stack both running and stopped. Neither factor
alone explains it. The most reliable configuration is

    .\dev.ps1 -Stop
    cd backend && .\.venv\Scripts\python.exe -m pytest -q

but that is a probability, not a guarantee. Before investigating a failure
here, re-run it. If it moves, it is this. If it reproduces on the same test
twice, it is yours.

This is pre-existing infrastructure fragility rather than test coupling, and
it has been left visible rather than papered over with a retry.
