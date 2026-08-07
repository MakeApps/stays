import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/query";
import { api, apiFetch, qs } from "@/services/http";
import type { Condo, CondoListResponse, UnitStatus } from "@/types/api";

export interface CondoFilters {
  q?: string;
  status?: UnitStatus | "all";
  page?: number;
  per_page?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface CondoInput {
  name: string;
  code: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number | null;
  night_rate: string;
  month_rate: string;
  cleaning_fee: string;
  security_deposit: string;
  address: string | null;
  description: string | null;
  is_maintenance: boolean;
}

export function useCondos(filters: CondoFilters) {
  return useQuery({
    queryKey: qk.condos.list(filters as Record<string, unknown>),
    queryFn: () => api.get<CondoListResponse>(`/condos${qs({ ...filters })}`),
    // Keeps the grid populated while a filter change is in flight, instead of
    // blanking — the production equivalent of the prototype's instant local
    // filtering.
    placeholderData: (previous) => previous,
  });
}

export function useCondo(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.condos.detail(id),
    queryFn: () => api.get<Condo>(`/condos/${id}`),
    enabled: enabled && Boolean(id),
  });
}

/** Condo status is derived from bookings, so anything that touches condos also
 *  invalidates the activity feed and (from Phase 2) booking-derived caches. */
function useInvalidateCondos() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.condos.all });
    void client.invalidateQueries({ queryKey: qk.activity.all });
  };
}

export function useCreateCondo() {
  const invalidate = useInvalidateCondos();
  return useMutation({
    mutationFn: (input: CondoInput) => api.post<Condo>("/condos", input),
    onSuccess: invalidate,
  });
}

export function useUpdateCondo(id: string) {
  const invalidate = useInvalidateCondos();
  return useMutation({
    mutationFn: (input: Partial<CondoInput>) => api.patch<Condo>(`/condos/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCondo() {
  const invalidate = useInvalidateCondos();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/condos/${id}`),
    onSuccess: invalidate,
  });
}

export function useUploadCondoImage(id: string) {
  const invalidate = useInvalidateCondos();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<{ condo: Condo; image_id: string }>(`/condos/${id}/images`, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCondoImage(condoId: string) {
  const invalidate = useInvalidateCondos();
  return useMutation({
    mutationFn: (imageId: string) => api.del<void>(`/condos/${condoId}/images/${imageId}`),
    onSuccess: invalidate,
  });
}
