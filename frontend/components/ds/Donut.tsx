/**
 * Donut chart — a single div, not a charting library.
 *
 * The approved design draws these with `conic-gradient` plus a
 * `radial-gradient` mask at 58%/59% (design line 2203). That hard mask edge is
 * not reproducible with Recharts' SVG arcs, and Recharts would add ~95 KB to
 * render something CSS already does exactly. Charting libraries earn their
 * place on the bar charts, not here.
 *
 * A div has no semantics, so the value table is exposed to assistive
 * technology alongside it.
 */
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  size = 112,
  hole = 0.58,
  segments,
  centerValue,
  centerLabel,
}: {
  size?: number;
  hole?: number;
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let cursor = 0;
  const stops = segments.map((segment) => {
    const from = cursor;
    const to = total > 0 ? cursor + (segment.value / total) * 100 : from;
    cursor = to;
    return `${segment.color} ${from}% ${to}%`;
  });

  const mask = `radial-gradient(circle at center, transparent ${hole * 100}%, #000 ${hole * 100 + 1}%)`;

  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <div
        role="img"
        aria-label={`${centerLabel}: ${centerValue}`}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background:
            total > 0 ? `conic-gradient(${stops.join(", ")})` : "var(--muted)",
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            font: `700 ${size > 110 ? 22 : 20}px/1 var(--font-sans)`,
            color: "var(--fg)",
            letterSpacing: "-.02em",
          }}
        >
          {centerValue}
        </div>
        <div className="t-caption" style={{ marginTop: 2 }}>
          {centerLabel}
        </div>
      </div>

      {/* The visual is a div; this is what a screen reader actually reads. */}
      <table
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        <caption>{centerLabel}</caption>
        <tbody>
          {segments.map((s) => (
            <tr key={s.label}>
              <th scope="row">{s.label}</th>
              <td>{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Paired revenue/expense bars — design lines 937–948. */
export function PairedBars({
  data,
  height = 200,
}: {
  data: { month: string; revenue: number; expenses: number; net: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.revenue, d.expenses]));
  const last = data.length - 1;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height, paddingTop: 8 }}>
      {data.map((d, i) => (
        <div
          key={d.month}
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 8,
            textAlign: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              font: "600 11px/1 var(--font-sans)",
              color: d.net >= 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {`฿${Math.round(d.net / 1000)}k`}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: "100%" }}>
            <div
              title={`Revenue ฿${d.revenue.toLocaleString("en-US")}`}
              style={{
                flex: 1,
                height: `${Math.max(3, Math.round((d.revenue / max) * 100))}%`,
                borderRadius: "6px 6px 3px 3px",
                background: i === last ? "var(--brand-purple)" : "var(--brand-purple-200)",
              }}
            />
            <div
              title={`Expenses ฿${d.expenses.toLocaleString("en-US")}`}
              style={{
                flex: 1,
                height: `${Math.max(3, Math.round((d.expenses / max) * 100))}%`,
                borderRadius: "6px 6px 3px 3px",
                background: i === last ? "var(--warning)" : "var(--warning-border)",
              }}
            />
          </div>
          <div style={{ font: "500 11px/1 var(--font-sans)", color: "var(--fg-3)" }}>
            {d.month}
          </div>
        </div>
      ))}
    </div>
  );
}
