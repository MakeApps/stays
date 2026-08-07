"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { BookingIcon, PlusIcon } from "@/components/layout/icons";
import { useCan } from "@/components/providers/Providers";
import { BookingDetailDrawer } from "@/features/bookings/BookingDetailDrawer";
import { useBookings } from "@/features/bookings/api";
import { ApiError } from "@/services/http";
import type { Booking, PaymentStatus } from "@/types/api";

/** Design lines 2008–2013 — payment status → pill tone. */
export const PAY_META: Record<PaymentStatus, { label: string; pill: string }> = {
  paid: { label: "Paid", pill: "pill ok" },
  partial: { label: "Partial", pill: "pill warn" },
  pending: { label: "Pending", pill: "pill neutral" },
  blocked: { label: "Blocked", pill: "pill dgr" },
};

const STATUS_FILTERS = ["all", "booked", "pending", "maintenance", "cancelled"] as const;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function BookingsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const can = useCan();

  const detailId = params.get("booking");
  const status = params.get("status") ?? "all";
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({ status, q: search || undefined, per_page: 50, sort: "check_in", order: "asc" as const }),
    [status, search],
  );
  const { data, isLoading, isError, error, refetch } = useBookings(filters);
  const bookings = data?.items ?? [];
  const detail = bookings.find((b) => b.id === detailId) ?? null;

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace((qs ? `/bookings?${qs}` : "/bookings") as never, { scroll: false });
    },
    [params, router],
  );

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            {data ? `${data.meta.total} bookings` : "Loading bookings…"}
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

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <select
          className="filter-sel"
          value={status}
          onChange={(e) => setParam({ status: e.target.value === "all" ? null : e.target.value })}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s[0]!.toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <div className="search-box" style={{ minWidth: 220, maxWidth: 320, flex: 1 }}>
          <input
            placeholder="Search guest name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search bookings"
          />
        </div>
      </div>

      {isError ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div className="t-h4">Could not load bookings</div>
          <div className="t-small" style={{ margin: "8px 0 16px" }}>
            {error instanceof ApiError ? error.message : "The API did not respond."}
          </div>
          <button className="btn btn-outline" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="table-card">
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="ls-shimmer" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState canWrite={can("booking:write")} />
      ) : (
        <>
          {/* Desktop table and mobile cards both render; CSS decides which is
              visible. Branching on window width in JS would be a hydration
              mismatch, which is what the prototype did. */}
          <div className="table-card desktop-only">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ minWidth: 720 }}>
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
                  {bookings.map((b) => (
                    <tr
                      key={b.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setParam({ booking: b.id })}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setParam({ booking: b.id });
                      }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="user-avatar" style={AVATAR}>
                            {initials(b.guest_name)}
                          </div>
                          <div>
                            <strong>{b.guest_name}</strong>
                            <div className="t-caption">{b.nights} nights</div>
                          </div>
                        </div>
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
          </div>

          <div
            className="mobile-only"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {bookings.map((b) => (
              <BookingCard key={b.id} booking={b} onOpen={() => setParam({ booking: b.id })} />
            ))}
          </div>
        </>
      )}

      <BookingDetailDrawer
        booking={detail}
        onClose={() => setParam({ booking: null })}
        onEdit={() => detail && router.push(`/bookings/new?edit=${detail.id}` as never)}
      />
    </section>
  );
}

const AVATAR: React.CSSProperties = {
  width: 32,
  height: 32,
  fontSize: 12,
  background: "var(--brand-purple-100)",
  color: "var(--brand-purple-700)",
};

/** Mobile card fallback — design lines 349–368. */
function BookingCard({ booking, onOpen }: { booking: Booking; onOpen: () => void }) {
  const pay = PAY_META[booking.payment_status];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        padding: 14,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--surface-2)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div className="user-avatar" style={AVATAR}>
          {initials(booking.guest_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--fg)" }}>
            {booking.guest_name}
          </div>
          <div className="t-caption" style={{ marginTop: 2 }}>
            {booking.condo_name}
          </div>
        </div>
        <span className={pay.pill}>{pay.label}</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--line)",
        }}
      >
        <span style={{ font: "500 13px/1 var(--font-sans)", color: "var(--fg-2)" }}>
          {dayLabel(booking.check_in)} → {dayLabel(booking.check_out)}
        </span>
        <strong style={{ font: "700 14px/1 var(--font-sans)", color: "var(--fg)" }}>
          {booking.total_label}
        </strong>
      </div>
    </div>
  );
}

/** Design lines 369–378. */
function EmptyState({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="card" style={{ padding: "72px 24px", textAlign: "center" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: "var(--brand-purple-50)",
          color: "var(--brand-purple)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <BookingIcon size={28} />
      </div>
      <div className="t-h4">No bookings yet</div>
      <div className="t-small" style={{ margin: "8px auto 20px", maxWidth: 320 }}>
        Take your first booking — it takes about 30 seconds.
      </div>
      {canWrite ? (
        <Link className="btn btn-primary" href="/bookings/new">
          New booking
        </Link>
      ) : null}
    </div>
  );
}
