"use client";

import Link from "next/link";

import { useChannels } from "@/features/channels/api";

function when(value: string | null): string {
  if (!value) return "never";
  const at = new Date(value);
  const mins = Math.round((Date.now() - at.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Brief §7's dashboard section, compressed to what is worth interrupting for.
 *
 * Deliberately not a copy of the Channels screen. What belongs on a dashboard
 * is the exception — a listing that has stopped syncing — and the reassurance
 * that everything else is current. Detail lives one click away.
 *
 * Renders nothing at all when no channel has ever been connected, rather than
 * occupying a slot to say "not set up".
 */
export function ChannelDashboardCard() {
  const { data } = useChannels();

  const connections = data?.connections ?? [];
  const listings = data?.listings ?? [];
  if (connections.length === 0) return null;

  const failing = listings.filter((l) => l.status === "error" || l.last_error);
  const lastSuccess = listings
    .map((l) => l.last_success_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  return (
    <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
      <div className="card-head">
        <h3 className="card-title">Channels</h3>
        <Link href="/channels" className="t-caption" style={{ color: "var(--brand-purple)" }}>
          Manage
        </Link>
      </div>

      <div style={{ padding: "16px 18px 18px" }}>
        {failing.length > 0 ? (
          <>
            <div className="pill dgr" style={{ marginBottom: 12 }}>
              <span className="dot" />
              {failing.length} listing{failing.length === 1 ? "" : "s"} not syncing
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {failing.slice(0, 3).map((listing) => (
                <div key={listing.id}>
                  <div style={{ font: "600 13px/1.3 var(--font-sans)" }}>
                    {listing.condo.name}
                  </div>
                  <div className="t-caption" style={{ color: "var(--danger)" }}>
                    {listing.last_error ?? "Sync failed."}
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/channels"
              className="btn btn-outline btn-sm"
              style={{ marginTop: 14, display: "inline-flex" }}
            >
              View details
            </Link>
          </>
        ) : (
          <>
            <div className="pill ok" style={{ marginBottom: 12 }}>
              <span className="dot" />
              {listings.length === 0
                ? "Connected, nothing mapped"
                : `${listings.length} listing${listings.length === 1 ? "" : "s"} syncing`}
            </div>
            <div className="t-small">
              {listings.length === 0
                ? "Map a condo to an Airbnb listing to start syncing its calendar."
                : `Last successful sync ${when(lastSuccess ?? null)}.`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
