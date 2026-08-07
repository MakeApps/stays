import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingsScreen } from "@/features/bookings/BookingsScreen";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsScreen />
    </Suspense>
  );
}
