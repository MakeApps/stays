"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { PlusIcon } from "@/components/layout/icons";
import { useCan } from "@/components/providers/Providers";
import { BookingDetailDrawer } from "@/features/bookings/BookingDetailDrawer";
import { useBooking, useCalendar, useMoveBooking } from "@/features/bookings/api";
import { Timeline, type DragChange } from "@/features/calendar/Timeline";
import { useCondos } from "@/features/condos/api";
import { addDays, nightsBetween, todayISO } from "@/lib/booking-math";
import { qk } from "@/lib/query";
import { ApiError } from "@/services/http";

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

  const { data, isLoading } = useCalendar(start, end, selectedCondo?.id);
  const calendarKey = qk.bookings.calendar({
    start,
    end,
    condoId: selectedCondo?.id ?? null,
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

  const resources = useMemo(() => {
    const all = data?.resources ?? [];
    // Hide rows that no longer have a matching bar, as the design does (2163).
    if (status === "all" && !search.trim()) return all;
    const withBars = new Set(events.map((e) => e.condo_id));
    return all.filter((r) => withBars.has(r.id));
  }, [data, events, status, search]);

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
          <div className="t-small" style={{ marginTop: 6 }}>
            {view === "week"
              ? `Week of ${start} · ${resources.length} units`
              : `${monthLabel(anchor)} · ${resources.length} units · ${events.length} bookings`}
          </div>
        </div>
        {can("booking:write") ? (
          <div className="actions">
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
        <div
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
          className="btn btn-outline btn-sm"
          onClick={() => {
            setView("month");
            setAnchor(monthStart(today));
            setStatus("all");
            setSearch("");
          }}
        >
          Today
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
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

        <div style={{ flex: 1 }} />

        <select
          className="filter-sel"
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
          className="filter-sel"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="booked">Booked</option>
          <option value="pending">Pending</option>
          <option value="maintenance">Maintenance</option>
        </select>

        <div className="search-box" style={{ minWidth: 200, padding: "7px 12px" }}>
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
        <Timeline
          resources={resources}
          events={events}
          start={start}
          days={days}
          today={today}
          onOpen={(id) => setParam({ booking: id })}
          onChange={onChange}
          pendingId={move.isPending ? (move.variables?.id ?? null) : null}
        />
      )}

      {/* Legend — design lines 835–843 */}
      <div
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
        <span className="t-caption">
          Click a bar to open it · drag to move · drag an edge to resize
        </span>
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
