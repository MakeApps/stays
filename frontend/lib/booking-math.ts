/**
 * Booking pricing, mirroring `backend/app/services/pricing.py` exactly.
 *
 * This exists only for **live preview** while typing — the server's quote is
 * the authority and is what gets stored. Keeping the two in step matters
 * because a figure that changes between the form and the confirmation is the
 * fastest way to lose a user's trust in a money screen.
 *
 * Arithmetic is done in satang as integers. Never accumulate baht as floats:
 * `0.1 + 0.2` problems in a system that reports net profit are not acceptable.
 */

export const MINOR_UNITS = 100;

/** Baht (as typed) → satang, half-up at the satang boundary. */
export function toMinor(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * MINOR_UNITS);
}

/** Satang → baht, for putting a computed value back into an input. */
export function toMajor(minor: number): string {
  return (minor / MINOR_UNITS).toFixed(2).replace(/\.00$/, "");
}

/** Renders the way the design does: grouped whole baht, e.g. "฿1,800". */
export function formatTHB(minor: number): string {
  const baht = Math.round(minor / MINOR_UNITS);
  // Sign before the symbol, matching the API's format_thb. "฿-25,000" puts the
  // minus inside the number and reads as a typo.
  const sign = baht < 0 ? "-" : "";
  return `${sign}฿${Math.abs(baht).toLocaleString("en-US")}`;
}

/**
 * Whole nights between two `YYYY-MM-DD` strings.
 *
 * Parsed as UTC deliberately. `new Date("2026-08-01")` is UTC midnight but
 * `new Date(2026, 7, 1)` is local midnight, and mixing them shifts every
 * booking bar by a day either side of a DST boundary. Stay dates are calendar
 * dates, never instants — and `.toISOString()` must never be called on one.
 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayISO(): string {
  const now = new Date();
  // Local calendar date, not UTC — "today" means today where the user is.
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export interface QuoteInput {
  checkIn: string;
  checkOut: string;
  mode: "nightly" | "total";
  nightRate: string;
  totalManual: string;
  discount: string;
  cleaningFee: string;
  otherCharges: string;
  taxPct: string;
  received: string;
}

export interface Quote {
  nights: number;
  nightRate: number;
  subtotal: number;
  discount: number;
  cleaningFee: number;
  otherCharges: number;
  tax: number;
  total: number;
  received: number;
  balance: number;
  paymentStatus: "paid" | "partial" | "pending";
  /** Set when the inputs cannot produce a quote (e.g. zero nights). */
  error: string | null;
}

export function computeQuote(input: QuoteInput): Quote {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const discount = toMinor(input.discount);
  const cleaningFee = toMinor(input.cleaningFee);
  const otherCharges = toMinor(input.otherCharges);
  const received = toMinor(input.received);
  const pct = Number(input.taxPct || 0);

  const empty: Quote = {
    nights: Math.max(0, nights),
    nightRate: 0,
    subtotal: 0,
    discount,
    cleaningFee,
    otherCharges,
    tax: 0,
    total: 0,
    received,
    balance: -received,
    paymentStatus: received > 0 ? "partial" : "pending",
    error: null,
  };

  if (nights < 1) {
    return { ...empty, error: "Check-out must be after check-in." };
  }

  // Mirrors the server's bound. Without it a typo like 5000% only surfaces as
  // a rejected save, after the user has filled in the whole form.
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return { ...empty, error: "Tax must be between 0 and 100 percent." };
  }

  const subtotal =
    input.mode === "nightly" ? toMinor(input.nightRate) * nights : toMinor(input.totalManual);
  // Display-only in total mode; the entered total stays authoritative so no
  // rounding drift reaches what gets stored.
  const nightRate =
    input.mode === "nightly" ? toMinor(input.nightRate) : Math.round(subtotal / nights);

  const taxable = subtotal - discount + cleaningFee + otherCharges;
  if (taxable < 0) {
    return { ...empty, nights, subtotal, nightRate, error: "The discount exceeds the charges." };
  }

  const tax = Math.round((taxable * pct) / 100);
  const total = taxable + tax;
  const balance = total - received;

  return {
    nights,
    nightRate,
    subtotal,
    discount,
    cleaningFee,
    otherCharges,
    tax,
    total,
    received,
    balance,
    paymentStatus: received >= total && total > 0 ? "paid" : received > 0 ? "partial" : "pending",
    error: null,
  };
}

/**
 * The design's overlap rule (lines 2043–2048): half-open, so a checkout and a
 * checkin on the same day do not collide. Used for instant local feedback;
 * the database constraint is what actually guarantees it.
 */
export function overlaps(
  aIn: string,
  aOut: string,
  bIn: string,
  bOut: string,
): boolean {
  return aIn < bOut && aOut > bIn;
}
