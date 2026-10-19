import { MINOR_UNITS } from "@/lib/booking-math";
import type { CurrencyCode, OrganisationSummary } from "@/types/api";

/**
 * Which currency an organisation keeps its books in, and how a figure in it
 * is written.
 *
 * Mirrors `backend/app/common/money.py`. The API pre-renders every label it
 * sends, so most screens never touch this; it exists for the figures the
 * browser computes itself — a quote while typing, a deposit preview, the
 * symbol beside an input — which must come out looking exactly like the
 * server's would.
 *
 * Nothing converts between currencies. An organisation chooses one in
 * Settings and every amount it holds is read in it; the symbol is the only
 * thing that changes.
 *
 * Deliberately NOT a "use client" module: server components read it too.
 */
export interface Currency {
  code: CurrencyCode;
  symbol: string;
  name: string;
}

export const CURRENCIES: readonly Currency[] = [
  { code: "THB", symbol: "฿", name: "Thai baht" },
  { code: "INR", symbol: "₹", name: "Indian rupee" },
];

export const DEFAULT_CURRENCY: Currency = CURRENCIES[0]!;

/**
 * The organisation's currency, from the session.
 *
 * A code this build does not know still renders with the symbol the API
 * sent, rather than crashing a screen over a registry that lags the server.
 */
export function currencyOf(
  organisation: Pick<OrganisationSummary, "currency" | "currency_symbol"> | null | undefined,
): Currency {
  if (!organisation) return DEFAULT_CURRENCY;
  const known = CURRENCIES.find((c) => c.code === organisation.currency);
  if (known) return known;
  return {
    code: organisation.currency,
    symbol: organisation.currency_symbol,
    name: organisation.currency,
  };
}

/**
 * Whole units → `"฿1,800"`, the way the prototype's money() helper does.
 *
 * Sign before the symbol, matching the API's format_money: `"-฿25,000"`, not
 * `"฿-25,000"`, which puts the minus inside the number and reads as a typo.
 */
export function formatMajor(amount: string | number, symbol: string): string {
  const whole = Math.round(Number(amount) || 0);
  const sign = whole < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(whole).toLocaleString("en-US")}`;
}

/** Minor units (satang, paise) → the same rendering. */
export function formatMinor(minor: number, symbol: string): string {
  return formatMajor(minor / MINOR_UNITS, symbol);
}
