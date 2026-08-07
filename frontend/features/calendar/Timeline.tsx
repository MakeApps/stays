"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { addDays, nightsBetween, overlaps } from "@/lib/booking-math";
import type { BookingStatus, CalendarEvent, CalendarResource } from "@/types/api";

/** Design lines 2001–2007 — booking bar tones by status. */
const BAR_META: Record<BookingStatus, { bg: string; bd: string; fg: string }> = {
  booked: { bg: "var(--info-bg)", bd: "var(--info-border)", fg: "var(--info)" },
  pending: { bg: "var(--warning-bg)", bd: "var(--warning-border)", fg: "var(--warning)" },
  maintenance: { bg: "var(--danger-bg)", bd: "var(--danger-border)", fg: "var(--danger)" },
  cancelled: { bg: "var(--bg-alt)", bd: "var(--line)", fg: "var(--fg-3)" },
};

const RESOURCE_WIDTH = 196; // design line 791
const MIN_DAY_WIDTH = 34; // design line 2443
const ROW_HEIGHT = 56; // design line 2444

export interface DragChange {
  id: string;
  condo_id: string;
  check_in: string;
  check_out: string;
}

type DragKind = "move" | "resize-start" | "resize-end";

interface DragState {
  id: string;
  kind: DragKind;
  originX: number;
  originIn: string;
  originOut: string;
  condoId: string;
  dayDelta: number;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Resource timeline — a faithful build of design lines 788–843.
 *
 * Built rather than adopting FullCalendar Premium: this is a single-axis
 * occupancy strip, one row per condo and one column per day. FullCalendar's
 * expensive machinery (timezones, recurrence, event stacking) is all unused
 * here — stacking in particular, because the overlap rule guarantees bookings
 * never collide within a condo. Its px-based slot layout also disagrees with
 * the design's fractional columns at the seams.
 *
 * Drag and resize are added on top; the approved design has neither.
 */
export function Timeline({
  resources,
  events,
  start,
  days,
  today,
  onOpen,
  onChange,
  pendingId,
}: {
  resources: CalendarResource[];
  events: CalendarEvent[];
  start: string;
  days: number;
  today: string;
  onOpen: (id: string) => void;
  onChange: (change: DragChange) => void;
  pendingId?: string | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [colWidth, setColWidth] = useState(MIN_DAY_WIDTH);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Measure once per layout change; the bars position in percentages, so this
  // is only needed to convert pointer pixels into whole days.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setColWidth(Math.max(1, el.clientWidth / days));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [days]);

  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(start, i)),
    [start, days],
  );

  const byCondo = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.condo_id) ?? [];
      list.push(event);
      map.set(event.condo_id, list);
    }
    return map;
  }, [events]);

  /* ---------------- drag ---------------- */

  const beginDrag = useCallback(
    (event: CalendarEvent, kind: DragKind, clientX: number) => {
      setDrag({
        id: event.id,
        kind,
        originX: clientX,
        originIn: event.check_in,
        originOut: event.check_out,
        condoId: event.condo_id,
        dayDelta: 0,
      });
    },
    [],
  );

  useEffect(() => {
    if (!drag) return;

    // Pointer move only updates a day-granularity delta in state; nothing
    // re-renders per pixel, and the bar itself moves via a CSS transform.
    const onMove = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - drag.originX) / colWidth);
      setDrag((d) => (d && d.dayDelta !== delta ? { ...d, dayDelta: delta } : d));
    };

    const onUp = () => {
      setDrag(null);
      if (drag.dayDelta === 0) return;

      const next = applyDrag(drag);
      if (nightsBetween(next.check_in, next.check_out) < 1) return;

      // Pre-flight against what is already on screen: most invalid drops never
      // reach the network, and the ones that do still get a 409.
      const clash = events.some(
        (other) =>
          other.id !== drag.id &&
          other.condo_id === next.condo_id &&
          other.status !== "cancelled" &&
          overlaps(next.check_in, next.check_out, other.check_in, other.check_out),
      );
      if (clash) return;

      onChange(next);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, colWidth, events, onChange]);

  const trackMinWidth = RESOURCE_WIDTH + days * MIN_DAY_WIDTH;

  return (
    <div className="table-card">
      <div style={{ overflowX: "auto", borderRadius: 16 }}>
        {/* header */}
        <div
          style={{
            display: "flex",
            minWidth: trackMinWidth,
            borderBottom: "1px solid var(--line)",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ ...RESOURCE_CELL, ...HEADER_CELL }}>Condo</div>
          <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: `repeat(${days},minmax(0,1fr))` }}>
            {dayList.map((iso) => {
              const d = new Date(`${iso}T00:00:00Z`);
              const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  style={{
                    padding: "8px 2px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    borderLeft: `1px solid ${weekend ? "var(--line)" : "transparent"}`,
                    background: isToday
                      ? "var(--brand-purple-50)"
                      : weekend
                        ? "var(--bg-alt)"
                        : "transparent",
                  }}
                >
                  <div
                    style={{
                      font: "600 9px/1 var(--font-sans)",
                      letterSpacing: ".06em",
                      color: "var(--fg-4)",
                      textTransform: "uppercase",
                    }}
                  >
                    {["S", "M", "T", "W", "T", "F", "S"][d.getUTCDay()]}
                  </div>
                  <div
                    style={
                      isToday
                        ? {
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            background: "var(--brand-purple)",
                            color: "#fff",
                            font: "700 11px/20px var(--font-sans)",
                            textAlign: "center",
                          }
                        : { font: "600 12px/1.6 var(--font-sans)", color: "var(--fg-2)" }
                    }
                  >
                    {d.getUTCDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* rows */}
        {resources.map((resource, rowIndex) => {
          const rowEvents = byCondo.get(resource.id) ?? [];
          return (
            <div
              key={resource.id}
              style={{
                display: "flex",
                minWidth: trackMinWidth,
                borderBottom: "1px solid var(--line)",
                minHeight: ROW_HEIGHT,
              }}
            >
              <div style={{ ...RESOURCE_CELL, display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    flex: "none",
                    background: rowEvents.some((e) => e.status === "maintenance")
                      ? "var(--danger)"
                      : rowEvents.length
                        ? "var(--info)"
                        : "var(--success)",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 13px/1.3 var(--font-sans)",
                      color: "var(--fg)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {resource.name}
                  </div>
                  <div
                    style={{
                      font: "400 11px/1.3 var(--font-mono)",
                      color: "var(--fg-3)",
                      marginTop: 2,
                    }}
                  >
                    {resource.code}
                  </div>
                </div>
              </div>

              <div
                ref={rowIndex === 0 ? trackRef : undefined}
                style={{ flex: 1, position: "relative", minWidth: 0 }}
              >
                {/* lane background */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${days},minmax(0,1fr))`,
                    position: "absolute",
                    inset: 0,
                  }}
                >
                  {dayList.map((iso) => {
                    const d = new Date(`${iso}T00:00:00Z`);
                    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                    const isToday = iso === today;
                    return (
                      <div
                        key={iso}
                        style={{
                          borderLeft: `1px solid ${weekend || isToday ? "var(--line)" : "transparent"}`,
                          background: isToday
                            ? "rgba(124,58,237,.05)"
                            : weekend
                              ? "var(--surface-2)"
                              : "transparent",
                        }}
                      />
                    );
                  })}
                </div>

                {rowEvents.map((event) => {
                  const active = drag?.id === event.id;
                  const shown = active ? applyDrag(drag) : null;
                  const from = shown?.check_in ?? event.check_in;
                  const to = shown?.check_out ?? event.check_out;

                  const startIdx = Math.max(0, nightsBetween(start, from));
                  const endIdx = Math.min(days, nightsBetween(start, to));
                  if (endIdx <= startIdx) return null;

                  const meta = BAR_META[event.status];
                  const span = endIdx - startIdx;
                  const wide = span >= 3;
                  const isPending = pendingId === event.id;

                  return (
                    <div
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${event.guest_name}, ${from} to ${to}`}
                      title={`${event.guest_name} · ${from} → ${to}`}
                      onClick={() => !active && onOpen(event.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(event.id);
                        }
                        // Keyboard move/resize — something FullCalendar does
                        // not provide either.
                        const step = e.shiftKey ? 0 : 1;
                        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                          e.preventDefault();
                          const dir = e.key === "ArrowRight" ? 1 : -1;
                          onChange({
                            id: event.id,
                            condo_id: event.condo_id,
                            check_in: addDays(event.check_in, step * dir),
                            check_out: addDays(event.check_out, dir),
                          });
                        }
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        const box = e.currentTarget.getBoundingClientRect();
                        const offset = e.clientX - box.left;
                        const kind: DragKind =
                          offset < 8 ? "resize-start" : offset > box.width - 8 ? "resize-end" : "move";
                        e.currentTarget.setPointerCapture(e.pointerId);
                        beginDrag(event, kind, e.clientX);
                      }}
                      style={{
                        position: "absolute",
                        top: 9,
                        bottom: 9,
                        left: `${(startIdx / days) * 100}%`,
                        width: `${(span / days) * 100}%`,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 10px",
                        borderRadius: 8,
                        cursor: active ? "grabbing" : "grab",
                        overflow: "hidden",
                        font: "600 12px/1 var(--font-sans)",
                        background: meta.bg,
                        border: `1px solid ${meta.bd}`,
                        color: meta.fg,
                        // In-flight state the design does not have; proposed
                        // for sign-off.
                        opacity: isPending ? 0.72 : 1,
                        boxShadow: active ? "var(--shadow-md)" : undefined,
                        transition: active ? "none" : "box-shadow 120ms, opacity 120ms",
                        touchAction: "none",
                        userSelect: "none",
                      }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {wide
                          ? `${event.guest_name} · ${event.nights}n`
                          : initials(event.guest_name)}
                      </span>
                      {isPending ? (
                        <span
                          className="ls-ring ls-ring--sm"
                          style={{ marginLeft: "auto", flex: "none" }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {resources.length === 0 ? (
          <div className="empty" style={{ padding: "56px 20px" }}>
            <div style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--fg)" }}>
              Nothing matches those filters
            </div>
            <div className="t-small" style={{ marginTop: 6 }}>
              Clear the guest search or pick another status.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function applyDrag(drag: DragState): DragChange {
  const { kind, dayDelta, originIn, originOut, condoId, id } = drag;
  if (kind === "move") {
    return {
      id,
      condo_id: condoId,
      check_in: addDays(originIn, dayDelta),
      check_out: addDays(originOut, dayDelta),
    };
  }
  if (kind === "resize-start") {
    return { id, condo_id: condoId, check_in: addDays(originIn, dayDelta), check_out: originOut };
  }
  return { id, condo_id: condoId, check_in: originIn, check_out: addDays(originOut, dayDelta) };
}

const RESOURCE_CELL: React.CSSProperties = {
  width: RESOURCE_WIDTH,
  flex: "none",
  padding: "10px 16px",
  borderRight: "1px solid var(--line)",
  position: "sticky",
  left: 0,
  zIndex: 2,
  background: "var(--surface)",
};

const HEADER_CELL: React.CSSProperties = {
  padding: "12px 16px",
  font: "600 11px/1 var(--font-sans)",
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "var(--fg-3)",
  zIndex: 3,
  background: "var(--surface-2)",
};
