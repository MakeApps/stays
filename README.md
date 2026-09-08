# LocalShouts Stays

Condo, booking and expense management for Bangkok rentals. Built against the
approved design in `Condo Manager.dc.html`, which is kept in the repo as the
pixel contract — open it in a browser to compare any screen side by side.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Foundation, auth, condos end-to-end | **Done** |
| 2 | Bookings + calendar timeline | **Done** |
| 3 | Expenses, income, profit | **Done** |
| 4 | Dashboard, global search, CSV export | **Done** |
| 5 | Hardening, Docker, CI | **Partly done** |

The calendar is a custom-built resource timeline, not FullCalendar. This is a
single-axis occupancy strip — one row per condo, one column per day — so
FullCalendar's expensive machinery (timezones, recurrence, event stacking)
would be entirely unused, stacking especially, since the overlap rule
guarantees bookings never collide within a condo. Building it also avoids a
recurring licence and keeps the screen pixel-identical to the approved design.
Drag-to-move, edge-resize and keyboard nudging are additions the design does
not have.

## Quick start

```powershell
.\dev.ps1              # start the API and web app
.\dev.ps1 -Reset       # wipe and reload the demo data first
.\dev.ps1 -Stop        # stop everything
```

It prints the URL and the admin credentials from `backend/.env.local` when both
servers answer. It always restarts rather than reusing what is running: a Flask
process started before a route was added keeps serving the old route map, which
shows up as a 404 on an endpoint that demonstrably exists.

## Running it manually

Prerequisites: Node 20+, Python 3.12+, and a MySQL-compatible server. Local
development targets XAMPP's MariaDB; production targets MySQL 8.0, so the
schema stays inside the common subset of both.

### Backend

```bash
cd backend
py -3.12 -m venv .venv
.venv/Scripts/activate            # source .venv/bin/activate on POSIX
pip install -e ".[dev]"

cp .env.example .env.local        # then fill SECRET_KEY and JWT_SECRET:
                                  # python -c "import secrets; print(secrets.token_urlsafe(48))"

mysql -u root -e "CREATE DATABASE localshouts_stays CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
alembic upgrade head
flask --app wsgi create-admin     # prints a generated password if ADMIN_PASSWORD is blank
                                  # also creates the first organisation, with
                                  # the admin as its admin
flask --app wsgi seed-demo        # the nine condos from the design

flask --app wsgi run --port 8000
```

Useful commands: `flask --app wsgi routes-audit` lists every endpoint and the
capability it requires; `flask --app wsgi purge-tokens` clears expired refresh
tokens.

Everything below an organisation belongs to it: condos, bookings, expenses,
the categories they are filed under, and the activity feed. `seed-demo`,
`seed-lookups` and `reset-data` therefore act on one, and take `--org NAME`
when more than one exists — with several present they refuse rather than guess,
because seeding demo data into a real customer's account is not undone by
editing a row.

### Frontend

```bash
cd frontend
npm install
npm run dev                       # http://localhost:3000
```

The browser only ever talks to Next. `/api/v1/*` is proxied to Flask by a BFF
route so the auth cookies stay first-party and httpOnly.

`/ds` (development only) is a proof sheet for the design-system integration —
if anything there looks unstyled, the cascade layer order in `app/globals.css`
is wrong.

## Testing

```bash
cd backend  && pytest             # 358 tests, needs a reachable database
cd frontend && npm run typecheck
cd frontend && npm run verify:ds  # fails if the vendored DS drifts from _ds/
cd frontend && E2E_PASSWORD=... npm run e2e   # browser checks across 11 screens; needs both servers running
```

## Deployment

`docker/` and `.github/workflows/ci.yml` are **authored but unverified** —
Docker is not installed on the machine this was built on, so nothing there has
been built or run. `docker/README.md` lists what to expect to fix first.
Shipping compose files as production-ready without running them is how a deploy
fails at the worst moment, so they say so on the tin.

Channel sync needs a **cron entry**; nothing schedules it in-process, on
purpose (see the channels note below). Without this, calendars simply never
sync — there is no error to notice:

```cron
*/15 * * * * cd ~/stays/backend && venv/bin/flask --app wsgi channels-sync >> ~/channels.log 2>&1
```

Two settings must be present in production or the feature is inert:
`CHANNEL_ENCRYPTION_KEY` (the app refuses to boot without it) and
`PUBLIC_BASE_URL` (blank means no feed URL is shown to paste into Airbnb).

The app **refuses to boot in production** with a generated signing key, DEBUG
on, wildcard CORS, a placeholder-looking admin password, or a missing
`CHANNEL_ENCRYPTION_KEY`. Those failures are silent in development and
expensive later, so they are a startup error instead.

## Things worth knowing

**Money is integer satang.** Never floats. The API speaks baht at its edges
because that is what the design's inputs show; conversion lives only in
`backend/app/common/money.py`. `split_evenly()` guarantees prorated shares sum
exactly to the total, which is what keeps accrual revenue honest.

**Condo status is derived, never stored.** It comes from today's date against
that unit's bookings. Only an explicit maintenance flag is persisted.

**Booking overlap is half-open**: `newIn < existing.out && newOut > existing.in`.
A checkout and a checkin on the same day do *not* collide — that is a normal
turnover day, and it has its own test.

**Double-booking is prevented by the database**, not by application logic.
`booking_nights` holds one row per occupied night keyed on
`(condo_id, night_date)`, so a conflicting insert violates the primary key.
There is no window in which two concurrent requests both pass an availability
check; a threaded test asserts exactly one 201 and one 409.

**Revenue is accrual.** Each booking night carries its share of the total, so a
stay from 28 Aug to 4 Sep contributes to both months in proportion and the two
halves sum back exactly. That is what `booking_nights.revenue_share` is for.

**Cancelled expenses stay on the record but out of every total** — a cancelled
bill is still part of the audit trail. Maintenance blocks hold their dates but
count as neither revenue nor occupancy.

**CSV exports carry a UTF-8 BOM.** Without it Excel reads the file as the
system codepage and Thai vendor names and the baht sign arrive as mojibake.

**Donuts are CSS, not a charting library.** The design draws them with
`conic-gradient` plus a hard mask edge that SVG arcs cannot reproduce, and
Recharts would add ~95 KB to render something CSS already does exactly.

**Pricing lives server-side.** `backend/app/services/pricing.py` is the
authority; `frontend/lib/booking-math.ts` mirrors it purely for live preview
while typing. If you change one, change both — a figure that shifts between the
form and the confirmation destroys trust in a money screen faster than a bug.

**Condo code uniqueness is enforced in the service, not by a UNIQUE index.**
MySQL has no partial index, so a hard constraint would make a code permanently
unusable after a soft delete.

**The design had defects that are fixed here.** Its Add-Condo modal has no size
field although two screens display m² (the prototype hardcoded 38), and it
captured property type, address, description and photos then discarded all four
on save. All five now persist.

**Airbnb syncs over iCal, not an API, and that is not a shortcut.** Airbnb has
no public API: access is partner-only, behind an application that needs an
already-shipped product, a data security review and an API quality review. So
`app/channels/` uses the one path open to every host — the per-listing iCal
export URL, plus an export of our own that Airbnb polls. That carries dates and
a status label and nothing else: **no guest names, no amounts, no pricing, no
webhooks**, and one to four hours of latency each way.

Rather than hide that, each adapter declares a `ChannelCapability` set and the
UI reads it, so the screen says "Pricing — not supported over this connection"
instead of showing a tick it has not earned. When the partner application is
approved, a second adapter behind the same interface declares more and the same
screens light up unchanged.

Three rules in `channel_service.py` are load-bearing, and each exists because
the alternative loses somebody's money:

- **An imported stay lands as a *block*, not a booking.** It holds the nights so
  the unit cannot be sold twice, but `MAINTENANCE` is outside `REVENUE_STATUSES`,
  so a stay with no amount attached cannot drag the dashboard's net figure.
- **A local booking is never overwritten.** A feed that disagrees with a booking
  someone was paid for records a conflict for a human; it does not delete it.
  Each attempt runs in its own savepoint, because `BookingService.create`
  flushes the booking before claiming its nights and a caught conflict would
  otherwise commit a phantom booking holding no nights.
- **A channel's own reservations are never echoed back to it.**

**The published calendar feed is deliberately unauthenticated.** Airbnb's
fetcher holds no credentials of ours and cannot be given any. Its guard is a
32-byte token in the path, and the document carries occupancy dates and nothing
else. The subtle part is tenancy: `_apply_organisation_scope` filters on the
ambient organisation, and an unauthenticated request has *none* — which means
unfiltered, not denied. `calendar_for_token` re-establishes the owning
organisation's scope before reading a single booking, and a test asserts one
tenant's token never returns another's nights.

**Channel syncs run from cron, not from a thread.** `flask channels-sync` every
ten to fifteen minutes. Gunicorn runs several workers, so an in-process timer
would poll every listing once per worker and race the retry counters. Backoff
state lives on `channel_listings` (5 min doubling to a 6 h cap) and a MySQL
`GET_LOCK` on its own connection stops two ticks overlapping — its own
connection because `Session.commit()` returns the pooled one and MySQL drops
the lock with it.

**Windows notes.** Gunicorn does not run on Windows; use `waitress-serve
--port=8000 wsgi:app` for a production-like check. Console output of `฿`
needs `PYTHONIOENCODING=utf-8`.

## Layout

```
backend/    Flask API — routes → controllers → services → repositories
frontend/   Next.js 15 App Router
_ds/        imported design system; the vendored copy in frontend/styles/ds
            is drift-checked against it
```
