/**
 * Sidebar rail constants, shared by the server layout and the client shell.
 *
 * Deliberately NOT in AppShell.tsx. That file is `"use client"`, and a plain
 * value imported from a client module into a Server Component arrives as a
 * client *reference* rather than the value. `cookies().get()` then returns
 * undefined instead of throwing, so the preference silently never applies —
 * the same trap that took STATUS_META out of a client module.
 */

/** Written by the client, read by the server layout before the first byte. */
export const NAV_COOKIE = "ls_nav_collapsed";

/**
 * Screens that collapse the rail on arrival.
 *
 * The calendar is a horizontal timeline: every pixel the sidebar gives back is
 * another visible day. Auto-collapse is a per-visit default, not a change to
 * the saved preference — expanding it here is honoured for the visit, and
 * leaving restores whatever the user chose elsewhere. Silently rewriting the
 * preference from a screen the user did not set it on is the annoying version
 * of this feature.
 */
export const AUTO_COLLAPSE: readonly string[] = ["/calendar"];

export function collapsesOnArrival(pathname: string): boolean {
  return AUTO_COLLAPSE.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
