import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/query";
import { api, qs } from "@/services/http";
import type {
  AvailabilityResponse,
  Booking,
  BookingListResponse,
  CalendarResponse,
  QuoteResponse,
} from "@/types/api";

export interface BookingFilters {
  q?: string;
  condo_id?: string;
  status?: string;
  payment_status?: string;
  start?: string;
  end?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface BookingInput {
  condo_id: string;
  guest_name: string;
  guest_phone?: string | null;
  guest_email?: string | null;
  check_in: string;
  check_out: string;
  mode: "nightly" | "total";
  night_rate: string;
  total_manual: string;
  discount: string;
  cleaning_fee: string;
  other_charges: string;
  tax_pct: string;
  received: string;
  status: string;
  notes?: string | null;
}

export function useBookings(filters: BookingFilters) {
  return useQuery({
    queryKey: qk.bookings.list(filters as Record<string, unknown>),
    queryFn: () => api.get<BookingListResponse>(`/bookings${qs({ ...filters })}`),
    placeholderData: (previous) => previous,
  });
}

export function useBooking(id: string | null) {
  return useQuery({
    queryKey: qk.bookings.detail(id ?? ""),
    queryFn: () => api.get<Booking>(`/bookings/${id}`),
    enabled: Boolean(id),
  });
}

export function useCalendar(start: string, end: string, condoId?: string) {
  return useQuery({
    queryKey: qk.bookings.calendar({ start, end, condoId: condoId ?? null }),
    queryFn: () =>
      api.get<CalendarResponse>(`/bookings/calendar${qs({ start, end, condo_id: condoId })}`),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

/**
 * Server-side availability check.
 *
 * The form also checks locally against cached calendar data for instant
 * feedback; this catches a booking someone else made since the page loaded.
 */
export function useAvailability(params: {
  condoId: string;
  checkIn: string;
  checkOut: string;
  excludeId?: string;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: qk.bookings.conflict(params as unknown as Record<string, unknown>),
    queryFn: () =>
      api.get<AvailabilityResponse>(
        `/bookings/availability${qs({
          condo_id: params.condoId,
          check_in: params.checkIn,
          check_out: params.checkOut,
          exclude_booking_id: params.excludeId,
        })}`,
      ),
    enabled: params.enabled,
    staleTime: 10_000,
  });
}

export function useServerQuote() {
  return useMutation({
    mutationFn: (input: Omit<BookingInput, "condo_id" | "guest_name" | "status">) =>
      api.post<QuoteResponse>("/bookings/quote", input),
  });
}

/**
 * A booking mutation changes far more than the bookings list: condo status is
 * derived from bookings, so the condos grid and its filter counts move too.
 */
function useInvalidateBookings() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.bookings.all });
    void client.invalidateQueries({ queryKey: qk.condos.all });
    void client.invalidateQueries({ queryKey: qk.activity.all });
  };
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: BookingInput) => api.post<Booking>("/bookings", input),
    onSuccess: invalidate,
  });
}

export function useUpdateBooking(id: string) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: Partial<BookingInput>) => api.patch<Booking>(`/bookings/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/bookings/${id}`),
    onSuccess: invalidate,
  });
}

/**
 * Move or resize a booking from the calendar, with an optimistic update.
 *
 * `scope` serialises rapid consecutive drags of the same bar so a slow first
 * request cannot land after a faster second one and resurrect stale dates.
 */
export function useMoveBooking(calendarKey: readonly unknown[]) {
  const client = useQueryClient();
  const invalidate = useInvalidateBookings();

  return useMutation({
    scope: { id: "booking-move" },
    mutationFn: (vars: { id: string; condo_id: string; check_in: string; check_out: string }) =>
      api.patch<Booking>(`/bookings/${vars.id}`, {
        condo_id: vars.condo_id,
        check_in: vars.check_in,
        check_out: vars.check_out,
      }),
    onMutate: async (vars) => {
      await client.cancelQueries({ queryKey: calendarKey });
      const previous = client.getQueryData<CalendarResponse>(calendarKey);
      client.setQueryData<CalendarResponse>(calendarKey, (old) =>
        old
          ? {
              ...old,
              events: old.events.map((e) =>
                e.id === vars.id
                  ? {
                      ...e,
                      condo_id: vars.condo_id,
                      check_in: vars.check_in,
                      check_out: vars.check_out,
                      nights: Math.round(
                        (Date.parse(`${vars.check_out}T00:00:00Z`) -
                          Date.parse(`${vars.check_in}T00:00:00Z`)) /
                          86_400_000,
                      ),
                    }
                  : e,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(calendarKey, context.previous);
    },
    onSettled: invalidate,
  });
}
