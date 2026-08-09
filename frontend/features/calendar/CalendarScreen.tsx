"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { PlusIcon } from "@/components/layout/icons";
import { useCan } from "@/components/providers/Providers";
import { BookingDetailDrawer } from "@/features/bookings/BookingDetailDrawer";
import { useBooking, useCalendar, useMoveBooking } from "@/features/bookings/api";
import { MonthGrid } from "@/features/calendar/MonthGrid";
import { Timeline, type DragChange } from "@/features/calendar/Timeline";
import { useCondos } from "@/features/condos/api";
import { addDays, nightsBetween, overlaps, todayISO } from "@/lib/booking-math";
import { qk } from "@/lib/query";
import { ApiError } from "@/services/http";

/** Weekday index (0 = Sunday) of an ISO date, computed in UTC. */
function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

const minISO = (a: string, b: string) => (a < b ? a : b);
const maxISO = (a: string, b: string) => (a > b ? a : b);

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(iso: string, delta: number): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(year, month, 1));
  return d.toISOString().slice(0, 10);
}

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CalendarScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const can = useCan();

  const today = todayISO();
  const [anchor, setAnchor] = useState(() => monthStart(today));
  const [view, setView] = useState<"month" | "week">("month");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const condoCode = params.get("condo");
  const detailId = params.get("booking");

  const { data: condoData } = useCondos({ per_page: 100, sort: "name" });
  const condos = useMemo(() => condoData?.items ?? [], [condoData]);
  const selectedCondo = condoCode ? condos.find((c) => c.code === condoCode) : undefined;

  // Week view starts a day before today so the current stay stays visible,
  // matching the design (line 2131).
  const start = view === "week" ? addDays(today, -1) : anchor;
  const days = view === "week" ? 7 : nightsBetween(anchor, shiftMonth(anchor, 1));
  const end = addDays(start, days);

  // The mobile grid draws the days either side of the month to complete its
  // weeks, so the fetch has to cover them. Rendering 31 Jul in an August grid
  // while only asking the server about August produces a cell that confidently
  // reports "no stays" — worse than the blank padding it replaced.
  // Unconditionally, not only in month view. `view` is desktop-only state with
  // no viewport coupling, so a session that picked Week and then narrowed to a
  // phone rendered a full month grid backed by a seven-day fetch — five weeks
  // of cells confidently reporting nothing. One extra month of rows is a
  // cheaper answer than a conditional that has to stay in step with a
  // breakpoint it cannot see.
  const gridStart = addDays(monthStart(anchor), -weekdayOf(monthStart(anchor)));
  const gridEnd = addDays(gridStart, 42);
  const fetchStart = minISO(start, gridStart);
  const fetchEnd = maxISO(end, gridEnd);

  // Reset per month rather than storing a day that is no longer on screen.
  const selectedDay =
    picked && picked.slice(0, 7) === anchor.slice(0, 7)
      ? picked
      : today.slice(0, 7) === anchor.slice(0, 7)
        ? today
        : anchor;

  const { data, isLoading, isPlaceholderData } = useCalendar(
    fetchStart,
    fetchEnd,
    selectedCondo?.id,
    anchor,
  );
  const calendarKey = qk.bookings.calendar({
    start: fetchStart,
    end: fetchEnd,
    condoId: selectedCondo?.id ?? null,
    month: anchor,
  });
  const move = useMoveBooking(calendarKey);
  const { data: detail } = useBooking(detailId);

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace((qs ? `/calendar?${qs}` : "/calendar") as never, { scroll: false });
    },
    [params, router],
  );

  const events = useMemo(() => {
    let list = data?.events ?? [];
    if (status !== "all") list = list.filter((e) => e.status === status);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) => e.guest_name.toLowerCase().includes(q));
    }
    return list;
  }, [data, status, search]);

  // The fetch now spans the whole drawn grid, which is wider than the window
  // the timeline draws. Anything the desktop view counts or filters by has to
  // use the narrower set, or a stay in the previous month keeps a row alive
  // that shows no bar.
  const windowEvents = useMemo(
    () => events.filter((e) => overlaps(e.check_in, e.check_out, start, end)),
    [events, start, end],
  );

  const resources = useMemo(() => {
    const all = data?.resources ?? [];
    // Hide rows that no longer have a matching bar, as the design does (2163).
    if (status === "all" && !search.trim()) return all;
    const withBars = new Set(windowEvents.map((e) => e.condo_id));
    return all.filter((r) => withBars.has(r.id));
  }, [data, windowEvents, status, search]);

  /** Tapping a greyed neighbouring day moves to its month and selects it.
   *
   * Without this the cell is tappable and does nothing: `selectedDay` rejects
   * a pick outside the anchor month, so the selection silently snapped back to
   * today. A dead control that looks live is worse than the blank padding
   * these cells replaced. */
  function selectDay(iso: string) {
    const month = `${iso.slice(0, 7)}-01`;
    if (month !== monthStart(anchor)) setAnchor(month);
    setPicked(iso);
  }

  async function onChange(change: DragChange) {
    try {
      await move.mutateAsync(change);
      toast.success("Booking moved", {
        description: `${change.check_in} → ${change.check_out}`,
      });
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        toast.error("Dates already booked", { description: error.message });
        return;
      }
      toast.error("Move failed", { description: "Put back where it was." });
    }
  }

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <div className="t-small desktop-only" style={{ marginTop: 6 }}>
            {view === "week"
              ? `Week of ${start} · ${plural(resources.length, "unit")}`
              : `${monthLabel(anchor)} · ${plural(resources.length, "unit")} · ${plural(
                  windowEvents.length,
                  "booking",
                )}`}
          </div>
        </div>
        {/* Desktop only. On mobile the same action is the floating button,
            which is thumb-reachable and does not scroll away — two identical
            primary actions on one screen is a defect, not a feature. */}
        {can("booking:write") ? (
          <div className="actions desktop-only">
            <Link className="btn btn-primary" href="/bookings/new">
              <PlusIcon size={17} />
              New booking
            </Link>
          </div>
        ) : null}
      </div>

      {/* Toolbar — design lines 754–786 */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        {/* Month vs week is a timeline distinction. The mobile view is always a
            month grid, so offering the choice there would be a control that
            changes nothing you can see. */}
        <div
          className="desktop-only"
          style={{
            display: "flex",
            background: "var(--surface)",
            border: "1px solid var(--line-strong)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              style={{
                padding: "8px 16px",
                border: 0,
                cursor: "pointer",
                font: "600 13px/1 var(--font-sans)",
                transition: "all 120ms",
                background: view === v ? "var(--brand-purple)" : "transparent",
                color: view === v ? "#fff" : "var(--fg-2)",
              }}
            >
              {v[0]!.toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <button
          className="btn btn-outline btn-sm cal-today"
          onClick={() => {
            setView("month");
            setAnchor(monthStart(today));
            setStatus("all");
            setSearch("");
          }}
        >
          Today
        </button>

        <div className="cal-monthnav desktop-only">
          <button
            className="icon-btn"
            aria-label="Previous month"
            onClick={() => setAnchor((a) => shiftMonth(a, -1))}
          >
            ‹
          </button>
          <div
            style={{
              font: "600 15px/1 var(--font-sans)",
              color: "var(--fg)",
              minWidth: 132,
              textAlign: "center",
              flex: 1,
            }}
          >
            {monthLabel(anchor)}
          </div>
          <button
            className="icon-btn"
            aria-label="Next month"
            onClick={() => setAnchor((a) => shiftMonth(a, 1))}
          >
            ›
          </button>
        </div>

        {/* Pushes the filters right on desktop. On mobile the month nav
            beside it is hidden, so the spacer becomes the first flex item,
            grows to fill the row and strands each control on its own line. */}
        <div className="desktop-only" style={{ flex: 1 }} />

        <select
          className="filter-sel cal-filter"
          value={condoCode ?? "all"}
          onChange={(e) => setParam({ condo: e.target.value === "all" ? null : e.target.value })}
          aria-label="Filter by condo"
        >
          <option value="all">All condos</option>
          {condos.map((c) => (
            <option key={c.id} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="filter-sel cal-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="booked">Booked</option>
          <option value="pending">Pending</option>
          <option value="maintenance">Maintenance</option>
        </select>

        <div className="search-box cal-search" style={{ minWidth: 200, padding: "7px 12px" }}>
          <input
            placeholder="Search guest"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search guest"
          />
        </div>
      </div>

      {isLoading && !data ? (
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="ls-shimmer" style={{ height: 48, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Both render; CSS picks one. Never window.innerWidth — that is a
              hydration mismatch and a visible reflow on first paint. */}
          <div className="desktop-only">
            <Timeline
              resources={resources}
              events={windowEvents}
              start={start}
              days={days}
              today={today}
              onOpen={(id) => setParam({ booking: id })}
              onChange={onChange}
              pendingId={move.isPending ? (move.variables?.id ?? null) : null}
            />
          </div>
          {/* Always `anchor`, never the week's month. The grid is a month
              view and `view` is a desktop-only concept, so pinning the grid to
              `monthStart(start)` while the heading and the summary both used
              `anchor` let them disagree — most visibly on the 1st of a month,
              when the week starts in the previous one. */}
          <MonthGrid
            anchor={anchor}
            events={events}
            resources={data?.resources ?? []}
            days={data?.days ?? []}
            summary={
              data?.summary ?? { revenue_label: "฿0", booked_nights: 0, occupancy_pct: 0 }
            }
            monthLabel={monthLabel(anchor)}
            // True while the newly-selected month is still in flight.
            // Without it the figures beside the label belong to the month
            // you just navigated away from.
            stale={isPlaceholderData}
            onPrev={() => setAnchor((a) => shiftMonth(a, -1))}
            onNext={() => setAnchor((a) => shiftMonth(a, 1))}
            today={today}
            selected={selectedDay}
            onSelect={selectDay}
            onOpen={(id) => setParam({ booking: id })}
          />
        </>
      )}

      {/* Legend — design lines 835–843. Desktop only: the mobile grid carries
          its own legend inside the calendar card, where it is read. */}
      <div
        className="desktop-only"
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 16,
          padding: "14px 18px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
        }}
      >
        <span className="t-eyebrow">Legend</span>
        <Swatch bg="var(--success-bg)" bd="var(--success-border)" label="Available" />
        <Swatch bg="var(--info-bg)" bd="var(--info-border)" label="Booked" />
        <Swatch bg="var(--warning-bg)" bd="var(--warning-border)" label="Pending" />
        <Swatch bg="var(--danger-bg)" bd="var(--danger-border)" label="Maintenance" />
        <div style={{ flex: 1 }} />
        <span className="t-caption desktop-only">
          Click a bar to open it · drag to move · drag an edge to resize
        </span>
        <span className="t-caption mobile-only">Tap a day to see its stays</span>
      </div>

      <BookingDetailDrawer
        booking={detail ?? null}
        onClose={() => setParam({ booking: null })}
        onEdit={() => detail && router.push(`/bookings/new?edit=${detail.id}` as never)}
      />
    </section>
  );
}

function Swatch({ bg, bd, label }: { bg: string; bd: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{ width: 14, height: 14, borderRadius: 4, background: bg, border: `1px solid ${bd}` }}
      />
      <span style={{ font: "500 13px/1 var(--font-sans)", color: "var(--fg-2)" }}>{label}</span>
    </div>
  );
}
