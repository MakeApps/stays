import { useQuery } from "@tanstack/react-query";

import { qk } from "@/lib/query";
import { api, qs } from "@/services/http";
import type { DashboardResponse, SearchResponse } from "@/types/api";

export function useDashboard(month?: string) {
  return useQuery({
    queryKey: qk.dashboard.summary(month ?? null),
    queryFn: () => api.get<DashboardResponse>(`/dashboard${qs({ month })}`),
  });
}

/** Global search. Disabled below two characters — a one-letter query matches
 *  most of the database and is never what the user meant. */
export function useSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: qk.search(q),
    queryFn: () => api.get<SearchResponse>(`/dashboard/search${qs({ q })}`),
    enabled: q.length >= 2,
    staleTime: 15_000,
  });
}

export function exportUrl(kind: "bookings" | "expenses" | "income"): string {
  return `/api/v1/dashboard/export${qs({ kind })}`;
}
