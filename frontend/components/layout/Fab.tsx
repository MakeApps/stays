"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CalendarPlusIcon, PlusIcon } from "@/components/layout/icons";
import { useSession } from "@/components/providers/Providers";
import type { Capability } from "@/types/api";

/**
 * The mobile floating action: whatever this screen is primarily for creating.
 *
 * Rendered from the shell rather than from each screen, and that placement is
 * load-bearing rather than tidiness. Every screen's root `<section>` carries
 * `animation: lsFade` — which animates `transform` with `fill: both`, so the
 * transform persists forever and makes the section a containing block. A
 * `position: fixed` child of it is fixed to the *section*, not the viewport:
 * the button drifted up the page and sat on top of the last card. Same trap
 * that once knocked the modals off-centre.
 */
const ACTIONS: {
  match: (pathname: string) => boolean;
  href: string;
  label: string;
  capability: Capability;
  icon: React.FC<{ size?: number }>;
}[] = [
  {
    match: (p) => p.startsWith("/calendar") || p === "/bookings",
    href: "/bookings/new",
    label: "New booking",
    capability: "booking:write",
    icon: CalendarPlusIcon,
  },
  {
    match: (p) => p === "/condos",
    href: "/condos?new=1",
    label: "New condo",
    capability: "condo:write",
    icon: PlusIcon,
  },
  {
    match: (p) => p.startsWith("/expenses"),
    href: "/expenses?new=1",
    label: "New expense",
    capability: "expense:write",
    icon: PlusIcon,
  },
];

export function Fab() {
  const pathname = usePathname();
  const user = useSession();

  const action = ACTIONS.find((a) => a.match(pathname));
  // No action on screens that create nothing — a button that does something
  // unrelated to what you are looking at is worse than no button.
  if (!action || !user?.capabilities.includes(action.capability)) return null;

  const Icon = action.icon;
  return (
    <Link
      className="fab mobile-only"
      href={action.href as never}
      aria-label={action.label}
      title={action.label}
    >
      <Icon size={24} />
    </Link>
  );
}
