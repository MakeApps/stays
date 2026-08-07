import type { Metadata } from "next";
import { Suspense } from "react";

import { ExpensesScreen } from "@/features/expenses/ExpensesScreen";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <Suspense fallback={null}>
      <ExpensesScreen />
    </Suspense>
  );
}
