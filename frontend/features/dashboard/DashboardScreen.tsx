"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Donut } from "@/components/ds/Donut";
import {
  BookingIcon,
  CalendarIcon,
  CondoIcon,
  DepositIcon,
  IncomeIcon,
  PlusIcon,
} from "@/components/layout/icons";
import { useCan } from "@/components/providers/Providers";
import { PAY_META } from "@/features/bookings/BookingsScreen";
import { useDashboard } from "@/features/dashboard/api";
import {
  DEPOSIT_META,
  LEASE_META,
  formatDay,
  leaseCountdown,
} from "@/features/condos/display";

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

const DOT: Record<string, string> = {
  green: "var(--success)",
  purple: "var(--brand-purple)",
  blue: "var(--info)",
  red: "var(--danger)",
};

/** Dashboard — design lines 134–404. */
export function DashboardScreen() {
  const { data, isLoading } = useDashboard();
  const can = useCan();
  const [hover, setHover] = useState<number | null>(null);
  const [showDeposits, setShowDeposits] = useState(false);

  const series = data?.income_by_day ?? [];
  const max = useMemo(
    () => Math.max(1, ...series.map((d) => Number(d.amount))),
    [series],
  );
  const todayIndex = series.findIndex((d) => d.is_today);
  const shown = series[hover ?? (todayIndex >= 0 ? todayIndex : 0)];

  if (isLoading || !data) {
    return (
      <section>
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
          </div>
        </div>
        <div style={{ ...GRID, marginBottom: 24 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="card ls-shimmer" style={{ height: 118 }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div className="card ls-shimmer" style={{ flex: "2 1 520px", height: 300 }} />
          <div className="card ls-shimmer" style={{ flex: "1 1 280px", height: 300 }} />
        </div>
      </section>
    );
  }

  const k = data.kpis;
  const heading = new Date(`${data.today}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            {heading} · {k.total_condos} units
          </div>
        </div>
        <div className="actions">
          {can("condo:write") ? (
            <Link className="btn btn-outline" href={{ pathname: "/condos", query: { new: "1" } } as never}>
              <PlusIcon />
              Add condo
            </Link>
          ) : null}
          {can("booking:write") ? (
            <Link className="btn btn-primary" href="/bookings/new">
              <PlusIcon />
              New booking
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ ...GRID, marginBottom: 24 }}>
        <Stat tone="purple" icon={<CondoIcon size={17} />} value={String(k.total_condos)} label="Total condos" delta="all units" />
        <Stat tone="blue" icon={<BookingIcon size={17} />} value={String(k.occupied)} label="Occupied today" delta={`${k.occupancy_pct}%`} />
        <Stat tone="green" icon={<CondoIcon size={17} />} value={String(k.vacant)} label="Vacant today" link={{ href: "/condos", label: "Fill them" }} />
        <Stat tone="purple" icon={<IncomeIcon size={17} />} value={k.revenue_today} label="Today's revenue" delta="accrued" />
        <Stat tone="green" icon={<IncomeIcon size={17} />} value={k.revenue_month} label="Month revenue" />
        <Stat tone="amber" icon={<CalendarIcon size={17} />} value={String(k.check_ins_7d)} label="Check-ins · 7 days" link={{ href: "/calendar", label: "View" }} />
        <Stat tone="amber" icon={<CalendarIcon size={17} />} value={String(k.check_outs_7d)} label="Check-outs · 7 days" link={{ href: "/calendar", label: "View" }} />
        {/* Capital, not earnings. Sits with the KPIs because it is a number
            worth knowing daily, but it is never a term in profit. */}
        <Stat
          tone="blue"
          icon={<DepositIcon size={17} />}
          value={k.deposits_held}
          label="Refundable deposits"
          delta={`${k.deposits_count} condo${k.deposits_count === 1 ? "" : "s"}`}
          onClick={() => setShowDeposits((open) => !open)}
        />
      </div>

      {showDeposits ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h3 className="card-title">Refundable deposits</h3>
              <div className="t-caption" style={{ marginTop: 4 }}>
                Total refundable security deposits currently held by property owners.
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDeposits(false)}>
              Hide
            </button>
          </div>
          {data.deposits.items.length === 0 ? (
            <div className="t-small">No deposits recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {data.deposits.items.map((d) => (
                <Link
                  key={d.id}
                  href={`/condos/${d.id}` as never}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--line)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, font: "600 13px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                    {d.name}
                  </span>
                  <span style={{ font: "700 13px/1 var(--font-sans)", color: "var(--fg)" }}>
                    {d.amount_label}
                  </span>
                  <span className={DEPOSIT_META[d.status].pill}>{DEPOSIT_META[d.status].label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {data.leases_expiring.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h3 className="card-title">Lease expiring soon</h3>
              <div className="t-caption" style={{ marginTop: 4 }}>
                Nothing is cancelled automatically — these are yours to decide on
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.leases_expiring.map((l) => (
              <Link
                key={l.id}
                href={`/condos/${l.id}` as never}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                  textDecoration: "none",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ flex: 1, minWidth: 140, font: "600 13px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                  {l.name}
                  <span className="t-caption" style={{ display: "block", marginTop: 2 }}>
                    {leaseCountdown(l.days_remaining)} · {formatDay(l.lease_end_date)}
                  </span>
                </span>
                <span className={LEASE_META[l.status].pill}>
                  <span className="dot" />
                  {LEASE_META[l.status].label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        {/* Income by day — plain divs, as the design draws them. */}
        <div className="card" style={{ flex: "2 1 560px", minWidth: 0 }}>
          <div className="card-head">
            <div>
              <h3 className="card-title">Income by day</h3>
              <div className="t-caption" style={{ marginTop: 4 }}>
                Accrued nightly, so a stay is spread across the nights it covers
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 120 }}>
              <div style={{ font: "700 15px/1.2 var(--font-sans)", color: "var(--fg)" }}>
                {shown?.label ?? "฿0"}
              </div>
              <div className="t-caption">{shown ? dayLabel(shown.date) : ""}</div>
            </div>
          </div>
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 180, paddingTop: 8 }}
            onMouseLeave={() => setHover(null)}
          >
            {series.map((d, i) => {
              const height = Math.max(2, Math.round((Number(d.amount) / max) * 100));
              const active = hover === i;
              return (
                <div
                  key={d.date}
                  onMouseEnter={() => setHover(i)}
                  title={`${dayLabel(d.date)} · ${d.label}`}
                  style={{
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      height: `${height}%`,
                      borderRadius: "5px 5px 3px 3px",
                      transition: "background 120ms",
                      background: active
                        ? "var(--brand-purple)"
                        : d.is_today
                          ? "var(--brand-purple-600)"
                          : "var(--brand-purple-200)",
                    }}
                  />
                  <div
                    style={{
                      font: "500 9px/1 var(--font-sans)",
                      textAlign: "center",
                      color: d.is_today ? "var(--brand-purple)" : "var(--fg-4)",
                    }}
                  >
                    {i % 5 === 0 || i === 0 ? new Date(`${d.date}T00:00:00Z`).getUTCDate() : ""}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 10,
              paddingTop: 12,
              borderTop: "1px solid var(--line)",
            }}
          >
            <Foot label="Avg / day" value={k.avg_per_day} />
            <Foot label="Best day" value={k.best_day_label} />
            <Foot label="Booked nights" value={String(k.booked_nights)} />
            <Foot label="Outstanding" value={k.outstanding} tone="warning" />
          </div>
        </div>

        <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div className="card-head">
            <h3 className="card-title">Occupancy today</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "6px 0 14px" }}>
            <Donut
              size={112}
              segments={[
                { label: "Occupied", value: data.occupancy.occupied, color: "var(--info)" },
                { label: "Vacant", value: data.occupancy.vacant, color: "var(--success)" },
                { label: "Maintenance", value: data.occupancy.maintenance, color: "var(--danger)" },
              ]}
              centerValue={`${k.occupancy_pct}%`}
              centerLabel="occupied"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 0 }}>
              <LegendRow color="var(--info)" label="Occupied" value={data.occupancy.occupied} />
              <LegendRow color="var(--success)" label="Vacant" value={data.occupancy.vacant} />
              <LegendRow color="var(--danger)" label="Maintenance" value={data.occupancy.maintenance} />
            </div>
          </div>
          <div style={{ padding: "12px 14px", background: "var(--brand-purple-50)", borderRadius: 12 }}>
            <div className="t-caption" style={{ color: "var(--brand-purple-700)" }}>
              This month
            </div>
            <div
              style={{
                font: "600 13px/1.5 var(--font-sans)",
                color: "var(--fg-2)",
                marginTop: 4,
              }}
            >
              {k.revenue_month} earned, {k.lease_month} in lease, {k.expenses_month} spent — net{" "}
              {k.net_month}.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="table-card" style={{ flex: "2 1 560px", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 20px 14px",
            }}
          >
            <div>
              <h3 className="card-title">Upcoming bookings</h3>
              <div className="t-caption" style={{ marginTop: 4 }}>
                Next check-ins, soonest first
              </div>
            </div>
            <Link href="/calendar" style={{ font: "600 13px/1 var(--font-sans)" }}>
              Open calendar →
            </Link>
          </div>

          {data.upcoming.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
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
                <CalendarIcon size={22} />
              </div>
              <div style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                Nothing booked ahead
              </div>
              <div className="t-small" style={{ margin: "6px 0 16px" }}>
                Take a booking — it takes about 30 seconds.
              </div>
              <Link className="btn btn-primary btn-sm" href="/bookings/new">
                New booking
              </Link>
            </div>
          ) : (
            <>
              <div className="desktop-only" style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Condo</th>
                      <th>Check-in</th>
                      <th>Check-out</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcoming.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.guest_name}</strong>
                          <div className="t-caption">{b.nights} nights</div>
                        </td>
                        <td>
                          {b.condo_name}
                          <div className="t-caption">{b.condo_code}</div>
                        </td>
                        <td>{dayLabel(b.check_in)}</td>
                        <td>{dayLabel(b.check_out)}</td>
                        <td style={{ textAlign: "right" }}>
                          <strong>{b.total_label}</strong>
                        </td>
                        <td>
                          <span className={PAY_META[b.payment_status].pill}>
                            {PAY_META[b.payment_status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                className="mobile-only"
                style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 16px" }}
              >
                {data.upcoming.map((b) => (
                  <div
                    key={b.id}
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
                          {b.guest_name}
                        </div>
                        <div className="t-caption" style={{ marginTop: 2 }}>
                          {b.condo_name}
                        </div>
                      </div>
                      <span className={PAY_META[b.payment_status].pill}>
                        {PAY_META[b.payment_status].label}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: "1px solid var(--line)",
                      }}
                    >
                      <span style={{ font: "500 13px/1 var(--font-sans)", color: "var(--fg-2)" }}>
                        {dayLabel(b.check_in)} → {dayLabel(b.check_out)}
                      </span>
                      <strong style={{ font: "700 14px/1 var(--font-sans)", color: "var(--fg)" }}>
                        {b.total_label}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div className="card-head">
            <h3 className="card-title">Recent activity</h3>
          </div>
          {data.activity.length === 0 ? (
            <div className="t-small" style={{ padding: "24px 0", textAlign: "center" }}>
              Nothing has happened yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {data.activity.map((a, i) => (
                <div key={a.id} style={{ display: "flex", gap: 12, padding: "10px 0" }}>
                  <div
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}
                  >
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 999,
                        marginTop: 5,
                        background: DOT[a.kind] ?? "var(--brand-purple)",
                      }}
                    />
                    {i < data.activity.length - 1 ? (
                      <div style={{ width: 1, flex: 1, background: "var(--line)", marginTop: 4 }} />
                    ) : null}
                  </div>
                  <div style={{ minWidth: 0, paddingBottom: 2 }}>
                    <div style={{ font: "600 13px/1.4 var(--font-sans)", color: "var(--fg)" }}>
                      {a.title}
                    </div>
                    {a.body ? (
                      <div className="t-small" style={{ marginTop: 2 }}>
                        {a.body}
                      </div>
                    ) : null}
                    <div className="t-caption" style={{ color: "var(--fg-4)", marginTop: 4 }}>
                      {relative(a.when)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(186px,1fr))",
  gap: 16,
};

function Stat({
  tone,
  icon,
  value,
  label,
  delta,
  link,
  onClick,
}: {
  tone: "purple" | "green" | "amber" | "blue" | "red";
  icon: React.ReactNode;
  value: string;
  label: string;
  delta?: string;
  link?: { href: string; label: string };
  onClick?: () => void;
}) {
  // A clickable stat is a real button, not a div with a handler: keyboard
  // reachable, announced as a control, and no bespoke key handling.
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className="stat"
      onClick={onClick}
      type={onClick ? "button" : undefined}
      style={
        onClick
          ? { cursor: "pointer", textAlign: "left", font: "inherit", width: "100%" }
          : undefined
      }
    >
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="stat-label">{label}</div>
        {delta ? <span className="stat-delta neutral">{delta}</span> : null}
        {link ? (
          <Link href={link.href as never} style={{ font: "600 12px/1 var(--font-sans)" }}>
            {link.label}
          </Link>
        ) : null}
      </div>
    </Tag>
  );
}

function Foot({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <div className="t-caption">{label}</div>
      <div
        style={{
          font: "600 14px/1.3 var(--font-sans)",
          color: tone === "warning" ? "var(--warning)" : "var(--fg)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flex: "none" }} />
      <span style={{ font: "500 13px/1 var(--font-sans)", color: "var(--fg-2)", flex: 1 }}>
        {label}
      </span>
      <strong style={{ font: "700 14px/1 var(--font-sans)", color: "var(--fg)" }}>{value}</strong>
    </div>
  );
}
