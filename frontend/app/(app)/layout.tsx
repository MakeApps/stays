import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
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

  return (
    <Providers user={user}>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
