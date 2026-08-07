"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";

import { CloseIcon, EditIcon, TrashIcon } from "@/components/layout/icons";
import { useCan } from "@/components/providers/Providers";
import { STATUS_META, groupBaht, specLine } from "@/features/condos/display";
import type { Condo } from "@/types/api";

/**
 * Quick-view drawer — design lines 1611–1681.
 *
 * The financial summary the design shows (revenue, expenses, net, occupancy)
 * needs bookings and expenses, so it arrives in Phase 3. Showing zeros here
 * would read as "this condo earned nothing" rather than "not measured yet".
 */
export function CondoDetailDrawer({
  condo,
  onClose,
  onEdit,
  onDelete,
}: {
  condo: Condo | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const can = useCan();
  const meta = condo ? STATUS_META[condo.status] : null;

  return (
    <Dialog.Root open={Boolean(condo)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 82,
            background: "rgba(30,27,75,.4)",
            backdropFilter: "blur(6px)",
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            zIndex: 83,
            width: 440,
            maxWidth: "92vw",
            height: "100%",
            background: "var(--surface)",
            boxShadow: "var(--shadow-xl)",
            display: "flex",
            flexDirection: "column",
            animation: "lsSlide 280ms var(--ease-out) both",
          }}
          aria-describedby={undefined}
        >
          {condo && meta ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "22px 24px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <span className={meta.pill}>
                    <span className="dot" />
                    {meta.label}
                  </span>
                  <Dialog.Title
                    style={{
                      font: "700 20px/1.25 var(--font-sans)",
                      color: "var(--fg)",
                      letterSpacing: "-.01em",
                      marginTop: 10,
                    }}
                  >
                    {condo.name}
                  </Dialog.Title>
                  <div className="t-small" style={{ marginTop: 4 }}>
                    {condo.code} · {specLine(condo)}
                  </div>
                </div>
                <Dialog.Close className="modal-close" aria-label="Close">
                  <CloseIcon size={17} />
                </Dialog.Close>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "22px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                {condo.images.length > 0 ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {condo.images.map((image) => (
                      <div
                        key={image.id}
                        style={{
                          width: 118,
                          height: 84,
                          borderRadius: 12,
                          border: "1px solid var(--line)",
                          background: `center/cover no-repeat url(${image.url})`,
                        }}
                      />
                    ))}
                  </div>
                ) : null}

                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  <Row label="Rate per night" value={condo.night_rate_label} />
                  <Row label="Rate per month" value={condo.month_rate_label} />
                  <Row label="Cleaning fee" value={`฿${groupBaht(condo.cleaning_fee)}`} />
                  <Row label="Security deposit" value={`฿${groupBaht(condo.security_deposit)}`} />
                </div>

                {condo.address ? (
                  <div
                    style={{
                      padding: 14,
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                    }}
                  >
                    <div className="t-caption">Address</div>
                    <div
                      style={{
                        font: "500 13px/1.6 var(--font-sans)",
                        color: "var(--fg-2)",
                        marginTop: 6,
                      }}
                    >
                      {condo.address}
                    </div>
                  </div>
                ) : null}

                {condo.description ? (
                  <div>
                    <div className="t-eyebrow" style={{ marginBottom: 8 }}>
                      Notes
                    </div>
                    <div style={{ font: "400 13px/1.6 var(--font-sans)", color: "var(--fg-2)" }}>
                      {condo.description}
                    </div>
                  </div>
                ) : null}

                <div
                  style={{
                    padding: "12px 14px",
                    background: "var(--brand-purple-50)",
                    borderRadius: 12,
                  }}
                >
                  <div className="t-caption" style={{ color: "var(--brand-purple-700)" }}>
                    Financials
                  </div>
                  <div
                    style={{
                      font: "500 13px/1.5 var(--font-sans)",
                      color: "var(--fg-2)",
                      marginTop: 4,
                    }}
                  >
                    Revenue, expenses and occupancy appear once bookings and expenses exist.
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "16px 24px",
                  borderTop: "1px solid var(--line)",
                  background: "var(--surface-2)",
                }}
              >
                <Link
                  className="btn btn-outline"
                  style={{ flex: 1, justifyContent: "center" }}
                  // App Router Links need the resolved path; typedRoutes cannot
                  // narrow a runtime id, hence the cast.
                  href={`/condos/${condo.id}` as never}
                >
                  Open full page
                </Link>
                {can("condo:write") ? (
                  <button className="btn btn-outline" onClick={onEdit}>
                    <EditIcon />
                    Edit
                  </button>
                ) : null}
                {can("condo:delete") ? (
                  <button
                    className="btn btn-outline"
                    style={{
                      color: "var(--danger)",
                      borderColor: "var(--danger-border)",
                      background: "var(--danger-bg)",
                    }}
                    onClick={onDelete}
                    aria-label={`Remove ${condo.name}`}
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ font: "500 13px/1.4 var(--font-sans)", color: "var(--fg-3)" }}>{label}</span>
      <span style={{ font: "600 13px/1.4 var(--font-sans)", color: "var(--fg)" }}>{value}</span>
    </div>
  );
}

