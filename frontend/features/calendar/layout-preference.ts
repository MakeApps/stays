/**
 * Calendar layout preference, shared by the server page and the client screen.
 *
 * Not in CalendarScreen.tsx for the reason nav-preference.ts is not in
 * AppShell.tsx: a value imported from a `"use client"` module into a Server
 * Component arrives as a client reference, so the cookie lookup silently
 * misses and the preference never applies.
 */

/** Written by the client, read by the calendar page before the first byte. */
export const CAL_LAYOUT_COOKIE = "ls_cal_layout";

/**
 * `standard` is the timeline on desktop and the compact month on a phone.
 * `square` is one listing as a month of day boxes, the way Airbnb's host
 * calendar draws it, at every width.
 */
export type CalendarLayout = "standard" | "square";

export function parseLayout(value: string | undefined): CalendarLayout {
  return value === "square" ? "square" : "standard";
}
