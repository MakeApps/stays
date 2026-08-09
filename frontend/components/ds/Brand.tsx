import Image from "next/image";

/**
 * LocalShouts Stays branding.
 *
 * The wordmark is the real asset, not a text recreation. Its two colours are
 * already the design system's — `#1E1B4B` and `#7C3AED` are `--brand-navy`
 * and `--brand-purple` exactly — but the letterforms are a grotesque, not
 * Inter: the double-storey `a` and the closed `S` apertures give it away.
 * Setting "LocalShouts" in the app's own font would land close enough to look
 * like a mistake rather than a decision.
 *
 * "Stays" is text, deliberately at a different size, weight and colour. That
 * reads as the product name following the company mark, so the typeface
 * difference is a level change rather than a mismatch.
 */

/** Intrinsic size of public/brand/localshouts.png. */
const LOGO = { width: 324, height: 47 } as const;

/**
 * The compact mark, for anywhere the wordmark cannot fit — the collapsed
 * sidebar rail is 64px wide, where the wordmark would be nine pixels tall.
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

/**
 * The LocalShouts wordmark, followed by the product name.
 *
 * `size` is the wordmark's rendered height; the width follows from the
 * asset's own ratio so it can never be stretched.
 */
export function BrandWordmark({ size = 17 }: { size?: number }) {
  const height = Math.round(size * 1.05);
  const width = Math.round((height * LOGO.width) / LOGO.height);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.4) }}>
      <Image
        src="/brand/localshouts.png"
        alt="LocalShouts"
        width={width}
        height={height}
        // Above the fold on every screen; letting it lazy-load flashes an
        // empty header on first paint.
        priority
        style={{ width, height, flex: "none" }}
      />
      <span
        style={{
          font: `600 ${Math.round(size * 0.92)}px/1 var(--font-sans)`,
          letterSpacing: "-.01em",
          color: "var(--fg-3)",
          whiteSpace: "nowrap",
        }}
      >
        Stays
      </span>
    </span>
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
