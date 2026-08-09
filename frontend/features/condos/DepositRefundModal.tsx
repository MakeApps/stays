"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CloseIcon } from "@/components/layout/icons";
import { useRefundDeposit } from "@/features/condos/api";
import { ApiError } from "@/services/http";
import type { Condo } from "@/types/api";

const money = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,8}(\.\d{1,2})?$/.test(v), "Use a number like 45000");

const schema = z
  .object({
    refund_date: z.string().trim().min(1, "When did the money come back?"),
    refunded_amount: money,
    deducted_amount: money,
    deduction_reason: z.string().trim().max(255),
    notes: z.string().trim().max(5000),
  })
  .refine((v) => Number(v.refunded_amount || 0) > 0 || Number(v.deducted_amount || 0) > 0, {
    path: ["refunded_amount"],
    message: "Record a refunded amount, a deduction, or both",
  })
  // A deduction with no reason is the entry nobody can explain six months
  // later, which is the entire reason for keeping a ledger.
  .refine((v) => !(Number(v.deducted_amount || 0) > 0) || v.deduction_reason.length > 0, {
    path: ["deduction_reason"],
    message: "Say what the deduction was for",
  });

type Values = z.infer<typeof schema>;

/** Recovering the deposit when a lease ends. */
export function DepositRefundModal({
  condo,
  open,
  onClose,
}: {
  condo: Condo;
  open: boolean;
  onClose: () => void;
}) {
  const refund = useRefundDeposit(condo.id);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      refund_date: "",
      refunded_amount: "",
      deducted_amount: "",
      deduction_reason: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        // Pre-filled with the full outstanding balance: recovering all of it
        // is the ordinary case, and a deduction is the exception.
        refund_date: new Date().toISOString().slice(0, 10),
        refunded_amount: condo.deposit_outstanding,
        deducted_amount: "",
        deduction_reason: "",
        notes: "",
      });
    }
  }, [open, condo.deposit_outstanding, reset]);

  const refunded = Number(watch("refunded_amount") || 0);
  const deducted = Number(watch("deducted_amount") || 0);
  const outstanding = Number(condo.deposit_outstanding);
  const remaining = outstanding - refunded - deducted;

  async function onSubmit(values: Values) {
    try {
      await refund.mutateAsync({
        refund_date: values.refund_date,
        refunded_amount: values.refunded_amount || "0",
        deducted_amount: values.deducted_amount || "0",
        deduction_reason: values.deduction_reason || null,
        notes: values.notes || null,
      });
      toast.success("Deposit recorded", {
        description: `฿${refunded.toLocaleString("en-US")} recovered from ${condo.name}'s owner.`,
      });
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, messages] of Object.entries(error.fields)) {
          if (messages[0]) setError(field as keyof Values, { message: messages[0] });
        }
        toast.error("Could not record that", { description: error.message });
        return;
      }
      throw error;
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            padding: 20,
            pointerEvents: "none",
          }}
        >
          <Dialog.Content
            className="modal"
            style={{
              maxWidth: 520,
              pointerEvents: "auto",
              animation: "lsPop 280ms var(--ease-out) both",
            }}
            aria-describedby="refund-hint"
          >
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "contents" }}>
              <div className="modal-head">
                <div>
                  <Dialog.Title asChild>
                    <h2>Mark deposit as refunded</h2>
                  </Dialog.Title>
                  <div className="t-caption" style={{ marginTop: 4 }} id="refund-hint">
                    {condo.deposit_outstanding_label} of {condo.security_deposit_label} is still
                    held by {condo.name}&rsquo;s owner.
                  </div>
                </div>
                <Dialog.Close className="modal-close" aria-label="Close">
                  <CloseIcon size={17} />
                </Dialog.Close>
              </div>

              <div className="modal-body">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                    gap: 14,
                  }}
                >
                  <Field label="Refund date" error={errors.refund_date?.message}>
                    <input type="date" {...register("refund_date")} />
                  </Field>

                  <Field label="Refunded amount (฿)" error={errors.refunded_amount?.message}>
                    <input placeholder="45000" inputMode="decimal" {...register("refunded_amount")} />
                  </Field>

                  <Field
                    label="Deduction (฿)"
                    error={errors.deducted_amount?.message}
                    hint="What the owner withheld."
                  >
                    <input placeholder="5000" inputMode="decimal" {...register("deducted_amount")} />
                  </Field>

                  <Field label="Deduction reason" error={errors.deduction_reason?.message}>
                    <input placeholder="Wall repair" {...register("deduction_reason")} />
                  </Field>

                  <Field label="Notes" span>
                    <textarea rows={2} placeholder="Anything worth remembering." {...register("notes")} />
                  </Field>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: remaining < 0 ? "var(--danger-bg)" : "var(--surface-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Row label="Deposit outstanding" value={`฿${outstanding.toLocaleString("en-US")}`} />
                  <Row label="Recovering now" value={`฿${(refunded + deducted).toLocaleString("en-US")}`} />
                  <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
                  <Row
                    label={remaining < 0 ? "Over-recovered" : "Still held after this"}
                    value={`฿${Math.abs(remaining).toLocaleString("en-US")}`}
                    strong
                    tone={remaining < 0 ? "var(--danger)" : undefined}
                  />
                  {deducted > 0 ? (
                    <div className="t-caption" style={{ marginTop: 8 }}>
                      Only the ฿{deducted.toLocaleString("en-US")} deduction is a real loss. The
                      refunded portion is capital returning to the business, not income.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || remaining < 0}
                >
                  {isSubmitting ? "Recording…" : "Record refund"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  error,
  hint,
  span,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field" style={span ? { gridColumn: "1/-1" } : undefined}>
      <label>{label}</label>
      {children}
      {error ? <small className="error">{error}</small> : hint ? <small>{hint}</small> : null}
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
  tone?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
      <span className="t-caption">{label}</span>
      <span
        style={{
          font: `${strong ? 700 : 600} 13px/1.3 var(--font-sans)`,
          color: tone ?? "var(--fg)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
