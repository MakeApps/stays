import Image from "next/image";
import Link from "next/link";

import { CalendarIcon, CondoIcon, EditIcon } from "@/components/layout/icons";
import { STATUS_META, groupBaht, specLine } from "@/features/condos/display";
import type { Condo } from "@/types/api";

/**
 * Full condo page.
 *
 * Not in the approved design — the design has only the quick-view drawer — so
 * this is built from the same DS vocabulary. Bookings, expenses and the profit
 * rollup land in Phases 2 and 3; their panels are stated as pending rather
 * than shown as zeroes, which would read as "earned nothing".
 */
export function CondoDetailPage({ condo }: { condo: Condo }) {
  const meta = STATUS_META[condo.status];

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/condos" className="t-caption">
          ← Back to condos
        </Link>
      </div>

      <div className="page-header">
        <div>
          <span className={meta.pill}>
            <span className="dot" />
            {meta.label}
          </span>
          <h1 style={{ marginTop: 10 }}>{condo.name}</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            <span className="t-mono">{condo.code}</span> · {specLine(condo)}
            {condo.address ? ` · ${condo.address}` : ""}
          </div>
        </div>
        <div className="actions">
          <Link className="btn btn-outline" href={{ pathname: "/calendar", query: { condo: condo.code } } as never}>
            <CalendarIcon />
            Calendar
          </Link>
          <Link className="btn btn-primary" href={{ pathname: "/condos", query: { edit: condo.id } } as never}>
            <EditIcon />
            Edit condo
          </Link>
        </div>
      </div>

      {/* Gallery */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        {condo.images.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
              gap: 2,
              background: "var(--line)",
            }}
          >
            {condo.images.map((image) => (
              <div
                key={image.id}
                style={{ position: "relative", height: 190, background: "var(--bg-alt)" }}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 280px"
                  style={{ objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "var(--brand-purple-50)",
                color: "var(--brand-purple)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <CondoIcon size={22} />
            </div>
            <div style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--fg)" }}>
              No photos yet
            </div>
            <div className="t-small" style={{ margin: "6px 0 16px" }}>
              Guests decide from the first picture. Add a few from the edit screen.
            </div>
            <Link className="btn btn-primary btn-sm" href={{ pathname: "/condos", query: { edit: condo.id } } as never}>
              Add photos
            </Link>
          </div>
        )}
      </div>

      {/* Rates */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Stat label="Per night" value={condo.night_rate_label} tone="purple" />
        <Stat label="Per month" value={condo.month_rate_label} tone="blue" />
        <Stat label="Cleaning fee" value={`฿${groupBaht(condo.cleaning_fee)}`} tone="green" />
        <Stat label="Security deposit" value={`฿${groupBaht(condo.security_deposit)}`} tone="amber" />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "2 1 460px", minWidth: 0 }}>
          <div className="card-head">
            <h3 className="card-title">Bookings</h3>
          </div>
          <Pending>
            Bookings for this unit appear here once the booking module lands.
          </Pending>
        </div>

        <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div className="card-head">
            <h3 className="card-title">Profit</h3>
          </div>
          <Pending>
            Revenue less expenses, with occupancy and booked nights, once both modules exist.
          </Pending>
        </div>
      </div>

      {condo.description ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h3 className="card-title">Description</h3>
          </div>
          <p className="t-body" style={{ margin: 0 }}>
            {condo.description}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "purple" | "blue" | "green" | "amber";
}) {
  return (
    <div className="stat">
      <div className={`stat-icon ${tone}`}>
        <CondoIcon size={17} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Pending({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "32px 20px",
        textAlign: "center",
        border: "1px dashed var(--line-strong)",
        borderRadius: 12,
        background: "var(--surface-2)",
      }}
    >
      <div className="t-small">{children}</div>
    </div>
  );
}

