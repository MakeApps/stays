import type { Metadata } from "next";
import Link from "next/link";

import { CondoIcon } from "@/components/layout/icons";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Placeholder until Phase 4, which builds the dashboard against real
 * aggregates. Shipping the designed layout now with fabricated numbers would
 * be worse than an honest placeholder.
 */
export default function DashboardPage() {
  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            Arrives in Phase 4, once bookings and expenses are producing real figures.
          </div>
        </div>
      </div>

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
          <CondoIcon size={28} />
        </div>
        <div className="t-h4">Start with your condos</div>
        <div className="t-small" style={{ margin: "8px auto 20px", maxWidth: 340 }}>
          Add your units once and every booking, calendar bar and income figure follows from them.
        </div>
        <Link className="btn btn-primary" href="/condos">
          Go to condos
        </Link>
      </div>
    </section>
  );
}
