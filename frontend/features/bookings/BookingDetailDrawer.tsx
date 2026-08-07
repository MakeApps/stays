"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { toast } from "sonner";

import { CloseIcon, EditIcon, TrashIcon } from "@/components/layout/icons";
import { useCan } from "@/components/providers/Providers";
import { PAY_META } from "@/features/bookings/BookingsScreen";
import { useDeleteBooking } from "@/features/bookings/api";
import { ApiError } from "@/services/http";
import type { Booking } from "@/types/api";

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Booking detail drawer — design lines 1382–1445. */
export function BookingDetailDrawer({
  booking,
  onClose,
  onEdit,
}: {
  booking: Booking | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const can = useCan();
  const remove = useDeleteBooking();
  const [confirming, setConfirming] = useState(false);

  async function confirmDelete() {
    if (!booking) return;
    try {
      await remove.mutateAsync(booking.id);
      toast.success("Booking deleted", {
        description: `${booking.guest_name} removed · those dates are open again.`,
      });
      setConfirming(false);
      onClose();
    } catch (error) {
      toast.error("Could not delete", {
        description: error instanceof ApiError ? error.message : "Please try again.",
      });
    }
  }

  const pay = booking ? PAY_META[booking.payment_status] : null;
  const owing = booking ? Number(booking.balance) > 0 : false;

  return (
    <>
      <Dialog.Root open={Boolean(booking)} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
              background: "rgba(30,27,75,.4)",
              backdropFilter: "blur(6px)",
            }}
          />
          <Dialog.Content
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              zIndex: 81,
              width: 420,
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
            {booking && pay ? (
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
                    <span className={pay.pill}>{pay.label}</span>
                    <Dialog.Title
                      style={{
                        font: "700 20px/1.25 var(--font-sans)",
                        color: "var(--fg)",
                        letterSpacing: "-.01em",
                        marginTop: 10,
                      }}
                    >
                      {booking.guest_name}
                    </Dialog.Title>
                    <div className="t-small" style={{ marginTop: 4 }}>
                      {booking.condo_name} · {booking.condo_code}
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
                  <div style={{ display: "flex", gap: 12 }}>
                    <Box label="Check-in" value={dayLabel(booking.check_in)} />
                    <Box label="Check-out" value={dayLabel(booking.check_out)} />
                    <div
                      style={{
                        flex: "0 0 76px",
                        padding: 14,
                        background: "var(--brand-purple-50)",
                        borderRadius: 12,
                        textAlign: "center",
                      }}
                    >
                      <div className="t-caption" style={{ color: "var(--brand-purple-700)" }}>
                        Nights
                      </div>
                      <div
                        style={{
                          font: "700 17px/1.2 var(--font-sans)",
                          color: "var(--brand-purple-700)",
                          marginTop: 5,
                        }}
                      >
                        {booking.nights}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <Row label="Night rate" value={booking.night_rate_label} />
                    <Row label="Total amount" value={booking.total_label} strong />
                    <Row label="Received" value={`฿${group(booking.received)}`} tone="success" />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingTop: 11,
                        borderTop: "1px solid var(--line)",
                      }}
                    >
                      <span style={{ font: "600 14px/1.4 var(--font-sans)", color: "var(--fg)" }}>
                        Balance
                      </span>
                      <span
                        style={{
                          font: "700 15px/1.4 var(--font-sans)",
                          color: owing ? "var(--warning)" : "var(--success)",
                        }}
                      >
                        {booking.balance_label}
                      </span>
                    </div>
                  </div>

                  {booking.guest_phone || booking.guest_email ? (
                    <div
                      style={{
                        padding: 14,
                        background: "var(--surface-2)",
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                      }}
                    >
                      <div className="t-caption">Contact</div>
                      <div
                        style={{
                          font: "500 13px/1.6 var(--font-sans)",
                          color: "var(--fg-2)",
                          marginTop: 6,
                        }}
                      >
                        {booking.guest_phone}
                        {booking.guest_phone && booking.guest_email ? <br /> : null}
                        {booking.guest_email}
                      </div>
                    </div>
                  ) : null}

                  {booking.notes ? (
                    <div>
                      <div className="t-eyebrow" style={{ marginBottom: 8 }}>
                        Notes
                      </div>
                      <div
                        style={{ font: "400 13px/1.6 var(--font-sans)", color: "var(--fg-2)" }}
                      >
                        {booking.notes}
                      </div>
                    </div>
                  ) : null}
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
                  {can("booking:write") ? (
                    <button
                      className="btn btn-outline"
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={onEdit}
                    >
                      <EditIcon />
                      Edit booking
                    </button>
                  ) : null}
                  {can("booking:delete") ? (
                    <button
                      className="btn btn-outline"
                      style={{
                        color: "var(--danger)",
                        borderColor: "var(--danger-border)",
                        background: "var(--danger-bg)",
                      }}
                      onClick={() => setConfirming(true)}
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="modal-bg" style={{ zIndex: 120 }} />
          {/* Centred by the wrapper: lsPop animates transform and would cancel
              a translate-based centring. */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 121,
              display: "grid",
              placeItems: "center",
              padding: 20,
              pointerEvents: "none",
            }}
          >
            <AlertDialog.Content
              className="modal"
              style={{
                maxWidth: 420,
                pointerEvents: "auto",
                animation: "lsPop 240ms var(--ease-out) both",
              }}
            >
              <div style={{ padding: "26px 26px 20px", textAlign: "center" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  <TrashIcon size={22} />
                </div>
                <AlertDialog.Title
                  style={{ font: "700 18px/1.3 var(--font-sans)", color: "var(--fg)", margin: 0 }}
                >
                  Delete this booking?
                </AlertDialog.Title>
                <AlertDialog.Description
                  className="t-small"
                  style={{ margin: "8px auto 0", maxWidth: 300 }}
                >
                  This removes the booking and its payment record. The dates open back up
                  immediately.
                </AlertDialog.Description>
              </div>
              <div
                className="modal-foot"
                style={{
                  justifyContent: "center",
                  background: "var(--surface)",
                  borderTop: 0,
                  paddingBottom: 24,
                }}
              >
                <AlertDialog.Cancel className="btn btn-outline">Keep it</AlertDialog.Cancel>
                <button
                  className="btn"
                  style={{ background: "var(--danger)", color: "#fff" }}
                  onClick={confirmDelete}
                  disabled={remove.isPending}
                >
                  {remove.isPending ? "Deleting…" : "Delete booking"}
                </button>
              </div>
            </AlertDialog.Content>
          </div>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: 14,
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        borderRadius: 12,
      }}
    >
      <div className="t-caption">{label}</div>
      <div style={{ font: "600 15px/1.2 var(--font-sans)", color: "var(--fg)", marginTop: 5 }}>
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "success";
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ font: "500 13px/1.4 var(--font-sans)", color: "var(--fg-3)" }}>{label}</span>
      <span
        style={{
          font: "600 14px/1.4 var(--font-sans)",
          color: tone === "success" ? "var(--success)" : strong ? "var(--fg)" : "var(--fg-2)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function group(amount: string): string {
  return Math.round(Number(amount)).toLocaleString("en-US");
}
