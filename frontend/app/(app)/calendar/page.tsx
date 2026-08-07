import type { Metadata } from "next";

import { ComingSoon } from "@/components/ds/ComingSoon";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <ComingSoon
      title="Calendar"
      phase="Phase 2"
      description="The resource timeline with month and week views, filters, guest search, and drag to move or resize a stay."
    />
  );
}
