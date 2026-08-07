import type { Metadata } from "next";
import { Suspense } from "react";

import { CondosScreen } from "@/features/condos/CondosScreen";

export const metadata: Metadata = { title: "Condos" };

export default function CondosPage() {
  // useSearchParams needs a Suspense boundary to keep this route static-shell.
  return (
    <Suspense fallback={null}>
      <CondosScreen />
    </Suspense>
  );
}
