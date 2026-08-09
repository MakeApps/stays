import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UsersScreen } from "@/features/users/UsersScreen";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  // Checked here, not only in the nav. Hiding a link is not authorisation —
  // the API refuses too, but a signed-in non-admin typing /users should land
  // somewhere sensible rather than on a screen of failed requests.
  const user = await getSession();
  if (!user?.capabilities.includes("user:read")) redirect("/");

  return <UsersScreen />;
}
