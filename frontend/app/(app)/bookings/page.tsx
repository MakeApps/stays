import type { Metadata } from "next";

import { ComingSoon } from "@/components/ds/ComingSoon";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return (
    <ComingSoon
      title="Bookings"
      phase="Phase 2"
      description="Booking list, the dual-mode pricing form, conflict detection and the detail drawer."
    />
  );
}
