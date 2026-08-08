"use client";

import Link from "next/link";

import { PAY_META } from "@/features/bookings/BookingsScreen";
import { useCondoFinance } from "@/features/condos/api";

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Bookings, expenses and profit for one condo.
 *
 * A client island inside the server-rendered detail page: the page's static
 * chrome streams immediately and only this waits on the rollup.
 */
export function CondoFinancePanels({ condoId }: { condoId: string }) {
  const { data, isLoading } = useCondoFinance(condoId);

  if (isLoading || !data) {
    return (
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="card ls-shimmer" style={{ flex: "2 1 460px", height: 260 }} />
        <div className="card ls-shimmer" style={{ flex: "1 1 300px", height: 260 }} />
      </div>
    );
  }

  const totalNights = data.booked_nights + data.available_nights;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Stat label="Revenue this month" value={data.revenue} />
        <Stat label="Expenses" value={data.expenses} tone="warning" />
        <Stat
          label="Net profit"
          value={data.net}
          tone={data.net_is_negative ? "danger" : "success"}
          emphasis
        />
        <Stat
          label="Occupancy"
          value={`${data.occupancy_pct}%`}
          sub={`${data.booked_nights} of ${totalNights} nights`}
        />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "2 1 460px", minWidth: 0 }}>
          <div className="card-head">
            <h3 className="card-title">Upcoming bookings</h3>
            <Link href="/calendar" style={{ font: "600 13px/1 var(--font-sans)" }}>
              Open calendar
            </Link>
          </div>
          {data.upcoming.length === 0 ? (
            <Empty>No stays booked ahead for this unit.</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {data.upcoming.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 0",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 13px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                      {b.guest_name}
                    </div>
                    <div className="t-caption" style={{ marginTop: 3 }}>
                      {dayLabel(b.check_in)} to {dayLabel(b.check_out)} · {b.nights} nights
                    </div>
                  </div>
                  <span className={PAY_META[b.payment_status].pill}>
                    {PAY_META[b.payment_status].label}
                  </span>
                  <strong style={{ font: "700 13px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                    {b.total_label}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div className="card-head">
            <h3 className="card-title">Recent expenses</h3>
            <Link href="/expenses" style={{ font: "600 13px/1 var(--font-sans)" }}>
              See all
            </Link>
          </div>
          {data.recent_expenses.length === 0 ? (
            <Empty>Nothing logged against this unit yet.</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {data.recent_expenses.map((e) => (
                <div
                  key={e.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0" }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        font: "600 13px/1.3 var(--font-sans)",
                        color: "var(--fg)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {e.description}
                    </div>
                    <div className="t-caption" style={{ marginTop: 3 }}>
                      {dayLabel(e.spent_on)} · {e.category}
                    </div>
                  </div>
                  <strong style={{ font: "700 13px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                    {e.amount_label}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warning" | "success" | "danger";
  emphasis?: boolean;
}) {
  const color =
    tone === "warning"
      ? "var(--warning)"
      : tone === "success"
        ? "var(--success)"
        : tone === "danger"
          ? "var(--danger)"
          : "var(--fg)";
  return (
    <div
      className="stat"
      style={emphasis ? { borderColor: "transparent", boxShadow: "var(--shadow-md)" } : undefined}
    >
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {sub ? <div className="t-caption">{sub}</div> : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "28px 20px",
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
