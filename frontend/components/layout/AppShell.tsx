"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandGlyph, BrandWordmark } from "@/components/ds/Brand";
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
  PanelCollapseIcon,
  PanelExpandIcon,
  PlusIcon,
  RefreshIcon,
  UsersIcon,
} from "@/components/layout/icons";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { Fab } from "@/components/layout/Fab";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NAV_COOKIE, collapsesOnArrival } from "@/components/layout/nav-preference";
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
  // Admin only: `user:read` is not in any other role's capability set.
  { href: "/users", label: "Users", icon: UsersIcon, capability: "user:read" },
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

export function AppShell({
  children,
  defaultCollapsed = false,
}: {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const user = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [preference, setPreference] = useState(defaultCollapsed);
  // Non-null only while the user has overridden an auto-collapsing screen.
  const [override, setOverride] = useState<boolean | null>(null);

  // Close the drawer on navigation; leaving it open over a new screen is the
  // classic mobile-nav bug.
  useEffect(() => {
    setNavOpen(false);
    setOverride(null);
  }, [pathname]);

  const autoCollapses = collapsesOnArrival(pathname);
  const collapsed = override ?? (autoCollapses || preference);

  function toggleRail() {
    const next = !collapsed;
    if (autoCollapses) {
      setOverride(next);
      return;
    }
    setPreference(next);
    // A UI preference, not a secret — deliberately readable by the client so
    // it can be written without a round trip. Lax keeps it off cross-site
    // requests; a year because nobody wants to re-collapse this weekly.
    document.cookie = `${NAV_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

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
      <aside className={cn("sidebar", navOpen && "open", collapsed && "collapsed")}>
        {/* Nothing below branches on `collapsed` in JS. The rail is a desktop
            state, but the same markup is the mobile drawer — branching here
            meant opening "More" on an auto-collapsing screen gave a drawer
            with no labels and no Quick add. CSS scopes the rail to desktop. */}
        <div className="sidebar-brand">
          <div className="brand-row">
            {/* The wordmark is the brand; the glyph is only the compact mark
                for the rail. Showing both here left no room for the collapse
                toggle — 248px minus padding is 208, and the lockup filled it
                exactly. */}
            <span className="brand-mark">
              <BrandGlyph />
            </span>
            <span className="brand-word">
              <BrandWordmark />
            </span>
            <div className="brand-spacer" />
            <button
              type="button"
              className="nav-toggle"
              onClick={toggleRail}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? <PanelExpandIcon size={16} /> : <PanelCollapseIcon size={16} />}
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-group">Manage</div>
          {NAV.filter((item) => allowed(item.capability)).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn("sidebar-item", isActive(href) && "active")}
              aria-current={isActive(href) ? "page" : undefined}
              // The visible label is display:none in the rail, which strips the
              // accessible name, so it is set here unconditionally. Identical
              // to the visible text, so nothing is announced twice.
              aria-label={label}
              title={label}
            >
              <Icon />
              <span className="nav-label">{label}</span>
            </Link>
          ))}

          {/* Quick add is dropped from the rail rather than reduced to three
              identical plus signs. Giving each its entity icon would collide
              with the nav item directly above it — same icon, different
              action — and every one of these is a primary button on the screen
              it leads to, so nothing here is otherwise unreachable. */}
          {QUICK_ADD.some((item) => allowed(item.capability)) ? (
            <div className="quick-add">
              <div className="sidebar-group">Quick add</div>
              {QUICK_ADD.filter((item) => allowed(item.capability)).map(({ href, label }) => (
                <Link
                  key={label}
                  href={href as React.ComponentProps<typeof Link>["href"]}
                  className="sidebar-item"
                  style={{ color: "var(--brand-purple)" }}
                >
                  <PlusIcon />
                  <span className="nav-label">{label}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </nav>

        <div className="sidebar-bottom">
          <div
            className="user-pill"
            style={{ background: "var(--surface-2)" }}
            title={`${user?.full_name} · ${user?.role}`}
          >
            <div className="user-avatar">{initials(user?.full_name ?? "?")}</div>
            <div className="user-meta" style={{ minWidth: 0, flex: 1 }}>
              <div className="user-name">{user?.full_name}</div>
              <div className="user-email" style={{ textTransform: "capitalize" }}>
                {user?.role}
              </div>
            </div>
            {/* Inside the pill, where it belongs when expanded. In the rail
                there is no room beside a 32px avatar, so CSS wraps it onto
                its own line rather than the shell rendering two buttons. */}
            <button
              className="icon-btn sign-out"
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
          <GlobalSearch />
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

      {/* Both outside <main>. Every screen's root section animates a
          transform with fill:both, which makes it a containing block — a
          position:fixed child of one is fixed to the section, not the
          viewport. "More" reuses the drawer instead of duplicating it. */}
      <Fab />
      <BottomTabs onMore={() => setNavOpen(true)} />
    </div>
  );
}
