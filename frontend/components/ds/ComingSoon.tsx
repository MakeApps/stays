import Link from "next/link";

import { CondoIcon } from "@/components/layout/icons";

/**
 * Honest placeholder for a module that has not been built yet.
 *
 * Deliberately not a mock of the designed screen: rendering the real layout
 * with invented numbers would look finished and be misleading.
 */
export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            Scheduled for {phase}.
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
        <div className="t-h4">{title} arrives in {phase}</div>
        <div className="t-small" style={{ margin: "8px auto 20px", maxWidth: 380 }}>
          {description}
        </div>
        <Link className="btn btn-outline" href="/condos">
          Back to condos
        </Link>
      </div>
    </section>
  );
}
