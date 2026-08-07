import type { Metadata } from "next";

import { ComingSoon } from "@/components/ds/ComingSoon";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <ComingSoon
      title="Expenses"
      phase="Phase 3"
      description="Expense list and overview, receipt upload with preview, category breakdown and monthly trend."
    />
  );
}
