import type { Metadata } from "next";

import { ComingSoon } from "@/components/ds/ComingSoon";

export const metadata: Metadata = { title: "Income" };

export default function IncomePage() {
  return (
    <ComingSoon
      title="Income"
      phase="Phase 3"
      description="Revenue by day and by condo, payment-status breakdown, and net profit against expenses."
    />
  );
}
