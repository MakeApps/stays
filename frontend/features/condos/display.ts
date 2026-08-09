import type { Condo, DepositStatus, LeaseStatus, UnitStatus } from "@/types/api";

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

/** Lease term → the same DS pill vocabulary the unit statuses use. */
export const LEASE_META: Record<LeaseStatus, { label: string; pill: string; color: string }> = {
  none: { label: "No lease", pill: "pill", color: "var(--fg-4)" },
  active: { label: "Active", pill: "pill ok", color: "var(--success)" },
  expiring_soon: { label: "Expiring soon", pill: "pill warn", color: "var(--warning)" },
  expired: { label: "Expired", pill: "pill dgr", color: "var(--danger)" },
};

export const DEPOSIT_META: Record<DepositStatus, { label: string; pill: string }> = {
  none: { label: "No deposit", pill: "pill" },
  held: { label: "Held", pill: "pill info" },
  partially_refunded: { label: "Partially refunded", pill: "pill warn" },
  refunded: { label: "Refunded", pill: "pill ok" },
};

/** "42 days remaining" / "Ended 12 days ago" / null when no lease is on file. */
export function leaseCountdown(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) {
    const ago = Math.abs(days);
    return `Ended ${ago} day${ago === 1 ? "" : "s"} ago`;
  }
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

/** `2026-12-31` → `31 Dec 2026`, without going near a Date timezone shift. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDay(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day)} ${name} ${year}` : iso;
}
