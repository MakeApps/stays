"use client";

import Image from "next/image";

import { CalendarIcon, CondoIcon, EditIcon } from "@/components/layout/icons";
import { STATUS_META, specLine } from "@/features/condos/display";
import type { Condo } from "@/types/api";

/** Condo card — design lines 444–489. */
export function CondoCard({
  condo,
  onOpen,
  onEdit,
  onCalendar,
}: {
  condo: Condo;
  onOpen: () => void;
  onEdit: () => void;
  onCalendar: () => void;
}) {
  const meta = STATUS_META[condo.status];

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow 180ms var(--ease-out), transform 180ms var(--ease-out)",
      }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${condo.name}, ${meta.label}`}
    >
      <div style={{ position: "relative", height: 172, background: "var(--bg-alt)" }}>
        {condo.cover_url ? (
          <Image
            src={condo.cover_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "var(--fg-4)",
            }}
          >
            <CondoIcon size={28} />
          </div>
        )}

        <div style={{ position: "absolute", top: 12, left: 12, pointerEvents: "none" }}>
          <span
            className={meta.pill}
            style={{ background: "rgba(255,255,255,.92)", backdropFilter: "blur(8px)" }}
          >
            <span className="dot" />
            {meta.label}
          </span>
        </div>
        <div style={{ position: "absolute", top: 12, right: 12, pointerEvents: "none" }}>
          <span
            style={{
              display: "inline-flex",
              padding: "4px 9px",
              borderRadius: 6,
              background: "rgba(30,27,75,.62)",
              backdropFilter: "blur(6px)",
              font: "500 11px/1.3 var(--font-mono)",
              color: "#fff",
            }}
          >
            {condo.code}
          </span>
        </div>
      </div>

      <div style={{ padding: 18 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "600 16px/1.3 var(--font-sans)",
              color: "var(--fg)",
              letterSpacing: "-.01em",
            }}
          >
            {condo.name}
          </div>
          <div className="t-small" style={{ marginTop: 3 }}>
            {specLine(condo)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            margin: "16px 0",
            padding: "12px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div className="t-caption">Per night</div>
            <div style={{ font: "700 16px/1.2 var(--font-sans)", color: "var(--fg)", marginTop: 3 }}>
              {condo.night_rate_label}
            </div>
          </div>
          <div style={{ width: 1, background: "var(--line)" }} />
          <div style={{ flex: 1 }}>
            <div className="t-caption">Per month</div>
            <div style={{ font: "700 16px/1.2 var(--font-sans)", color: "var(--fg)", marginTop: 3 }}>
              {condo.month_rate_label}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={(event) => {
              event.stopPropagation();
              onCalendar();
            }}
          >
            <CalendarIcon />
            View calendar
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            <EditIcon />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

/** Loading skeleton — design lines 429–438. */
export function CondoCardSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="ls-shimmer" style={{ height: 168 }} />
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ width: "65%", height: 16, borderRadius: 6, background: "var(--muted)" }} />
        <div style={{ width: "40%", height: 11, borderRadius: 6, background: "var(--muted)" }} />
        <div
          style={{
            width: "100%",
            height: 38,
            borderRadius: 10,
            background: "var(--muted)",
            marginTop: 6,
          }}
        />
      </div>
    </div>
  );
}
