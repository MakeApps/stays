"use client";

import { useState } from "react";

import { CalendarIcon } from "@/components/layout/icons";
import { DepositRefundModal } from "@/features/condos/DepositRefundModal";
import {
  DEPOSIT_META,
  LEASE_META,
  formatDay,
  leaseCountdown,
} from "@/features/condos/display";
import type { Condo } from "@/types/api";

/**
 * Lease & investment — the commitment behind a unit, and the capital it ties up.
 *
 * Deliberately its own card, set apart from revenue, expenses and profit. The
 * deposit shown here is *not* money the business has spent; it is money the
 * business is owed back. Sitting it inside the finance panels would invite
 * exactly the reading the whole feature exists to prevent.
 */
export function LeaseCard({ condo }: { condo: Condo }) {
  const [refunding, setRefunding] = useState(false);
  const lease = LEASE_META[condo.lease_status];
  const deposit = DEPOSIT_META[condo.deposit_status];
  const countdown = leaseCountdown(condo.lease_days_remaining);
  const hasLease = condo.lease_status !== "none";
  const outstanding = Number(condo.deposit_outstanding) > 0;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <h3 className="card-title">Lease &amp; investment</h3>
        {hasLease ? (
          <span className={lease.pill}>
            <span className="dot" />
            {lease.label}
          </span>
        ) : null}
      </div>

      {hasLease || Number(condo.security_deposit) > 0 ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              gap: 16,
            }}
          >
            <Cell label="Lease start" value={formatDay(condo.lease_start_date)} />
            <Cell label="Lease end" value={formatDay(condo.lease_end_date)} />
            <Cell label="Monthly lease" value={condo.monthly_lease_label} />
            <Cell label="Security deposit" value={condo.security_deposit_label} />
            <Cell
              label="Deposit status"
              value={
                <span className={deposit.pill} style={{ marginTop: 2 }}>
                  {deposit.label}
                </span>
              }
            />
          </div>

          {countdown ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 16,
                padding: "10px 12px",
                borderRadius: 10,
                background:
                  condo.lease_status === "expired"
                    ? "var(--danger-bg)"
                    : condo.lease_status === "expiring_soon"
                      ? "var(--warning-bg)"
                      : "var(--surface-2)",
                color: lease.color,
                font: "600 13px/1.3 var(--font-sans)",
              }}
            >
              <CalendarIcon size={15} />
              {condo.lease_status === "expired"
                ? `Lease expired on ${formatDay(condo.lease_end_date)} · ${countdown}`
                : `Lease expires in ${countdown.replace(" remaining", "")} · ${formatDay(condo.lease_end_date)}`}
            </div>
          ) : null}

          {/* The headline number: capital, stated as capital. */}
          {outstanding ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "700 18px/1.2 var(--font-sans)", color: "var(--fg)" }}>
                  {condo.deposit_outstanding_label} capital currently held
                </div>
                <div className="t-caption" style={{ marginTop: 3 }}>
                  Refundable deposit paid to the property owner. This is not an operating
                  expense and is excluded from profit.
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setRefunding(true)}>
                Mark deposit as refunded
              </button>
            </div>
          ) : Number(condo.security_deposit) > 0 ? (
            <div className="t-caption" style={{ marginTop: 12 }}>
              {condo.security_deposit_label} deposit fully settled —{" "}
              {condo.deposit_refunded !== "0.00" ? `฿${Number(condo.deposit_refunded).toLocaleString("en-US")} recovered` : "nothing recovered"}
              {Number(condo.deposit_deducted) > 0
                ? `, ฿${Number(condo.deposit_deducted).toLocaleString("en-US")} withheld.`
                : "."}
            </div>
          ) : null}
        </>
      ) : (
        <div className="t-small" style={{ margin: 0 }}>
          No lease recorded. Add the term and monthly amount from the edit screen so this
          unit&rsquo;s profit accounts for what it costs to hold.
        </div>
      )}

      <DepositRefundModal
        condo={condo}
        open={refunding}
        onClose={() => setRefunding(false)}
      />
    </div>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="t-caption">{label}</div>
      <div
        style={{
          font: "600 15px/1.3 var(--font-sans)",
          color: "var(--fg)",
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}
