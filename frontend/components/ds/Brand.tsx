/**
 * The "Baan." wordmark and building glyph.
 *
 * Lifted from the approved design (Condo Manager.dc.html lines 34–38 for the
 * sidebar, 103–110 for the mobile topbar) — same 9px-radius purple tile, same
 * -0.02em tracking, same purple full stop.
 */
export function BrandGlyph({ size = 28 }: { size?: number }) {
  const icon = Math.round(size * 0.54);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size >= 28 ? 9 : 8,
        background: "var(--brand-purple)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: size >= 28 ? "var(--shadow-purple-soft)" : undefined,
        flex: "none",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={icon}
        height={icon}
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M9 7h2M9 11h2M9 15h2M15 11h4v10" />
      </svg>
    </div>
  );
}

export function BrandWordmark({ size = 17 }: { size?: number }) {
  return (
    <div
      style={{
        font: `700 ${size}px/1 var(--font-sans)`,
        letterSpacing: "-.02em",
        color: "var(--brand-navy)",
      }}
    >
      Baan<span style={{ color: "var(--brand-purple)" }}>.</span>
    </div>
  );
}

export function BrandLockup({ size = 28, text = 17 }: { size?: number; text?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <BrandGlyph size={size} />
      <BrandWordmark size={text} />
    </div>
  );
}
