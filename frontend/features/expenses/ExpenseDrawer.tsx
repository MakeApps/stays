"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CloseIcon, PlusIcon } from "@/components/layout/icons";
import { useCondos } from "@/features/condos/api";
import {
  useCreateExpense,
  useLookups,
  useUpdateExpense,
  useUploadReceipt,
} from "@/features/expenses/api";
import { todayISO } from "@/lib/booking-math";
import { ApiError } from "@/services/http";
import type { Expense } from "@/types/api";

interface State {
  condo_id: string;
  category_id: string;
  method_id: string;
  spent_on: string;
  amount: string;
  vendor: string;
  reference: string;
  description: string;
  status: string;
  notes: string;
}

const EMPTY: State = {
  condo_id: "",
  category_id: "",
  method_id: "",
  spent_on: todayISO(),
  amount: "",
  vendor: "",
  reference: "",
  description: "",
  status: "paid",
  notes: "",
};

/** Add/edit expense drawer — design lines 1447–1554. */
export function ExpenseDrawer({
  open,
  expense,
  onClose,
}: {
  open: boolean;
  expense: Expense | null;
  onClose: () => void;
}) {
  const editing = Boolean(expense);
  const [form, setForm] = useState<State>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: lookups } = useLookups();
  const { data: condoData } = useCondos({ per_page: 100, sort: "name" });
  const create = useCreateExpense();
  const update = useUpdateExpense(expense?.id ?? "");
  const upload = useUploadReceipt(expense?.id ?? "");

  const set = (patch: Partial<State>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        condo_id: expense.condo_id,
        category_id: expense.category_id,
        method_id: expense.method_id,
        spent_on: expense.spent_on,
        amount: expense.amount,
        vendor: expense.vendor ?? "",
        reference: expense.reference ?? "",
        description: expense.description,
        status: expense.status,
        notes: expense.notes ?? "",
      });
    } else {
      setForm({
        ...EMPTY,
        condo_id: condoData?.items[0]?.id ?? "",
        category_id: lookups?.categories[0]?.id ?? "",
        method_id: lookups?.methods[0]?.id ?? "",
      });
    }
    setErrors({});
  }, [open, expense, condoData, lookups]);

  async function save() {
    const next: Record<string, string> = {};
    if (!form.description.trim()) next.description = "Say what this expense was for.";
    if (!Number(form.amount)) next.amount = "Every expense needs an amount.";
    if (!form.condo_id) next.condo_id = "Choose a condo.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload = {
      condo_id: form.condo_id,
      category_id: form.category_id,
      method_id: form.method_id,
      spent_on: form.spent_on,
      amount: form.amount,
      description: form.description.trim(),
      vendor: form.vendor || null,
      reference: form.reference || null,
      status: form.status,
      notes: form.notes || null,
    };

    try {
      const saved = expense
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload);
      toast.success(editing ? "Expense updated" : "Expense saved", {
        description: `${saved.category} · ${saved.amount_label} · ${saved.condo_name}`,
      });
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields: Record<string, string> = {};
        for (const [key, messages] of Object.entries(error.fields)) {
          if (messages[0]) fields[key] = messages[0];
        }
        setErrors(fields);
        if (Object.keys(fields).length === 0) {
          toast.error("Could not save", { description: error.message });
        }
        return;
      }
      toast.error("Could not save", { description: "The server did not respond." });
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file || !expense) return;
    try {
      await upload.mutateAsync(file);
      toast.success("Receipt attached", { description: file.name });
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof ApiError ? error.message : file.name,
      });
    }
  }

  const saving = create.isPending || update.isPending;
  const amountPreview = Number(form.amount || 0);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(30,27,75,.4)",
            backdropFilter: "blur(6px)",
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            zIndex: 91,
            width: 480,
            maxWidth: "94vw",
            height: "100%",
            background: "var(--surface)",
            boxShadow: "var(--shadow-xl)",
            display: "flex",
            flexDirection: "column",
            animation: "lsSlide 280ms var(--ease-out) both",
          }}
          aria-describedby="expense-hint"
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              padding: "20px 24px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div>
              <Dialog.Title
                style={{
                  font: "700 20px/1.2 var(--font-sans)",
                  margin: 0,
                  letterSpacing: "-.01em",
                }}
              >
                {editing ? "Edit expense" : "Add expense"}
              </Dialog.Title>
              <div className="t-caption" style={{ marginTop: 4 }} id="expense-hint">
                Attach the receipt now and you&apos;ll never hunt for it later.
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
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 14,
              }}
            >
              <Field label="Expense date">
                <input
                  type="date"
                  value={form.spent_on}
                  onChange={(e) => set({ spent_on: e.target.value })}
                  style={{ height: 44 }}
                />
              </Field>

              <Field label="Amount (฿)" error={errors.amount}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "11px 12px",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 8,
                    background: "var(--surface)",
                  }}
                >
                  <span style={{ font: "500 14px/1 var(--font-sans)", color: "var(--fg-3)" }}>
                    ฿
                  </span>
                  <input
                    value={form.amount}
                    onChange={(e) => set({ amount: e.target.value })}
                    placeholder="0"
                    inputMode="decimal"
                    style={{
                      border: 0,
                      outline: 0,
                      background: "transparent",
                      padding: 0,
                      width: "100%",
                      font: "700 15px/1 var(--font-sans)",
                      color: "var(--fg)",
                    }}
                  />
                </div>
              </Field>

              <Field label="Select condo" span error={errors.condo_id}>
                <select
                  value={form.condo_id}
                  onChange={(e) => set({ condo_id: e.target.value })}
                  style={{ height: 44 }}
                >
                  {(condoData?.items ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Expense category">
                <select
                  value={form.category_id}
                  onChange={(e) => set({ category_id: e.target.value })}
                  style={{ height: 44 }}
                >
                  {(lookups?.categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Payment method">
                <select
                  value={form.method_id}
                  onChange={(e) => set({ method_id: e.target.value })}
                  style={{ height: 44 }}
                >
                  {(lookups?.methods ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Vendor">
                <input
                  value={form.vendor}
                  onChange={(e) => set({ vendor: e.target.value })}
                  placeholder="e.g. MEA, Khun Malee"
                />
              </Field>

              <Field label="Reference number">
                <input
                  value={form.reference}
                  onChange={(e) => set({ reference: e.target.value })}
                  placeholder="INV-4471"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
                />
              </Field>

              <Field label="Description" span error={errors.description}>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="What was this for?"
                />
              </Field>

              <div className="field" style={{ gridColumn: "1/-1" }}>
                <label>Receipt</label>
                {editing ? (
                  <>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        void handleFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => fileInput.current?.click()}
                      style={{
                        position: "relative",
                        borderRadius: 12,
                        border: `1.5px dashed ${dragging ? "var(--brand-purple)" : "var(--line-strong)"}`,
                        background: dragging ? "var(--brand-purple-50)" : "var(--surface-2)",
                        padding: 14,
                        cursor: "pointer",
                        transition: "all 120ms var(--ease-out)",
                      }}
                    >
                      {expense?.receipt_url ? (
                        <ReceiptPreview
                          url={expense.receipt_url}
                          type={expense.receipt_content_type}
                          name={expense.receipt_filename}
                        />
                      ) : (
                        <div style={{ textAlign: "center", padding: "24px 0" }}>
                          <div style={{ color: "var(--brand-purple)", marginBottom: 6 }}>
                            <PlusIcon size={18} />
                          </div>
                          <div className="t-caption">
                            {upload.isPending
                              ? "Uploading…"
                              : "Drag a receipt here, or click to browse (JPG, PNG, WebP or PDF)"}
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      hidden
                      onChange={(e) => {
                        void handleFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </>
                ) : (
                  <small>Save the expense first, then a receipt can be attached.</small>
                )}
              </div>

              <Field label="Status" span>
                <select
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value })}
                  style={{ height: 44 }}
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "16px 24px",
              borderTop: "1px solid var(--line)",
              background: "var(--surface-2)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-caption">Total</div>
              <div
                style={{
                  font: "700 18px/1.2 var(--font-sans)",
                  color: "var(--fg)",
                  marginTop: 2,
                }}
              >
                ฿{Math.round(amountPreview).toLocaleString("en-US")}
              </div>
            </div>
            <button className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save expense"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** PDF receipts preview in an iframe; images render directly. */
function ReceiptPreview({
  url,
  type,
  name,
}: {
  url: string;
  type: string | null;
  name: string | null;
}) {
  const isPdf = type === "application/pdf";
  return (
    <div>
      <div
        style={{
          height: 160,
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--bg-alt)",
          border: "1px solid var(--line)",
        }}
      >
        {isPdf ? (
          <iframe src={url} title={name ?? "Receipt"} style={{ width: "100%", height: "100%", border: 0 }} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `center/contain no-repeat url(${url})`,
            }}
          />
        )}
      </div>
      <div className="t-caption" style={{ marginTop: 8, textAlign: "center" }}>
        {name ?? "Receipt"} · click to replace
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  span,
  children,
}: {
  label: string;
  error?: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="field" style={span ? { gridColumn: "1/-1" } : undefined}>
      <label>{label}</label>
      {children}
      {error ? <small className="error">{error}</small> : null}
    </div>
  );
}
