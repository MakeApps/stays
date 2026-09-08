import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/query";
import { api, qs } from "@/services/http";
import type {
  ChannelConnection,
  ChannelName,
  ChannelOverview,
  ChannelSyncLogRow,
  ChannelSyncResponse,
} from "@/types/api";

export interface MapListingInput {
  channel: ChannelName;
  condo_id: string;
  import_url?: string;
  external_listing_id?: string;
  external_label?: string;
}

export function useChannels() {
  return useQuery({
    queryKey: qk.channels.overview,
    queryFn: () => api.get<ChannelOverview>("/channels"),
  });
}

export function useChannelLogs(listingId: string | null, limit = 50) {
  return useQuery({
    queryKey: qk.channels.logs(listingId),
    queryFn: () =>
      api.get<{ items: ChannelSyncLogRow[] }>(
        `/channels/logs${qs({ listing_id: listingId, limit })}`,
      ),
  });
}

/**
 * A sync writes bookings, so it moves far more than the channels screen.
 *
 * Condo status is derived from bookings and the calendar reads them directly,
 * so an import that does not sweep those caches leaves a night looking free on
 * the very screen someone is about to sell it from.
 */
function useInvalidateChannels() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.channels.all });
    void client.invalidateQueries({ queryKey: qk.bookings.all });
    void client.invalidateQueries({ queryKey: qk.condos.all });
    void client.invalidateQueries({ queryKey: qk.dashboard.all });
    void client.invalidateQueries({ queryKey: qk.activity.all });
  };
}

export function useConnectChannel() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (channel: ChannelName) =>
      api.post<ChannelConnection>("/channels/connect", { channel }),
    onSuccess: invalidate,
  });
}

export function useDisconnectChannel() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (channel: ChannelName) =>
      api.post<ChannelConnection>("/channels/disconnect", { channel }),
    onSuccess: invalidate,
  });
}

export function useMapListing() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (input: MapListingInput) => api.post("/channels/listings", input),
    onSuccess: invalidate,
  });
}

export function useUnmapListing() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/channels/listings/${id}`),
    onSuccess: invalidate,
  });
}

/** Brief §7's "Sync Now" and §9's "Retry" — the same call. */
export function useSyncListing() {
  const invalidate = useInvalidateChannels();
  return useMutation({
    mutationFn: (id: string) => api.post<ChannelSyncResponse>(`/channels/listings/${id}/sync`),
    onSuccess: invalidate,
  });
}
