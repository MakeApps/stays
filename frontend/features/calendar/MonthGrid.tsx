"use client";

import Image from "next/image";
import { useMemo } from "react";

import { CalendarIcon, ChartIcon, ChevronRightIcon, WalletIcon } from "@/components/layout/icons";
import { PAY_META } from "@/features/bookings/BookingsScreen";
import type {
  BookingStatus,
  CalendarDay,
  CalendarEvent,
  CalendarResource,
} from "@/types/api";

/**
 * The mobile calendar.
 *
 * The desktop view is a resource timeline — condos down, days across. That
 * shape needs horizontal room it does not have at 390px: the condo column
 * alone took 60% of the screen and the bars fell off the right edge.
 *
 * So mobile gets the calendar people expect on a phone: a month you scan, a
 * day you tap, and that day's stays underneath. Rendered alongside the
 * timeline and chosen by CSS, never by `window.innerWidth` — branching on
 * width in JS is a hydration mismatch and a visible reflow on first paint.
 */

/** Cell fill and dot, by the status occupying that night. */
const TONE: Record<BookingStatus, { fill: string; dot: string; label: string }> = {
  booked: { fill: "var(--info-bg)", dot: "var(--info)", label: "Booked" },
  pending: { fill: "var(--warning-bg)", dot: "var(--warning)", label: "Pending" },
  maintenance: { fill: "var(--danger-bg)", dot: "var(--danger)", label: "Maintenance" },
  cancelled: { fill: "transparent", dot: "var(--fg-4)", label: "Cancelled" },
};

/** Which status wins a cell when several stays share the night. Cancelled is
 *  absent: those are filtered out before a cell is ever coloured. */
const PRIORITY: BookingStatus[] = ["maintenance", "pending", "booked"];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** Built from parts, never `.toISOString()` — that shifts a stay date a day. */
function dayISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `2026-08-10` → `10 Aug`. String-only, no Date, no timezone. */
function shortDay(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${SHORT_MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

/** A stay covers check_in through the night before check_out (half-open). */
function covers(event: CalendarEvent, iso: string): boolean {
  return event.check_in <= iso && iso < event.check_out;
}

type Cell = { iso: string; day: number; outside: boolean };

export function MonthGrid({
  anchor,
  events,
  resources,
  days,
  summary,
  monthLabel,
  stale,
  onPrev,
  onNext,
  today,
  selected,
  onSelect,
  onOpen,
}: {
  /** Any date in the month being shown. */
  anchor: string;
  events: CalendarEvent[];
  resources: CalendarResource[];
  days: CalendarDay[];
  summary: { revenue_label: string; booked_nights: number; occupancy_pct: number };
  monthLabel: string;
  /** The month changed and its data has not arrived. */
  stale: boolean;
  onPrev: () => void;
  onNext: () => void;
  today: string;
  selected: string;
  onSelect: (iso: string) => void;
  onOpen: (id: string) => void;
}) {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));

  const cells = useMemo<Cell[]>(() => {
    // UTC throughout: Date.UTC(y, m, 0) is the last day of month m, and
    // getUTCDay on a UTC-constructed date cannot drift across a timezone.
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

    const out: Cell[] = [];
    // Leading days from the previous month, shown greyed rather than blank.
    // An empty corner reads as "no data"; a dimmed 31 reads as "last month",
    // and the week rows keep their true shape.
    for (let i = firstWeekday; i > 0; i -= 1) {
      const day = prevMonthDays - i + 1;
      const m = month === 1 ? 12 : month - 1;
      const y = month === 1 ? year - 1 : year;
      out.push({ iso: dayISO(y, m, day), day, outside: true });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push({ iso: dayISO(year, month, d), day: d, outside: false });
    }
    // Trailing days to complete the final week.
    let next = 1;
    while (out.length % 7 !== 0) {
      const m = month === 12 ? 1 : month + 1;
      const y = month === 12 ? year + 1 : year;
      out.push({ iso: dayISO(y, m, next), day: next, outside: true });
      next += 1;
    }
    return out;
  }, [year, month]);

  /** One pass over the events rather than a filter per cell.
   *
   * Cancelled stays are dropped first. The feed returns them deliberately so
   * the desktop timeline can show a released date, but a cancelled booking
   * holds no nights — painting its dot and listing it under a day would
   * report a unit as taken when it is free. */
  const byDay = useMemo(() => {
    const live = events.filter((e) => e.status !== "cancelled");
    const map = new Map<string, CalendarEvent[]>();
    for (const cell of cells) {
      const hits = live.filter((e) => covers(e, cell.iso));
      if (hits.length) map.set(cell.iso, hits);
    }
    return map;
  }, [cells, events]);

  const dayStats = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const condo = useMemo(() => {
    const map = new Map(resources.map((r) => [r.id, r]));
    return (id: string) => map.get(id);
  }, [resources]);

  const agenda = byDay.get(selected) ?? [];
  const stats = dayStats.get(selected);
  const selectedDate = new Date(`${selected}T00:00:00Z`);
  const selectedMonth = Number(selected.slice(5, 7));

  return (
    <div className="mobile-only">
      {/* Month at a glance. The stepper lives here rather than in the toolbar:
          it changes what this card reports, so it belongs on it. */}
      <div className={`cal-summary${stale ? " is-stale" : ""}`}>
        <div className="cal-summary-head">
          <h2 className="cal-summary-month">{monthLabel}</h2>
          <div className="cal-summary-nav">
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={onPrev}>
              ‹
            </button>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={onNext}>
              ›
            </button>
          </div>
        </div>
        <div className="cal-figures">
          <Figure icon={<WalletIcon size={18} />} tone="purple" value={summary.revenue_label} label="Revenue" />
          <Figure icon={<CalendarIcon size={18} />} tone="blue" value={String(summary.booked_nights)} label="Nights" />
          <Figure icon={<ChartIcon size={18} />} tone="green" value={`${summary.occupancy_pct}%`} label="Occupancy" />
        </div>
      </div>

      <div className={`cal-grid-card${stale ? " is-stale" : ""}`}>
        <div className="cal-weekdays">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="cal-weekday" aria-hidden="true">
              {w}
            </div>
          ))}
        </div>

        <div
          className="cal-grid"
          role="grid"
          aria-label={`${MONTHS[month - 1]} ${year}`}
          aria-busy={stale}
        >
          {cells.map(({ iso, day, outside }) => {
            const hits = byDay.get(iso) ?? [];
            const top = PRIORITY.find((s) => hits.some((h) => h.status === s));
            const tone = top ? TONE[top] : null;
            const isToday = iso === today;
            const isSelected = iso === selected;

            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                onClick={() => onSelect(iso)}
                aria-pressed={isSelected}
                aria-label={`${day} ${MONTHS[Number(iso.slice(5, 7)) - 1]}, ${
                  hits.length === 0
                    ? "no stays"
                    : `${hits.length} stay${hits.length === 1 ? "" : "s"}`
                }`}
                className={`cal-day${outside ? " is-outside" : ""}${isToday ? " is-today" : ""}${
                  isSelected ? " is-selected" : ""
                }`}
                // Fill, not just a dot: at a glance the shape of the month's
                // occupancy is the thing you actually want to read.
                style={tone && !isSelected ? { background: tone.fill } : undefined}
              >
                <span className="cal-day-num">{day}</span>
                <span className="cal-dots">
                  {tone ? <span className="cal-dot" style={{ background: tone.dot }} /> : null}
                </span>
              </button>
            );
          })}
        </div>

        {/* Exactly the fills the grid paints. An "Available" green was shown
            for a colour no cell ever takes — free days are simply unfilled —
            and Maintenance was painting red with nothing to explain it. */}
        <div className="cal-legend">
          <LegendSwatch fill="var(--surface)" bd="var(--line-strong)" label="Available" />
          <LegendSwatch fill="var(--info-bg)" bd="var(--info-border)" label="Booked" />
          <LegendSwatch fill="var(--warning-bg)" bd="var(--warning-border)" label="Pending" />
          <LegendSwatch fill="var(--danger-bg)" bd="var(--danger-border)" label="Blocked" />
        </div>
      </div>

      {/* The tapped day, summarised before it is listed. */}
      <div className="cal-daycard">
        <span className="cal-daycard-icon">
          <CalendarIcon size={18} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="cal-daycard-title">
            {WEEKDAY_NAMES[selectedDate.getUTCDay()]} {selectedDate.getUTCDate()}{" "}
            {MONTHS[selectedMonth - 1]}
          </div>
          <div className="cal-daycard-sub">
            {stats
              ? `${plural(stats.bookings, "booking")} · ${stats.revenue_label} revenue · ${
                  stats.available
                } condo${stats.available === 1 ? "" : "s"} available`
              : "Outside this month"}
          </div>
        </div>
      </div>

      {agenda.length === 0 ? (
        <div className="cal-agenda">
          <div className="empty" style={{ padding: "28px 16px" }}>
            No stays on this day.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agenda.map((e) => {
            const unit = condo(e.condo_id);
            return (
              <button key={e.id} type="button" className="cal-stay" onClick={() => onOpen(e.id)}>
                <span className="cal-stay-photo">
                  {unit?.cover_url ? (
                    <Image src={unit.cover_url} alt="" fill sizes="88px" style={{ objectFit: "cover" }} />
                  ) : (
                    <span className="cal-stay-photo-empty">
                      <CalendarIcon size={18} />
                    </span>
                  )}
                </span>

                <span className="cal-stay-body">
                  <span className="cal-stay-name">{e.guest_name}</span>
                  <span className="cal-stay-sub">
                    {unit ? `${unit.code} · ${unit.name}` : ""}
                  </span>
                  <span className="cal-chips">
                    <span className="cal-chip">
                      <CalendarIcon size={13} />
                      {shortDay(e.check_in)} → {shortDay(e.check_out)} · {plural(e.nights, "night")}
                    </span>
                    <span className="cal-chip is-money">
                      <WalletIcon size={13} />
                      {e.total_label}
                    </span>
                  </span>
                </span>

                <span className="cal-stay-end">
                  <span className={PAY_META[e.payment_status].pill}>
                    {PAY_META[e.payment_status].label}
                  </span>
                  <ChevronRightIcon size={16} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function Figure({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: "purple" | "blue" | "green";
  value: string;
  label: string;
}) {
  return (
    <div className="cal-figure">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span className="cal-figure-value">{value}</span>
        <span className="cal-figure-label">{label}</span>
      </span>
    </div>
  );
}

function LegendSwatch({ fill, bd, label }: { fill: string; bd: string; label: string }) {
  return (
    <span className="cal-legend-item">
      <span className="cal-legend-swatch" style={{ background: fill, borderColor: bd }} />
      {label}
    </span>
  );
}
