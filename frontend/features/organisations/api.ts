import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { api } from "@/services/http";
import type {
  CurrencyCode,
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

export interface NewOrganisation {
  name: string;
  /** The currency its books are kept in. Settled at creation because it is
   *  far cheaper to choose before the first rate is typed than to relabel
   *  a portfolio after. */
  currency: CurrencyCode;
}

export function useCreateOrganisation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewOrganisation) =>
      api.post<OrganisationDetail>("/organisations", input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["organisations"] });
    },
  });
}

/** Only the fields being changed are sent; the rest stay as they are. */
export interface OrganisationChanges {
  name?: string;
  currency?: CurrencyCode;
}

/**
 * Rename the organisation, change the currency its books are kept in, or both.
 *
 * A currency change drops the whole query cache, exactly as switching
 * organisation does: every label the API has sent is pre-rendered in the old
 * currency, and merely invalidating would leave "฿1,800" on screen beside a
 * form that now says rupees until each refetch landed. A rename only needs the
 * list and the shell to catch up.
 */
export function useUpdateOrganisation(id: string) {
  const client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (changes: OrganisationChanges) =>
      api.patch<OrganisationDetail>(`/organisations/${id}`, changes),
    onSuccess: (_result, changes) => {
      if (changes.currency !== undefined) {
        client.clear();
      } else {
        void client.invalidateQueries({ queryKey: ["organisations"] });
      }
      // The session (and with it the currency every screen reads) is read on
      // the server, so the shell only learns about the change on a refresh.
      router.refresh();
    },
  });
}
