"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandGlyph, BrandLockup, BrandWordmark } from "@/components/ds/Brand";
import {
  BellIcon,
  BookingIcon,
  CalendarIcon,
  CondoIcon,
  DashboardIcon,
  ExpenseIcon,
  IncomeIcon,
  LogoutIcon,
  MenuIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/layout/icons";
import { useSession } from "@/components/providers/Providers";
import { cn } from "@/lib/cn";
import { api } from "@/services/http";
import type { Capability } from "@/types/api";

/** Design lines 43–66. `capability` gates each item — that is what makes the
 *  role model real rather than decorative. */
const NAV: {
  href: Route;
  label: string;
  icon: React.FC<{ size?: number }>;
  capability: Capability;
}[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon, capability: "dashboard:read" },
  { href: "/condos", label: "Condos", icon: CondoIcon, capability: "condo:read" },
  { href: "/bookings", label: "Bookings", icon: BookingIcon, capability: "booking:read" },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon, capability: "calendar:read" },
  { href: "/income", label: "Income", icon: IncomeIcon, capability: "income:read" },
  { href: "/expenses", label: "Expenses", icon: ExpenseIcon, capability: "expense:read" },
];

const QUICK_ADD: {
  href: { pathname: string; query?: Record<string, string> };
  label: string;
  capability: Capability;
}[] = [
  { href: { pathname: "/expenses", query: { new: "1" } }, label: "New expense", capability: "expense:write" },
  { href: { pathname: "/condos", query: { new: "1" } }, label: "New condo", capability: "condo:write" },
  { href: { pathname: "/bookings/new" }, label: "New booking", capability: "booking:write" },
];

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the drawer on navigation; leaving it open over a new screen is the
  // classic mobile-nav bug.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const allowed = (capability: Capability) => Boolean(user?.capabilities.includes(capability));
  const isActive = (href: Route) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0] ?? href);

  async function signOut() {
    setSigningOut(true);
    try {
      await api.post("/auth/logout");
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="ls-base app" style={{ minHeight: "100vh" }}>
      <aside className={cn("sidebar", navOpen && "open")}>
        <div className="sidebar-brand">
          <BrandLockup />
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-group">Manage</div>
          {NAV.filter((item) => allowed(item.capability)).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn("sidebar-item", isActive(href) && "active")}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon />
              {label}
            </Link>
          ))}

          {QUICK_ADD.some((item) => allowed(item.capability)) ? (
            <>
              <div className="sidebar-group">Quick add</div>
              {QUICK_ADD.filter((item) => allowed(item.capability)).map(({ href, label }) => (
                <Link
                  key={label}
                  href={href as React.ComponentProps<typeof Link>["href"]}
                  className="sidebar-item"
                  style={{ color: "var(--brand-purple)" }}
                >
                  <PlusIcon />
                  {label}
                </Link>
              ))}
            </>
          ) : null}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-pill" style={{ background: "var(--surface-2)" }}>
            <div className="user-avatar">{initials(user?.full_name ?? "?")}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="user-name">{user?.full_name}</div>
              <div className="user-email" style={{ textTransform: "capitalize" }}>
                {user?.role}
              </div>
            </div>
            <button
              className="icon-btn"
              style={{ width: 28, height: 28, border: 0, background: "transparent" }}
              onClick={signOut}
              disabled={signingOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogoutIcon size={15} />
            </button>
          </div>
        </div>
      </aside>

      {navOpen ? (
        <div className="sidebar-overlay" onClick={() => setNavOpen(false)} aria-hidden="true" />
      ) : null}

      <main className="main" style={{ maxWidth: 1440, minWidth: 0 }}>
        {/* Design lines 100–113 */}
        <div className="mobile-topbar" style={{ margin: "-20px -20px 20px" }}>
          <button
            className="hamburger"
            onClick={() => setNavOpen((open) => !open)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
          >
            <MenuIcon size={22} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <BrandGlyph size={24} />
            <BrandWordmark size={15} />
          </div>
          <button className="icon-btn" style={{ border: 0 }} aria-label="Notifications">
            <BellIcon size={16} />
          </button>
        </div>

        {/* Design lines 115–132 */}
        <div
          className="desktop-only"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div className="search-box" style={{ flex: 1, maxWidth: 420 }}>
            <SearchIcon />
            <input
              placeholder="Search guests, condos, booking codes…"
              aria-label="Search"
              disabled
              title="Global search arrives in Phase 4"
            />
          </div>
          <div style={{ flex: 1 }} />
          <button
            className="icon-btn"
            title="Reload data"
            aria-label="Reload data"
            onClick={() => router.refresh()}
          >
            <RefreshIcon size={15} />
          </button>
          <button
            className="icon-btn"
            style={{ position: "relative" }}
            title="Notifications"
            aria-label="Notifications"
          >
            <BellIcon size={15} />
            <span
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--brand-purple)",
                border: "1.5px solid #fff",
              }}
            />
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px 4px 4px",
              border: "1px solid var(--line)",
              borderRadius: 999,
              background: "var(--surface)",
            }}
          >
            <div className="user-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
              {initials(user?.full_name ?? "?")}
            </div>
            <span style={{ font: "600 13px/1 var(--font-sans)", color: "var(--fg-2)" }}>
              {user?.full_name.split(" ")[0]}
            </span>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
