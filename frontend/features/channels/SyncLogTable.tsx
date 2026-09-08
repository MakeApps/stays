"use client";

import { useChannelLogs } from "@/features/channels/api";
import type { ChannelSyncLogRow } from "@/types/api";

const TONE: Record<ChannelSyncLogRow["status"], string> = {
  success: "ok",
  failed: "dgr",
  skipped: "neutral",
};

const ARROW: Record<ChannelSyncLogRow["direction"], string> = {
  inbound: "Channel → Stays",
  outbound: "Stays → Channel",
};

function stamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Brief §8. Every attempt, successful or not.
 *
 * The item counts are the reason this is worth reading: a column of "SUCCESS"
 * with nothing beside it cannot tell you whether the integration is working or
 * quietly doing nothing at all.
 */
export function SyncLogTable({ listingId = null }: { listingId?: string | null }) {
  const { data, isLoading } = useChannelLogs(listingId);
  const rows = data?.items ?? [];

  return (
    <div className="table-card">
      <div className="card-head">
        <div className="card-title">Sync log</div>
        <span className="t-caption">Most recent first</span>
      </div>

      {isLoading ? (
        <div className="ls-shimmer" style={{ height: 120 }} />
      ) : rows.length === 0 ? (
        <div className="empty">
          <div style={{ font: "600 15px/1.3 var(--font-sans)" }}>No syncs yet</div>
          <div className="t-small" style={{ marginTop: 6 }}>
            Runs appear here as soon as a listing is mapped and polled.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Condo</th>
                <th>Type</th>
                <th>Direction</th>
                <th>Result</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="t-small" style={{ whiteSpace: "nowrap" }}>
                    {stamp(row.when)}
                  </td>
                  <td className="t-small">{row.condo_label ?? "—"}</td>
                  <td className="t-small" style={{ textTransform: "capitalize" }}>
                    {row.sync_type}
                  </td>
                  <td className="t-small" style={{ whiteSpace: "nowrap" }}>
                    {ARROW[row.direction]}
                  </td>
                  <td>
                    <span className={`pill ${TONE[row.status]}`}>
                      <span className="dot" />
                      {row.status}
                    </span>
                    {row.retry_count > 0 ? (
                      <span className="t-caption" style={{ marginLeft: 6 }}>
                        retry {row.retry_count}
                      </span>
                    ) : null}
                  </td>
                  <td className="t-small">{row.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
