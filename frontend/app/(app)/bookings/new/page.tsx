import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingForm } from "@/features/bookings/BookingForm";

export const metadata: Metadata = { title: "New booking" };

export default function NewBookingPage() {
  return (
    <Suspense fallback={null}>
      <BookingForm />
    </Suspense>
  );
}
