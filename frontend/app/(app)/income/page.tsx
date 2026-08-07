import type { Metadata } from "next";

import { IncomeScreen } from "@/features/income/IncomeScreen";

export const metadata: Metadata = { title: "Income" };

export default function IncomePage() {
  return <IncomeScreen />;
}
