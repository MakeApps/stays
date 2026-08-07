"use client";

import Link from "next/link";

import { Donut, PairedBars } from "@/components/ds/Donut";
import { IncomeIcon } from "@/components/layout/icons";
import { useIncomeSummary } from "@/features/expenses/api";

/** Income screen — design lines 847–1062. */
export function IncomeScreen() {
  const { data, isLoading } = useIncomeSummary();

  if (isLoading || !data) {
    return (
      <section>
        <div className="page-header">
          <div>
            <h1>Income</h1>
          </div>
        </div>
        <div style={GRID_STATS}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card ls-shimmer" style={{ height: 118 }} />
          ))}
        </div>
      </section>
    );
  }

  const k = data.kpis;
  const netNegative = k.net.includes("-");
  const totals = data.by_condo.reduce(
    (acc, r) => ({
      bookings: acc.bookings + r.bookings,
      nights: acc.nights + r.nights,
    }),
    { bookings: 0, nights: 0 },
  );

  const period = new Date(`${data.period.start}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Income</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            {period} · accrued by night, so a stay crossing a month splits between the two
          </div>
        </div>
        <div className="actions">
          <a className="btn btn-outline" href="/api/v1/dashboard/export?kind=income" download>
            Export CSV
          </a>
        </div>
      </div>

      <div style={{ ...GRID_STATS, marginBottom: 24 }}>
        <Stat tone="purple" label="Today's income" value={k.today} />
        <Stat tone="blue" label="This week" value={k.week} />
        <Stat tone="green" label="This month" value={k.month} />
        <Stat
          tone="red"
          label="Expenses"
          value={k.expenses}
          link={{ href: "/expenses", label: "Details" }}
        />
        <Stat
          tone="green"
          label="Net profit"
          value={k.net}
          delta={`${k.margin_pct}% margin`}
          emphasis
          negative={netNegative}
        />
        <Stat
          tone="amber"
          label="Outstanding balance"
          value={k.outstanding}
          delta={`${k.outstanding_count} ${k.outstanding_count === 1 ? "booking" : "bookings"}`}
        />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="card" style={{ flex: "2 1 520px", minWidth: 0 }}>
          <div className="card-head">
            <div>
              <h3 className="card-title">Revenue vs expenses</h3>
              <div className="t-caption" style={{ marginTop: 4 }}>
                Last six months · net printed above each pair
              </div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <Legend color="var(--brand-purple)" label="Revenue" />
              <Legend color="var(--warning)" label="Expenses" />
            </div>
          </div>
          <PairedBars
            data={data.trend.map((t) => ({
              month: t.month,
              revenue: Number(t.revenue),
              expenses: Number(t.expenses),
              net: Number(t.net),
            }))}
          />
        </div>

        <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div className="card-head">
            <h3 className="card-title">Where the money went</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "6px 0 16px" }}>
            <Donut
              size={104}
              segments={[
                { label: "Net profit", value: Math.max(0, Number(k.net.replace(/[^\d.-]/g, ""))), color: "var(--success)" },
                { label: "Expenses", value: Number(k.expenses.replace(/[^\d.-]/g, "")), color: "var(--warning)" },
              ]}
              centerValue={`${k.margin_pct}%`}
              centerLabel="margin"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <LegendRow color="var(--success)" label="Net profit" value={k.net} />
              <LegendRow color="var(--warning)" label="Expenses" value={k.expenses} />
              <LegendRow color="var(--brand-purple)" label="Revenue" value={k.month} strong />
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div style={{ padding: "18px 20px 14px" }}>
          <h3 className="card-title">Profit by condo</h3>
          <div className="t-caption" style={{ marginTop: 4 }}>
            {period} · revenue less recorded expenses
          </div>
        </div>

        {data.by_condo.length === 0 ? (
          <div className="empty" style={{ padding: "56px 20px" }}>
            <div style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--fg)" }}>
              Nothing to report yet
            </div>
            <div className="t-small" style={{ marginTop: 6 }}>
              Add a condo and take a booking, and the numbers appear here.
            </div>
          </div>
        ) : (
          <>
            <div className="desktop-only" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th>Condo</th>
                    <th style={{ textAlign: "right" }}>Bookings</th>
                    <th style={{ textAlign: "right" }}>Booked nights</th>
                    <th style={{ textAlign: "right" }}>Revenue</th>
                    <th style={{ textAlign: "right" }}>Expenses</th>
                    <th style={{ textAlign: "right" }}>Net profit</th>
                    <th style={{ textAlign: "right" }}>Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_condo.map((r) => (
                    <tr key={r.condo_id}>
                      <td>
                        <strong>{r.name}</strong>
                        <div className="t-caption">{r.code}</div>
                      </td>
                      <td style={{ textAlign: "right" }}>{r.bookings}</td>
                      <td style={{ textAlign: "right" }}>{r.nights}</td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{r.revenue_label}</strong>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--warning)" }}>
                        {r.expenses_label}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          style={{
                            font: "700 14px/1.4 var(--font-sans)",
                            color: Number(r.net) >= 0 ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {r.net_label}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={occupancyPill(r.occupancy_pct)}>{r.occupancy_pct}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td style={{ padding: "14px 16px", font: "700 14px/1 var(--font-sans)" }}>
                      Total
                    </td>
                    <td style={TOTAL_CELL}>{totals.bookings}</td>
                    <td style={TOTAL_CELL}>{totals.nights}</td>
                    <td style={TOTAL_CELL}>{k.month}</td>
                    <td style={{ ...TOTAL_CELL, color: "var(--warning)" }}>{k.expenses}</td>
                    <td style={{ ...TOTAL_CELL, color: "var(--success)" }}>{k.net}</td>
                    <td style={TOTAL_CELL} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div
              className="mobile-only"
              style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 16px" }}
            >
              {data.by_condo.map((r) => (
                <div
                  key={r.condo_id}
                  style={{
                    padding: 14,
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                        {r.name}
                      </div>
                      <div className="t-mono" style={{ fontSize: 11, marginTop: 2 }}>
                        {r.code}
                      </div>
                    </div>
                    <span className={occupancyPill(r.occupancy_pct)}>{r.occupancy_pct}%</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: "1px solid var(--line)",
                    }}
                  >
                    <Cell label="Revenue" value={r.revenue_label} />
                    <Cell label="Expenses" value={r.expenses_label} tone="warning" />
                    <Cell
                      label="Net profit"
                      value={r.net_label}
                      tone={Number(r.net) >= 0 ? "success" : "danger"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const GRID_STATS: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 16,
};

const TOTAL_CELL: React.CSSProperties = {
  textAlign: "right",
  font: "700 14px/1 var(--font-sans)",
  color: "var(--fg)",
};

/** Design line 2188 — occupancy bands. */
function occupancyPill(pct: number): string {
  return pct >= 70 ? "pill ok" : pct >= 40 ? "pill warn" : "pill neutral";
}

function Stat({
  tone,
  label,
  value,
  delta,
  link,
  emphasis,
  negative,
}: {
  tone: "purple" | "green" | "amber" | "blue" | "red";
  label: string;
  value: string;
  delta?: string;
  link?: { href: string; label: string };
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className="stat"
      style={emphasis ? { borderColor: "transparent", boxShadow: "var(--shadow-md)" } : undefined}
    >
      <div className={`stat-icon ${tone}`}>
        <IncomeIcon size={17} />
      </div>
      <div
        className="stat-value"
        style={emphasis ? { color: negative ? "var(--danger)" : "var(--success)" } : undefined}
      >
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="stat-label">{label}</div>
        {delta ? <span className="stat-delta up">{delta}</span> : null}
        {link ? (
          <Link href={link.href as never} style={{ font: "600 12px/1 var(--font-sans)" }}>
            {link.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        font: "500 12px/1 var(--font-sans)",
        color: "var(--fg-3)",
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      {label}
    </span>
  );
}

function LegendRow({
  color,
  label,
  value,
  strong,
}: {
  color: string;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flex: "none" }} />
      <span style={{ font: "500 13px/1 var(--font-sans)", color: "var(--fg-2)", flex: 1 }}>
        {label}
      </span>
      <strong
        style={{
          font: `${strong ? 700 : 600} 14px/1 var(--font-sans)`,
          color: "var(--fg)",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "success" | "danger";
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
    <div style={{ flex: 1 }}>
      <div className="t-caption">{label}</div>
      <div style={{ font: "700 14px/1.3 var(--font-sans)", color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
