"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useCan } from "@/components/providers/Providers";
import { MapListingModal } from "@/features/channels/MapListingModal";
import { SyncLogTable } from "@/features/channels/SyncLogTable";
import {
  useChannels,
  useConnectChannel,
  useDisconnectChannel,
  useSyncListing,
  useUnmapListing,
} from "@/features/channels/api";
import { ApiError } from "@/services/http";
import type {
  AvailableChannel,
  ChannelCapabilities,
  ChannelConnection,
  ChannelListingRow,
} from "@/types/api";

const CHANNEL_LABEL: Record<string, string> = { airbnb: "Airbnb" };

/**
 * The four rows brief §7 asks for, in the order it lists them.
 *
 * `key` is a capability name, so what shows here is whatever the server says
 * the current transport can do — never a hard-coded assumption.
 */
const CAPABILITY_ROWS: {
  key: keyof ChannelCapabilities;
  label: string;
  yes: string;
  no: string;
}[] = [
  {
    key: "availability_push",
    label: "Availability",
    yes: "Two-way",
    no: "Not supported",
  },
  {
    key: "reservation_pull",
    label: "Reservations",
    yes: "Imported",
    no: "Not supported",
  },
  {
    key: "pricing_push",
    label: "Pricing",
    yes: "Synced",
    no: "Not supported over this connection",
  },
  {
    key: "webhooks",
    label: "Live updates",
    yes: "Pushed by the channel",
    no: "Polled every 15 minutes",
  },
];

function when(value: string | null): string {
  if (!value) return "Never";
  const at = new Date(value);
  const mins = Math.round((Date.now() - at.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "connected" || status === "active"
      ? "ok"
      : status === "error"
        ? "dgr"
        : "neutral";
  return (
    <span className={`pill ${tone}`}>
      <span className="dot" />
      {status[0]?.toUpperCase()}
      {status.slice(1)}
    </span>
  );
}

function CopyableFeed({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return (
      <span className="t-caption">
        Set PUBLIC_BASE_URL on the API to publish a feed URL.
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <code
        style={{
          font: "500 12px/1.4 ui-monospace, monospace",
          color: "var(--fg-2)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 320,
        }}
        title={url}
      >
        {url}
      </code>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function ConnectionCard({
  channel,
  connection,
  writable,
}: {
  channel: AvailableChannel;
  connection: ChannelConnection | undefined;
  writable: boolean;
}) {
  const connect = useConnectChannel();
  const disconnect = useDisconnectChannel();
  const status = connection?.status ?? "disconnected";
  const name = CHANNEL_LABEL[channel.channel] ?? channel.channel;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{name}</div>
        <StatusPill status={status} />
      </div>
      <div style={{ padding: "18px 20px 20px" }}>
        <div className="t-small" style={{ marginBottom: 16 }}>
          Connected over <strong>{channel.transport}</strong>.{" "}
          {channel.capabilities.guest_details
            ? "Guest details and amounts are imported."
            : "This connection carries dates only — no guest details and no amounts — so an imported stay is held as a block for someone to price."}
        </div>

        {connection?.last_error ? (
          <div
            className="pill dgr"
            style={{
              display: "block",
              padding: "10px 12px",
              borderRadius: 10,
              marginBottom: 16,
              whiteSpace: "normal",
            }}
          >
            {connection.last_error}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          {CAPABILITY_ROWS.map((row) => {
            const supported = channel.capabilities[row.key];
            return (
              <div
                key={row.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  font: "500 13px/1.4 var(--font-sans)",
                }}
              >
                <span style={{ color: "var(--fg-2)" }}>{row.label}</span>
                <span style={{ color: supported ? "var(--success)" : "var(--fg-3)" }}>
                  {supported ? `✓ ${row.yes}` : `— ${row.no}`}
                </span>
              </div>
            );
          })}
        </div>

        {writable ? (
          <div style={{ display: "flex", gap: 8 }}>
            {status === "connected" ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={disconnect.isPending}
                onClick={() => {
                  disconnect.mutate(channel.channel, {
                    onSuccess: () =>
                      toast.success(`${name} disconnected`, {
                        description: "Mappings are kept and paused.",
                      }),
                  });
                }}
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={connect.isPending}
                onClick={() => {
                  connect.mutate(channel.channel, {
                    onSuccess: () => toast.success(`${name} connected`),
                  });
                }}
              >
                Connect {name}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ListingRow({
  listing,
  writable,
}: {
  listing: ChannelListingRow;
  writable: boolean;
}) {
  const sync = useSyncListing();
  const unmap = useUnmapListing();

  return (
    <tr>
      <td>
        <div style={{ font: "600 13px/1.3 var(--font-sans)" }}>{listing.condo.name}</div>
        <div className="t-caption">{listing.condo.code}</div>
      </td>
      <td>
        <div style={{ font: "500 13px/1.3 var(--font-sans)" }}>
          {listing.external_listing_id}
        </div>
        {!listing.credentials_readable ? (
          <div className="t-caption" style={{ color: "var(--danger)" }}>
            Saved URL unreadable — re-map this listing.
          </div>
        ) : null}
      </td>
      <td>
        <StatusPill status={listing.status} />
        {listing.last_error ? (
          <div className="t-caption" style={{ color: "var(--danger)", marginTop: 4 }}>
            {listing.last_error}
            {listing.consecutive_failures > 1
              ? ` (${listing.consecutive_failures} attempts)`
              : ""}
          </div>
        ) : null}
      </td>
      <td className="t-small">{when(listing.last_success_at)}</td>
      <td>
        <CopyableFeed url={listing.feed_url} />
      </td>
      {writable ? (
        <td>
          <div className="actions" style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={sync.isPending}
              onClick={() => {
                sync.mutate(listing.id, {
                  onSuccess: (result) => {
                    const { outcome } = result;
                    if (outcome.status === "failed") {
                      toast.error("Sync failed", { description: outcome.message });
                      return;
                    }
                    toast.success(`${listing.condo.name} synced`, {
                      description: outcome.conflicts
                        ? `${outcome.message} Open the calendar to settle the clash.`
                        : outcome.message,
                    });
                  },
                  onError: (error) =>
                    toast.error("Could not sync", {
                      description:
                        error instanceof ApiError ? error.message : "Try again shortly.",
                    }),
                });
              }}
            >
              {sync.isPending ? "Syncing…" : listing.status === "error" ? "Retry" : "Sync now"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={unmap.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Stop syncing ${listing.condo.name}? Imported bookings stay as manual blocks.`,
                  )
                ) {
                  return;
                }
                unmap.mutate(listing.id, {
                  onSuccess: () => toast.success("Listing unmapped"),
                });
              }}
            >
              Unmap
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

export function ChannelsScreen() {
  const { data, isLoading } = useChannels();
  const can = useCan();
  const writable = can("channel:write");
  const [mapping, setMapping] = useState(false);

  const connections = data?.connections ?? [];
  const listings = data?.listings ?? [];
  const available = data?.available_channels ?? [];
  const anyConnected = available.some((channel) => channel.connected);

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Channels</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            Keep Airbnb and this system from selling the same night twice.
          </div>
        </div>
        {writable && anyConnected ? (
          <button type="button" className="btn btn-primary" onClick={() => setMapping(true)}>
            Map a listing
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="card ls-shimmer" style={{ height: 220 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            {available.map((channel) => (
              <ConnectionCard
                key={channel.channel}
                channel={channel}
                connection={connections.find((c) => c.channel === channel.channel)}
                writable={writable}
              />
            ))}
          </div>

          <div className="table-card">
            <div className="card-head">
              <div className="card-title">Mapped listings</div>
              <span className="t-caption">{listings.length} mapped</span>
            </div>
            {listings.length === 0 ? (
              <div className="empty">
                <div style={{ font: "600 15px/1.3 var(--font-sans)" }}>Nothing mapped yet</div>
                <div className="t-small" style={{ marginTop: 6 }}>
                  {anyConnected
                    ? "Map a condo to an Airbnb listing to start syncing its calendar."
                    : "Connect a channel first."}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Condo</th>
                      <th>Listing</th>
                      <th>Status</th>
                      <th>Last synced</th>
                      <th>Our feed URL (paste into the channel)</th>
                      {writable ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((listing) => (
                      <ListingRow key={listing.id} listing={listing} writable={writable} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <SyncLogTable />
        </div>
      )}

      {mapping ? (
        <MapListingModal open={mapping} onClose={() => setMapping(false)} />
      ) : null}
    </section>
  );
}
