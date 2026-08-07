import type { Condo, UnitStatus } from "@/types/api";

/**
 * Presentation helpers shared by server and client components.
 *
 * Deliberately NOT in a "use client" module. Everything exported from a
 * client module becomes a client *reference* when a Server Component imports
 * it, so `STATUS_META[status]` would silently evaluate to undefined on the
 * server — which is exactly how the condo detail page first blew up.
 */

/** Design lines 1993–1999 — status → pill class and dot colour. */
export const STATUS_META: Record<UnitStatus, { label: string; pill: string; color: string }> = {
  available: { label: "Available", pill: "pill ok", color: "var(--success)" },
  occupied: { label: "Occupied", pill: "pill info", color: "var(--info)" },
  reserved: { label: "Reserved", pill: "pill warn", color: "var(--warning)" },
  maintenance: { label: "Maintenance", pill: "pill dgr", color: "var(--danger)" },
};

/** Design line 2120: "Studio" when there are no bedrooms. */
export function specLine(condo: Condo): string {
  const beds = condo.bedrooms === 0 ? "Studio" : `${condo.bedrooms} bedroom`;
  const size = condo.size_sqm ? ` · ${condo.size_sqm} m²` : "";
  return `${beds} · ${condo.bathrooms} bath${size}`;
}

/** Whole baht, grouped — matches the prototype's money() helper. */
export function groupBaht(amount: string): string {
  return Math.round(Number(amount)).toLocaleString("en-US");
}
