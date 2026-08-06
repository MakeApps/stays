/**
 * Design-system proof sheet.
 *
 * Renders every semantic class the approved design relies on, so the
 * Tailwind/DS integration can be checked at a glance rather than discovered to
 * be broken three screens in. Specifically it demonstrates:
 *
 *   - Preflight has NOT eaten .btn / .data-table / .page-header h1
 *     (proves `base` is ordered before `ds`)
 *   - a Tailwind utility overrides a DS class without !important
 *     (proves `utilities` is ordered after `ds`)
 *   - shadows and fonts survived the --ds-* alias hop
 *     (proves the @theme self-reference trap is avoided)
 *
 * Dev-only: excluded from the production build.
 */
import { notFound } from "next/navigation";

const PILLS = ["ok", "warn", "dgr", "info", "neutral", "brand"] as const;
const STAT_TONES = ["purple", "green", "amber", "blue", "red"] as const;

export default function DesignSystemProof() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="ls-base" style={{ minHeight: "100vh" }}>
      <main className="main" style={{ maxWidth: 1100 }}>
        <div className="page-header">
          <div>
            <h1>Design system</h1>
            <div className="t-small" style={{ marginTop: 6 }}>
              If anything below looks unstyled, the cascade layer order in
              globals.css is wrong.
            </div>
          </div>
          <div className="actions">
            <button className="btn btn-outline">Secondary</button>
            <button className="btn btn-primary">Primary</button>
          </div>
        </div>

        {/* ---- proof 1: Preflight did not flatten the DS ---- */}
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3 className="card-title">Buttons</h3>
            <span className="t-caption">Preflight would strip these to bare text</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-outline">Outline</button>
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn btn-primary btn-sm">Small</button>
            <button className="btn btn-primary" disabled>
              Disabled
            </button>
            <button className="icon-btn" aria-label="Icon action">
              +
            </button>
            <button className="icon-btn danger" aria-label="Delete">
              ×
            </button>
          </div>
        </section>

        {/* ---- proof 2: a Tailwind utility beats a DS class, no !important ---- */}
        <section style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div className="card" style={{ flex: "1 1 300px" }}>
            <div className="card-head">
              <h3 className="card-title">.card</h3>
            </div>
            <p className="t-body" style={{ margin: 0 }}>
              Default 20px padding from the design system.
            </p>
          </div>
          <div className="card p-0 overflow-hidden" style={{ flex: "1 1 300px" }}>
            <div className="bg-brand-50 px-5 py-4">
              <h3 className="card-title">.card + p-0</h3>
            </div>
            <p className="t-body px-5 pb-5" style={{ margin: 0 }}>
              Same class, padding removed by a utility. If this card still has
              20px of padding, <code>utilities</code> is not layered after{" "}
              <code>ds</code>.
            </p>
          </div>
        </section>

        {/* ---- stats ---- */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(186px,1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          {STAT_TONES.map((tone, i) => (
            <div className="stat" key={tone}>
              <div className={`stat-icon ${tone}`}>◆</div>
              <div className="stat-value">{["9", "6", "3", "฿48,200", "12"][i]}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div className="stat-label">{tone}</div>
                <span className="stat-delta up">+11%</span>
              </div>
            </div>
          ))}
        </section>

        {/* ---- pills ---- */}
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3 className="card-title">Pills</h3>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PILLS.map((tone) => (
              <span className={`pill ${tone}`} key={tone}>
                <span className="dot" />
                {tone}
              </span>
            ))}
          </div>
        </section>

        {/* ---- fields ---- */}
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3 className="card-title">Fields</h3>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 16,
            }}
          >
            <div className="field">
              <label htmlFor="ds-name">Condo name</label>
              <input id="ds-name" placeholder="e.g. Ashton Asoke 1204" />
              <small>Helper text uses .field small</small>
            </div>
            <div className="field">
              <label htmlFor="ds-type">Property type</label>
              <select id="ds-type" defaultValue="Condominium">
                <option>Condominium</option>
                <option>Serviced apartment</option>
                <option>Townhouse</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ds-bad">Error state</label>
              <input id="ds-bad" aria-invalid="true" defaultValue="!!bad!!" />
              <small className="error">That code is already taken.</small>
            </div>
            <div className="field">
              <label htmlFor="ds-filter">Filter select</label>
              <select id="ds-filter" className="filter-sel" defaultValue="all">
                <option value="all">All statuses</option>
                <option value="booked">Booked</option>
              </select>
            </div>
          </div>
        </section>

        {/* ---- table: Preflight resets border-collapse ---- */}
        <section className="table-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: "18px 20px 14px" }}>
            <h3 className="card-title">.data-table</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Condo</th>
                <th>Per night</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Ashton Asoke 1204</strong>
                  <div className="t-caption">A-1204</div>
                </td>
                <td>฿1,800</td>
                <td>
                  <span className="pill ok">
                    <span className="dot" />
                    Available
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Noble Ploenchit 2201</strong>
                  <div className="t-caption">N-2201</div>
                </td>
                <td>฿3,200</td>
                <td>
                  <span className="pill info">
                    <span className="dot" />
                    Occupied
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ---- typography + shadow proof ---- */}
        <section style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div className="card" style={{ flex: "1 1 320px" }}>
            <div className="card-head">
              <h3 className="card-title">Typography</h3>
            </div>
            <div className="t-h2" style={{ marginBottom: 6 }}>
              Heading two
            </div>
            <div className="t-body" style={{ marginBottom: 6 }}>
              Body copy at the DS base size of 14px.
            </div>
            <div className="t-mono" style={{ marginBottom: 6 }}>
              A-1204 · mono
            </div>
            <div className="t-eyebrow">Eyebrow label</div>
          </div>

          <div className="card" style={{ flex: "1 1 320px" }}>
            <div className="card-head">
              <h3 className="card-title">Shadows via --ds-* aliases</h3>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
                <div
                  key={size}
                  className={`shadow-${size} rounded-lg bg-surface`}
                  style={{
                    width: 74,
                    height: 56,
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid var(--line)",
                  }}
                >
                  <span className="t-caption">{size}</span>
                </div>
              ))}
            </div>
            <p className="t-small" style={{ marginTop: 12, marginBottom: 0 }}>
              Flat boxes here mean the @theme self-reference trap bit.
            </p>
          </div>
        </section>

        {/* ---- loaders ---- */}
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h3 className="card-title">Loaders &amp; skeletons</h3>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <span className="ls-ring ls-ring--md" />
            <span className="ls-dots">
              <span />
              <span />
              <span />
            </span>
            <div style={{ flex: "1 1 200px" }}>
              <div className="ls-bar" />
            </div>
            <div className="ls-shimmer" style={{ width: 140, height: 12, borderRadius: 6 }} />
          </div>
        </section>
      </main>
    </div>
  );
}
