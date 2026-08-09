"use client";

import { useMemo } from "react";

import { PAY_META } from "@/features/bookings/BookingsScreen";
import type { BookingStatus, CalendarEvent, CalendarResource } from "@/types/api";

/**
 * The mobile calendar.
 *
 * The desktop view is a resource timeline — condos down, days across. That
 * shape needs horizontal room it simply does not have at 390px: the condo
 * column alone ate 60% of the screen and the bars fell off the right edge.
 *
 * So mobile gets the calendar people actually expect on a phone: a month grid
 * you scan, tap a day, and read that day's stays underneath. Same data, same
 * colours, a shape that fits the hand.
 *
 * Rendered alongside the timeline and chosen by CSS (`.mobile-only` /
 * `.desktop-only`), never by `window.innerWidth`. Branching on width in JS is
 * a hydration mismatch and a layout flash — the prototype's `st.vw <= 768`
 * trick, which does not survive SSR.
 */

const DOT: Record<BookingStatus, string> = {
  booked: "var(--info)",
  pending: "var(--warning)",
  maintenance: "var(--danger)",
  cancelled: "var(--fg-4)",
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** Built from parts, never `.toISOString()` — that shifts a stay date by a day. */
function dayISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A stay covers check_in through the night before check_out (half-open). */
function covers(event: CalendarEvent, iso: string): boolean {
  return event.check_in <= iso && iso < event.check_out;
}

export function MonthGrid({
  anchor,
  events,
  resources,
  today,
  selected,
  onSelect,
  onOpen,
}: {
  /** Any date in the month being shown. */
  anchor: string;
  events: CalendarEvent[];
  resources: CalendarResource[];
  today: string;
  selected: string;
  onSelect: (iso: string) => void;
  onOpen: (id: string) => void;
}) {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));

  const cells = useMemo(() => {
    // UTC throughout: Date.UTC(y, m, 0) is the last day of month m, and
    // getUTCDay on a UTC-constructed date cannot drift across a timezone.
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const out: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(dayISO(year, month, d));
    // Pad to whole weeks so the grid keeps its shape instead of the last row
    // collapsing to a different cell width.
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  /** One pass over the events rather than a filter per cell. */
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const cell of cells) {
      if (!cell) continue;
      const hits = events.filter((e) => covers(e, cell));
      if (hits.length) map.set(cell, hits);
    }
    return map;
  }, [cells, events]);

  const condoName = useMemo(() => {
    const map = new Map(resources.map((r) => [r.id, r]));
    return (id: string) => map.get(id)?.name ?? "";
  }, [resources]);

  const agenda = byDay.get(selected) ?? [];
  const selectedDate = new Date(`${selected}T00:00:00Z`);

  return (
    <div className="mobile-only">
      <div className="cal-grid-card">
        <div className="cal-weekdays">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="cal-weekday" aria-hidden="true">
              {w}
            </div>
          ))}
        </div>

        <div className="cal-grid" role="grid" aria-label={`${MONTHS[month - 1]} ${year}`}>
          {cells.map((iso, i) => {
            if (!iso) return <div key={`pad-${i}`} className="cal-day is-pad" />;

            const hits = byDay.get(iso) ?? [];
            const isToday = iso === today;
            const isSelected = iso === selected;
            const day = Number(iso.slice(8, 10));

            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                onClick={() => onSelect(iso)}
                aria-pressed={isSelected}
                aria-label={`${day} ${MONTHS[month - 1]}, ${
                  hits.length === 0
                    ? "no stays"
                    : `${hits.length} stay${hits.length === 1 ? "" : "s"}`
                }`}
                className={`cal-day${isToday ? " is-today" : ""}${
                  isSelected ? " is-selected" : ""
                }`}
              >
                <span className="cal-day-num">{day}</span>
                {/* Three dots maximum, then a count — a phone cell cannot
                    show eight bookings, and pretending otherwise makes the
                    row unreadable. */}
                <span className="cal-dots">
                  {hits.slice(0, 3).map((e) => (
                    <span key={e.id} className="cal-dot" style={{ background: DOT[e.status] }} />
                  ))}
                  {hits.length > 3 ? <span className="cal-more">+{hits.length - 3}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="cal-agenda">
        <div className="cal-agenda-head">
          <h3 className="card-title">
            {WEEKDAY_NAMES[selectedDate.getUTCDay()]} {selectedDate.getUTCDate()}{" "}
            {MONTHS[month - 1]}
          </h3>
          <span className="t-caption">
            {agenda.length === 0
              ? "Nothing booked"
              : `${agenda.length} stay${agenda.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {agenda.length === 0 ? (
          <div className="empty" style={{ padding: "28px 16px" }}>
            No stays on this day.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {agenda.map((e) => (
              <button
                key={e.id}
                type="button"
                className="cal-agenda-row"
                onClick={() => onOpen(e.id)}
              >
                <span className="cal-agenda-bar" style={{ background: DOT[e.status] }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="cal-agenda-name">{e.guest_name}</span>
                  <span className="cal-agenda-sub">
                    {condoName(e.condo_id)} · {e.nights} night{e.nights === 1 ? "" : "s"}
                    {e.check_in === selected ? " · checks in" : ""}
                    {e.check_out === addOneDay(selected) ? " · checks out tomorrow" : ""}
                  </span>
                </span>
                <span className={PAY_META[e.payment_status].pill}>
                  {PAY_META[e.payment_status].label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** String-only date step, for the "checks out tomorrow" hint. */
function addOneDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
