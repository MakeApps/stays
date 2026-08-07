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
| 5 | Hardening, Docker, CI | Not started |

The calendar is a custom-built resource timeline, not FullCalendar. This is a
single-axis occupancy strip — one row per condo, one column per day — so
FullCalendar's expensive machinery (timezones, recurrence, event stacking)
would be entirely unused, stacking especially, since the overlap rule
guarantees bookings never collide within a condo. Building it also avoids a
recurring licence and keeps the screen pixel-identical to the approved design.
Drag-to-move, edge-resize and keyboard nudging are additions the design does
not have.

## Running it

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
flask --app wsgi seed-demo        # the nine condos from the design

flask --app wsgi run --port 8000
```

Useful commands: `flask --app wsgi routes-audit` lists every endpoint and the
capability it requires; `flask --app wsgi purge-tokens` clears expired refresh
tokens.

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
cd backend  && pytest             # 116 tests, needs a reachable database
cd frontend && npm run typecheck
cd frontend && npm run verify:ds  # fails if the vendored DS drifts from _ds/
cd frontend && npm run e2e        # browser checks; needs both servers running
```

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
