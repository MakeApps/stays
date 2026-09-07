import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { api } from "@/services/http";
import type {
  OrganisationDetail,
  OrganisationListResponse,
  SessionUser,
} from "@/types/api";

interface SessionResponse {
  user: SessionUser;
  access_expires_at: string;
}

export function useOrganisations() {
  return useQuery({
    queryKey: ["organisations"],
    queryFn: () => api.get<OrganisationListResponse>("/auth/organisations"),
    // The switcher is the one place that must not show a stale list: an
    // organisation you were just removed from is a door that no longer opens.
    staleTime: 0,
  });
}

/**
 * Move the session into another organisation.
 *
 * Everything cached belongs to the organisation it was fetched from, so the
 * whole query cache is dropped rather than invalidated — invalidation would
 * leave the previous tenant's condos on screen until each refetch landed,
 * which is precisely the frame nobody should ever see.
 */
export function useSwitchOrganisation() {
  const client = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (organisationId: string) =>
      api.post<SessionResponse>("/auth/organisation", {
        organisation_id: organisationId,
      }),
    onSuccess: () => {
      client.clear();
      // The layout reads the session on the server, so the shell's own idea of
      // which organisation it is in only changes on a refresh.
      router.refresh();
    },
  });
}

export function useCreateOrganisation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<OrganisationDetail>("/organisations", { name }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["organisations"] });
    },
  });
}

export function useRenameOrganisation(id: string) {
  const client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (name: string) => api.patch<OrganisationDetail>(`/organisations/${id}`, { name }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["organisations"] });
      router.refresh();
    },
  });
}
