import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/services/http";

/**
 * Query key factory.
 *
 * Hierarchical prefixes mean one `invalidateQueries({ queryKey: qk.condos.all })`
 * sweeps every condo-derived cache. That matters more than it looks: condo
 * status is derived from bookings, so a booking mutation has to invalidate the
 * condos grid and its filter counts too — easy to miss without a shared root.
 */
export const qk = {
  me: ["me"] as const,

  condos: {
    all: ["condos"] as const,
    list: (filters: Record<string, unknown>) => [...qk.condos.all, "list", filters] as const,
    detail: (id: string) => [...qk.condos.all, "detail", id] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    list: (filters: Record<string, unknown>) => [...qk.bookings.all, "list", filters] as const,
    detail: (id: string) => [...qk.bookings.all, "detail", id] as const,
    calendar: (window: Record<string, unknown>) =>
      [...qk.bookings.all, "calendar", window] as const,
    conflict: (query: Record<string, unknown>) =>
      [...qk.bookings.all, "conflict", query] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    lookups: ["expenses", "lookups"] as const,
    list: (filters: Record<string, unknown>) => [...qk.expenses.all, "list", filters] as const,
    summary: (month: string | null) => [...qk.expenses.all, "summary", month] as const,
  },
  income: {
    all: ["income"] as const,
    summary: (month: string | null) => [...qk.income.all, "summary", month] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: (month: string | null) => ["dashboard", "summary", month] as const,
  },
  search: (term: string) => ["search", term] as const,
  users: {
    all: ["users"] as const,
    list: (q: string | null) => [...qk.users.all, "list", q] as const,
  },
  activity: {
    all: ["activity"] as const,
    recent: (limit: number) => [...qk.activity.all, "recent", limit] as const,
  },
} as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        retry: (attempt, error) => {
          // Retrying an auth or conflict failure just delays the real answer.
          if (error instanceof ApiError && (error.isAuth || error.isConflict || error.isValidation)) {
            return false;
          }
          return attempt < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
