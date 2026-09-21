import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { CalendarScreen } from "@/features/calendar/CalendarScreen";
import { CAL_LAYOUT_COOKIE, parseLayout } from "@/features/calendar/layout-preference";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  // Read here for the reason the sidebar preference is: a layout that arrives
  // after hydration draws one calendar and then swaps it for the other.
  const layout = parseLayout((await cookies()).get(CAL_LAYOUT_COOKIE)?.value);

  return (
    <Suspense fallback={null}>
      <CalendarScreen defaultLayout={layout} />
    </Suspense>
  );
}
