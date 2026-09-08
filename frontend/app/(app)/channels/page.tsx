import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChannelsScreen } from "@/features/channels/ChannelsScreen";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Channels" };

export default async function ChannelsPage() {
  // Checked here as well as in the nav. Hiding a link is not authorisation —
  // the API refuses too — but a signed-in cleaner typing /channels should land
  // somewhere useful rather than on a screen of failed requests.
  const user = await getSession();
  if (!user?.capabilities.includes("channel:read")) redirect("/");

  return <ChannelsScreen />;
}
