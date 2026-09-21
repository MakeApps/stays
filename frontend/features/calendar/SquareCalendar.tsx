"use client";

import Image from "next/image";
import { useMemo } from "react";

import { CalendarIcon, ChartIcon, CondoIcon, WalletIcon } from "@/components/layout/icons";
import { MINOR_UNITS, addDays, nightsBetween, toMinor } from "@/lib/booking-math";
import type { BookingStatus, CalendarEvent, Condo } from "@/types/api";

/**
 * The square calendar: one listing, month after month, as a grid of day boxes
 * with each stay drawn as a pill across them. It is the layout of Airbnb's
 * host calendar, which is the one hosts already read without thinking.
 *
 * One condo at a time, as Airbnb's is one listing at a time. Nine condos'
 * stays stacked into one day box stops being a calendar; the timeline is the
 * view built for "all of them at once".
 *
 * Nothing here branches on viewport width. The same markup is the phone and
 * the desktop calendar, and CSS sizes the boxes and moves the listing panel —
 * branching in JS is a hydration mismatch and a visible reflow.
 */

/** Months drawn, starting at the anchor. Airbnb scrolls month after month;
 *  three keeps that feel while the stepper still moves one month at a time. */
export const SQUARE_MONTHS = 3;

/** Where a pill begins inside its check-in box and ends inside its checkout
 *  box, in columns. Taken off Airbnb's calendar: a stay starts just inside the
 *  arrival day and runs a little way into the departure day, so a checkout
 *  morning reads as a short stub rather than as a free night. */
const PILL_START = 0.08;
const PILL_END = 0.13;
/** On a same-day turnover the departing stay stops in the gap before the box
 *  instead of running underneath the arriving one. */
const PILL_END_TURNOVER = -0.02;

/** Past the edge of the row, to the edge of the card or the screen. A stay
 *  that carries on into the next week runs off the side, as Airbnb's do. */
const BLEED = "calc(-1 * var(--sq-bleed))";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_LABEL: Record<BookingStatus, string> = {
  booked: "booked",
  pending: "pending",
  maintenance: "blocked",
  cancelled: "cancelled",
};

/** Airbnb shows the guest's photo. We have a name, so the name picks a tone —
 *  the same guest is the same colour every time they appear. */
const AVATAR_TONES = [
  { bg: "#fde2e4", fg: "#9f1239" },
  { bg: "#e0e7ff", fg: "#3730a3" },
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#e0f2fe", fg: "#075985" },
  { bg: "#ede9fe", fg: "#5b21b6" },
] as const;

/** Built from parts, never `.toISOString()` — that shifts a stay date a day. */
function dayISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** First day of the month `delta` months after the one `iso` falls in. */
function addMonths(iso: string, delta: number): string {
  const index = Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1 + delta;
  return dayISO(Math.floor(index / 12), (index % 12) + 1, 1);
}

/** `2026-08-10` → `10 Aug`. String-only, no Date, no timezone. */
function shortDay(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${SHORT_MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Words that start with a letter or digit, so "Airbnb · Reserved" is AR. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/** `1400.00` → `฿1.4K`: a nightly rate that fits in a box a phone draws 48px
 *  wide, the way Airbnb abbreviates it. Built by hand rather than with Intl's
 *  compact notation so the server and the browser cannot render it apart. */
function compactBaht(rate: string): string | null {
  const baht = Math.round(toMinor(rate) / MINOR_UNITS);
  if (baht <= 0) return null;
  if (baht < 1000) return `฿${baht}`;
  const [value, unit] = baht < 1_000_000 ? [baht / 1000, "K"] : [baht / 1_000_000, "M"];
  return `฿${Math.round(value * 10) / 10}${unit}`;
}

function monthTitle(month: string, today: string): string {
  const name = MONTHS[Number(month.slice(5, 7)) - 1]!;
  // Airbnb drops the year while it is this year's. Past December a bare
  // "January" is ambiguous, so the year comes back.
  return month.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${month.slice(0, 4)}`;
}

type Week = {
  /** The Sunday the row begins on, which may belong to the previous month. */
  start: string;
  /** One entry per column; null where the day belongs to another month. */
  days: (string | null)[];
  /** Columns [first, last) hold this month's days. */
  first: number;
  last: number;
};

function monthWeeks(month: string): Week[] {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  // UTC throughout: getUTCDay on a UTC-built date cannot drift across a zone.
  const lead = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const weeks: Week[] = [];
  for (let offset = -lead; offset < length; offset += 7) {
    const days = Array.from({ length: 7 }, (_, col) => {
      const d = offset + col + 1;
      return d >= 1 && d <= length ? dayISO(year, m, d) : null;
    });
    const filled = days.map((d) => d !== null);
    weeks.push({
      start: addDays(month, offset),
      days,
      first: filled.indexOf(true),
      last: filled.lastIndexOf(true) + 1,
    });
  }
  return weeks;
}

/** Left edge of column position `u` (fractional) in a row of seven boxes
 *  separated by --sq-gap. One column's pitch is (row width + gap) / 7. */
const at = (u: number) => `(100% + var(--sq-gap)) * ${u} / 7`;

type Segment = {
  event: CalendarEvent;
  left: string;
  right: string;
  /** Continues from the previous row or month, so that end is square. */
  flatLeft: boolean;
  /** Continues into the next row or month. */
  flatRight: boolean;
  /** This stay's first piece in the month: the one a keyboard reaches. */
  lead: boolean;
  /** Carries the avatar and name. */
  labelled: boolean;
};

function weekSegments(
  week: Week,
  stays: CalendarEvent[],
  arrivals: Set<string>,
  seen: Set<string>,
): Segment[] {
  const out: Segment[] = [];
  for (const event of stays) {
    const from = nightsBetween(week.start, event.check_in) + PILL_START;
    const to =
      nightsBetween(week.start, event.check_out) +
      (arrivals.has(event.check_out) ? PILL_END_TURNOVER : PILL_END);
    const lo = Math.max(from, week.first);
    const hi = Math.min(to, week.last);
    if (hi <= lo) continue;

    const flatLeft = from < week.first;
    const flatRight = to > week.last;
    const lead = !seen.has(event.id);
    seen.add(event.id);

    let right: string;
    if (flatRight) {
      right = week.last === 7 ? BLEED : `calc(100% - (${at(week.last)} - var(--sq-gap)))`;
    } else if (to > week.last - 0.05) {
      // A turnover on the row's last day would end a hair past the last box,
      // out in the margin. Stop at the box's edge instead.
      right = `calc(100% - (${at(week.last)} - var(--sq-gap)))`;
    } else {
      right = `calc(100% - ${at(to)})`;
    }

    out.push({
      event,
      left: !flatLeft ? `calc(${at(from)})` : week.first === 0 ? BLEED : `calc(${at(week.first)})`,
      right,
      flatLeft,
      flatRight,
      lead,
      // A stub from last month's stay is too short to name; a long run of it
      // is not, or the month would open on a pill nobody can identify.
      labelled: lead && (!flatLeft || hi - lo >= 1.5),
    });
  }
  return out;
}

export function SquareCalendar({
  anchor,
  today,
  condo,
  events,
  allEvents,
  summary,
  monthLabel,
  stale,
  onPrev,
  onNext,
  onOpen,
}: {
  /** First day of the first month drawn. */
  anchor: string;
  today: string;
  /** The listing drawn. Undefined only when the organisation has no condos. */
  condo: Condo | undefined;
  /** Stays to draw, already narrowed by the status and guest filters. */
  events: CalendarEvent[];
  /** Every stay in the window, filtered or not. A night is priced only when
   *  nothing holds it, and a stay hidden by a filter still holds it. */
  allEvents: CalendarEvent[];
  summary: { revenue_label: string; booked_nights: number; occupancy_pct: number };
  monthLabel: string;
  /** The window changed and its data has not arrived. */
  stale: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpen: (id: string) => void;
}) {
  const condoId = condo?.id;
  const windowEnd = addMonths(anchor, SQUARE_MONTHS);

  const months = useMemo(
    () =>
      Array.from({ length: SQUARE_MONTHS }, (_, i) => {
        const month = addMonths(anchor, i);
        return { month, weeks: monthWeeks(month) };
      }),
    [anchor],
  );

  // Cancelled stays are dropped: the feed returns them so the timeline can
  // show a released date, but they hold no nights. The condo check guards the
  // moment between a switch and its data arriving.
  const stays = useMemo(
    () => events.filter((e) => e.condo_id === condoId && e.status !== "cancelled"),
    [events, condoId],
  );

  const arrivals = useMemo(() => new Set(stays.map((e) => e.check_in)), [stays]);

  const held = useMemo(() => {
    const nights = new Set<string>();
    for (const e of allEvents) {
      if (e.condo_id !== condoId || e.status === "cancelled") continue;
      const from = e.check_in > anchor ? e.check_in : anchor;
      const to = e.check_out < windowEnd ? e.check_out : windowEnd;
      for (let night = from; night < to; night = addDays(night, 1)) nights.add(night);
    }
    return nights;
  }, [allEvents, condoId, anchor, windowEnd]);

  if (!condo) {
    return (
      <div className="sq-empty">
        <div style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--fg)" }}>
          No condos yet
        </div>
        <div className="t-small" style={{ marginTop: 6 }}>
          Add a condo and its calendar appears here.
        </div>
      </div>
    );
  }

  const price = compactBaht(condo.night_rate);

  return (
    <div className="sq">
      {/* The listing, as the title of Airbnb's calendar names it. A column
          beside the months on a wide screen, a card above them on a phone. */}
      <aside className="sq-panel">
        <div className="sq-listing">
          <span className="sq-listing-photo">
            {condo.cover_url ? (
              <Image src={condo.cover_url} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
            ) : (
              <CondoIcon size={20} />
            )}
          </span>
          <span className="sq-listing-text">
            <span className="sq-listing-name">{condo.name}</span>
            <span className="sq-listing-sub">
              {condo.code}
              {price ? ` · ${condo.night_rate_label} / night` : ""}
            </span>
          </span>
          {/* The toolbar's stepper is desktop-only; on a phone it lives here,
              beside what it changes. */}
          <span className="sq-nav mobile-only">
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={onPrev}>
              ‹
            </button>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={onNext}>
              ›
            </button>
          </span>
        </div>

        <div className={`sq-figures desktop-only${stale ? " is-stale" : ""}`}>
          <div className="sq-figures-title t-eyebrow">{monthLabel}</div>
          <Figure icon={<WalletIcon size={16} />} tone="purple" label="Revenue" value={summary.revenue_label} />
          <Figure icon={<CalendarIcon size={16} />} tone="blue" label="Nights booked" value={String(summary.booked_nights)} />
          <Figure icon={<ChartIcon size={16} />} tone="green" label="Occupancy" value={`${summary.occupancy_pct}%`} />
        </div>

        <div className="sq-legend">
          <span className="sq-legend-item">
            <span className="sq-legend-pill is-booked" />
            Booked
          </span>
          <span className="sq-legend-item">
            <span className="sq-legend-pill is-pending" />
            Pending
          </span>
          <span className="sq-legend-item">
            <span className="sq-legend-pill is-maintenance" />
            Blocked
          </span>
          <span className="sq-legend-item">
            <span className="sq-legend-today" />
            Today
          </span>
        </div>
      </aside>

      <div className={`sq-months${stale ? " is-stale" : ""}`} aria-busy={stale}>
        <div className="sq-weekdays" aria-hidden="true">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>

        {months.map(({ month, weeks }) => {
          // Per month, so a stay crossing into it is named again at the top of
          // its new section rather than only in the month above.
          const seen = new Set<string>();
          return (
            <section key={month} className="sq-month" aria-label={`${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`}>
              <h2 className="sq-month-title">{monthTitle(month, today)}</h2>
              <div className="sq-weeks">
                {weeks.map((week) => (
                  <div key={week.start} className="sq-week">
                    {week.days.map((iso, col) => {
                      if (!iso) return <span key={col} className="sq-blank" aria-hidden="true" />;
                      const past = iso < today;
                      return (
                        <div
                          key={iso}
                          className={`sq-day${past ? " is-past" : ""}${iso === today ? " is-today" : ""}`}
                          aria-hidden="true"
                        >
                          <span className="sq-num">{Number(iso.slice(8, 10))}</span>
                          {/* Priced only when free and still sellable, as
                              Airbnb does: a held night has no price to show. */}
                          {price && !past && !held.has(iso) ? (
                            <span className="sq-price">{price}</span>
                          ) : null}
                        </div>
                      );
                    })}

                    <div className="sq-lane">
                      {weekSegments(week, stays, arrivals, seen).map((s) => {
                        const e = s.event;
                        const tone = toneFor(e.guest_name);
                        return (
                          <button
                            key={`${e.id}:${week.start}`}
                            type="button"
                            className={`sq-pill is-${e.status}${s.flatLeft ? " is-flat-l" : ""}${
                              s.flatRight ? " is-flat-r" : ""
                            }`}
                            style={{ left: s.left, right: s.right }}
                            onClick={() => onOpen(e.id)}
                            // One stop per stay per month. The pieces that
                            // carry it across weeks open the same booking
                            // on tap, but are not read out again.
                            tabIndex={s.lead ? 0 : -1}
                            aria-hidden={s.lead ? undefined : true}
                            aria-label={
                              s.lead
                                ? `${e.guest_name}, ${shortDay(e.check_in)} to ${shortDay(
                                    e.check_out,
                                  )}, ${plural(e.nights, "night")}, ${STATUS_LABEL[e.status]}`
                                : undefined
                            }
                            title={`${e.guest_name} · ${shortDay(e.check_in)} → ${shortDay(e.check_out)}`}
                          >
                            {s.labelled ? (
                              <>
                                <span className="sq-avatar" style={{ background: tone.bg, color: tone.fg }}>
                                  {initials(e.guest_name)}
                                </span>
                                <span className="sq-pill-name">{e.guest_name}</span>
                              </>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Figure({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "purple" | "blue" | "green";
  label: string;
  value: string;
}) {
  return (
    <div className="sq-figure">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <span className="sq-figure-label">{label}</span>
      <span className="sq-figure-value">{value}</span>
    </div>
  );
}
