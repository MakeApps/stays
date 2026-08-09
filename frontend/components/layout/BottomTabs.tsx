"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BookingIcon,
  CalendarIcon,
  DashboardIcon,
  IncomeIcon,
  MoreIcon,
} from "@/components/layout/icons";
import { useSession } from "@/components/providers/Providers";
import { cn } from "@/lib/cn";
import type { Capability } from "@/types/api";

/**
 * Mobile bottom navigation.
 *
 * Five destinations at thumb height, which is the single change that makes a
 * web app read as an app. It does not replace the drawer — "More" opens it,
 * so Condos, Expenses, quick-add and sign-out keep exactly one home rather
 * than being duplicated into a second, competing menu.
 *
 * Desktop never sees this: the sidebar is already permanent there.
 */
const TABS: {
  href: Route;
  label: string;
  icon: React.FC<{ size?: number }>;
  capability: Capability;
}[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon, capability: "dashboard:read" },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon, capability: "calendar:read" },
  { href: "/bookings", label: "Bookings", icon: BookingIcon, capability: "booking:read" },
  { href: "/income", label: "Income", icon: IncomeIcon, capability: "income:read" },
];

export function BottomTabs({ onMore }: { onMore: () => void }) {
  const user = useSession();
  const pathname = usePathname();

  const allowed = (capability: Capability) => Boolean(user?.capabilities.includes(capability));
  const isActive = (href: Route) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // The drawer holds what the bar cannot, so "More" is only worth showing when
  // there is something behind it.
  const hasMore = allowed("condo:read") || allowed("expense:read");

  return (
    <nav className="bottom-tabs mobile-only" aria-label="Main">
      {TABS.filter((t) => allowed(t.capability)).map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn("bottom-tab", isActive(href) && "active")}
          aria-current={isActive(href) ? "page" : undefined}
        >
          <Icon size={20} />
          <span>{label}</span>
        </Link>
      ))}
      {hasMore ? (
        <button type="button" className="bottom-tab" onClick={onMore} aria-haspopup="menu">
          <MoreIcon size={20} />
          <span>More</span>
        </button>
      ) : null}
    </nav>
  );
}
