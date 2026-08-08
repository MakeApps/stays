import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { NAV_COOKIE } from "@/components/layout/nav-preference";
import { Providers } from "@/components/providers/Providers";
import { getSession } from "@/lib/session";

/**
 * The real authorisation boundary.
 *
 * middleware.ts only checks that a cookie exists; this asks the API to verify
 * it. Reading the session here also means the sidebar renders with the user
 * already in hand, with no client fetch waterfall.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  // Read here rather than from localStorage in the client: a preference that
  // arrives after hydration shows the sidebar wide and then snaps it shut on
  // every navigation. A cookie is known before the first byte renders.
  const collapsed = (await cookies()).get(NAV_COOKIE)?.value === "1";

  return (
    <Providers user={user}>
      <AppShell defaultCollapsed={collapsed}>{children}</AppShell>
    </Providers>
  );
}
