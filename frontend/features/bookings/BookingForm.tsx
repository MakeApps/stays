"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CheckIcon } from "@/components/layout/icons";
import { useCondos } from "@/features/condos/api";
import {
  useAvailability,
  useBooking,
  useCreateBooking,
  useUpdateBooking,
} from "@/features/bookings/api";
import { addDays, computeQuote, formatTHB, toMajor, todayISO } from "@/lib/booking-math";
import { ApiError } from "@/services/http";
import type { BookingConflict } from "@/types/api";

interface FormState {
  condo_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  mode: "nightly" | "total";
  night_rate: string;
  total_manual: string;
  discount: string;
  cleaning_fee: string;
  other_charges: string;
  tax_pct: string;
  received: string;
  status: string;
  notes: string;
}

function initialState(): FormState {
  const today = todayISO();
  return {
    condo_id: "",
    guest_name: "",
    guest_phone: "",
    guest_email: "",
    check_in: today,
    check_out: addDays(today, 5),
    mode: "nightly",
    night_rate: "",
    total_manual: "",
    discount: "0",
    cleaning_fee: "500",
    other_charges: "0",
    tax_pct: "7",
    received: "0",
    status: "booked",
    notes: "",
  };
}

/** Booking form — design lines 506–737. */
export function BookingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");

  const [form, setForm] = useState<FormState>(initialState);
  const [touched, setTouched] = useState(false);

  const { data: condoData } = useCondos({ per_page: 100, sort: "name" });
  const condos = useMemo(() => condoData?.items ?? [], [condoData]);

  const { data: existing } = useBooking(editId);
  const create = useCreateBooking();
  const update = useUpdateBooking(editId ?? "");

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  // Seed the condo once the list arrives, matching the design's default.
  useEffect(() => {
    if (!form.condo_id && condos.length > 0 && !editId) {
      const first = condos[0]!;
      set({
        condo_id: first.id,
        night_rate: first.night_rate,
        cleaning_fee: first.cleaning_fee,
      });
    }
  }, [condos, form.condo_id, editId]);

  useEffect(() => {
    if (!existing) return;
    setForm({
      condo_id: existing.condo_id,
      guest_name: existing.guest_name,
      guest_phone: existing.guest_phone ?? "",
      guest_email: existing.guest_email ?? "",
      check_in: existing.check_in,
      check_out: existing.check_out,
      mode: existing.pricing_mode,
      night_rate: existing.night_rate,
      total_manual: existing.subtotal,
      discount: existing.discount,
      cleaning_fee: existing.cleaning_fee,
      other_charges: existing.other_charges,
      tax_pct: existing.tax_pct,
      received: existing.received,
      status: existing.status,
      notes: existing.notes ?? "",
    });
  }, [existing]);

  const quote = useMemo(
    () =>
      computeQuote({
        checkIn: form.check_in,
        checkOut: form.check_out,
        mode: form.mode,
        nightRate: form.night_rate,
        totalManual: form.total_manual,
        discount: form.discount,
        cleaningFee: form.cleaning_fee,
        otherCharges: form.other_charges,
        taxPct: form.tax_pct,
        received: form.received,
      }),
    [form],
  );

  const { data: availability } = useAvailability({
    condoId: form.condo_id,
    checkIn: form.check_in,
    checkOut: form.check_out,
    excludeId: editId ?? undefined,
    enabled: Boolean(form.condo_id) && quote.nights > 0,
  });
  const conflict: BookingConflict | null = availability?.conflict ?? null;

  const selectedCondo = condos.find((c) => c.id === form.condo_id);
  const nightly = form.mode === "nightly";
  const saving = create.isPending || update.isPending;

  function onCondoChange(id: string) {
    const condo = condos.find((c) => c.id === id);
    // Matches the design (line 2364): picking a condo seeds its rate and fee.
    set({
      condo_id: id,
      night_rate: condo?.night_rate ?? form.night_rate,
      cleaning_fee: condo?.cleaning_fee ?? form.cleaning_fee,
    });
  }

  function switchMode(mode: "nightly" | "total") {
    // Design line 2371: entering total mode pre-fills with the current
    // subtotal, otherwise the field goes blank and the user loses their number.
    if (mode === "total") set({ mode, total_manual: toMajor(quote.subtotal) });
    else set({ mode });
  }

  function onReceived(value: string) {
    // Design lines 2391–2394: payment status follows the amount received, but
    // stays overridable afterwards.
    const received = Number(value || 0) * 100;
    set({
      received: value,
      status:
        form.status === "maintenance" || form.status === "cancelled"
          ? form.status
          : received <= 0
            ? "pending"
            : "booked",
    });
  }

  async function save() {
    setTouched(true);
    if (conflict) {
      toast.error("Booking conflict", {
        description: `Those dates overlap ${conflict.guest_name}.`,
      });
      return;
    }
    if (!form.guest_name.trim()) {
      toast.error("Guest name missing", { description: "Add who is staying before saving." });
      return;
    }
    if (quote.error) {
      toast.error("Check the details", { description: quote.error });
      return;
    }

    const payload = {
      condo_id: form.condo_id,
      guest_name: form.guest_name.trim(),
      guest_phone: form.guest_phone || null,
      guest_email: form.guest_email || null,
      check_in: form.check_in,
      check_out: form.check_out,
      mode: form.mode,
      night_rate: form.night_rate || "0",
      total_manual: form.total_manual || "0",
      discount: form.discount || "0",
      cleaning_fee: form.cleaning_fee || "0",
      other_charges: form.other_charges || "0",
      tax_pct: form.tax_pct || "0",
      received: form.received || "0",
      status: form.status,
      notes: form.notes || null,
    };

    try {
      const saved = editId
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload);
      toast.success(editId ? "Booking updated" : "Booking saved", {
        description: `${saved.guest_name} · ${saved.nights} nights · ${saved.total_label}`,
      });
      router.push(`/bookings?booking=${saved.id}` as never);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.isConflict ? "Booking conflict" : "Could not save", {
          description: error.message,
        });
        return;
      }
      toast.error("Could not save", { description: "The server did not respond." });
    }
  }

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>{editId ? "Edit booking" : "New booking"}</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            Pick a condo, set the dates, the money works itself out.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Fields. On mobile the summary comes first, so this is ordered second. */}
        <div
          className="order-2 md:order-none"
          style={{
            flex: "1 1 520px",
            minWidth: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {conflict ? (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 12,
                padding: 16,
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: 12,
                animation: "lsPop 180ms var(--ease-out) both",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width={18}
                height={18}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--danger)", flex: "none", marginTop: 1 }}
                aria-hidden="true"
              >
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
              <div>
                <div style={{ font: "700 14px/1.3 var(--font-sans)", color: "var(--danger)" }}>
                  Booking conflict
                </div>
                <div
                  style={{
                    font: "400 13px/1.5 var(--font-sans)",
                    color: "var(--danger)",
                    opacity: 0.9,
                    marginTop: 3,
                  }}
                >
                  {selectedCondo?.name ?? "That condo"} is already booked {conflict.check_in} →{" "}
                  {conflict.check_out} for {conflict.guest_name}. Pick other dates or another unit.
                </div>
              </div>
            </div>
          ) : null}

          <Card title="Condo & guest">
            <Grid min={220}>
              <Field label="Select condo" span>
                <select
                  value={form.condo_id}
                  onChange={(e) => onCondoChange(e.target.value)}
                  style={{ height: 46, fontSize: 15 }}
                >
                  {condos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.night_rate_label}/night
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Guest name"
                error={touched && !form.guest_name.trim() ? "Add who is staying" : undefined}
              >
                <input
                  value={form.guest_name}
                  onChange={(e) => set({ guest_name: e.target.value })}
                  placeholder="e.g. Sarah Chen"
                  style={{ height: 46, fontSize: 15 }}
                />
              </Field>
              <Field label="Phone number">
                <input
                  value={form.guest_phone}
                  onChange={(e) => set({ guest_phone: e.target.value })}
                  placeholder="+66 8x xxx xxxx"
                  style={{ height: 46, fontSize: 15 }}
                />
              </Field>
              <Field label="Email" span>
                <input
                  type="email"
                  value={form.guest_email}
                  onChange={(e) => set({ guest_email: e.target.value })}
                  placeholder="guest@email.com"
                  style={{ height: 46, fontSize: 15 }}
                />
              </Field>
            </Grid>
          </Card>

          <Card title="Stay dates">
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <Field label="Check-in" style={{ flex: "1 1 180px" }}>
                <input
                  type="date"
                  value={form.check_in}
                  onChange={(e) => set({ check_in: e.target.value })}
                  style={{ height: 46, fontSize: 15 }}
                />
              </Field>
              <div style={{ paddingBottom: 14, color: "var(--fg-4)" }} aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width={18}
                  height={18}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
              <Field
                label="Check-out"
                style={{ flex: "1 1 180px" }}
                error={quote.error && !quote.error.startsWith("Tax") ? quote.error : undefined}
              >
                <input
                  type="date"
                  value={form.check_out}
                  min={addDays(form.check_in, 1)}
                  onChange={(e) => set({ check_out: e.target.value })}
                  style={{ height: 46, fontSize: 15 }}
                />
              </Field>
              <div
                style={{
                  flex: "0 0 auto",
                  padding: "10px 16px",
                  background: "var(--brand-purple-50)",
                  borderRadius: 10,
                  textAlign: "center",
                  minWidth: 96,
                }}
              >
                <div
                  style={{
                    font: "700 20px/1.1 var(--font-sans)",
                    color: "var(--brand-purple-700)",
                  }}
                >
                  {quote.nights}
                </div>
                <div className="t-caption" style={{ color: "var(--brand-purple-700)" }}>
                  nights
                </div>
              </div>
            </div>
          </Card>

          <Card title="Pricing">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <ModeOption
                active={nightly}
                title="Calculate from night rate"
                hint="Rate × nights = total"
                onClick={() => switchMode("nightly")}
              />
              <ModeOption
                active={!nightly}
                title="Enter total manually"
                hint="Total ÷ nights = rate"
                onClick={() => switchMode("total")}
              />
            </div>

            <Grid min={160}>
              <MoneyField
                label={nightly ? "Night rate" : "Night rate (calculated)"}
                value={nightly ? form.night_rate : toMajor(quote.nightRate)}
                onChange={(v) => set({ night_rate: v })}
                disabled={!nightly}
              />
              <MoneyField
                label={nightly ? "Subtotal (calculated)" : "Total amount"}
                value={nightly ? toMajor(quote.subtotal) : form.total_manual}
                onChange={(v) => set({ total_manual: v })}
                disabled={nightly}
              />
              <MoneyField
                label="Discount"
                value={form.discount}
                onChange={(v) => set({ discount: v })}
              />
              <MoneyField
                label="Cleaning fee"
                value={form.cleaning_fee}
                onChange={(v) => set({ cleaning_fee: v })}
              />
              <MoneyField
                label="Other charges"
                value={form.other_charges}
                onChange={(v) => set({ other_charges: v })}
              />
              <Field
                label="Tax"
                error={quote.error?.startsWith("Tax") ? quote.error : undefined}
              >
                <div style={INPUT_WRAP}>
                  <input
                    value={form.tax_pct}
                    onChange={(e) => set({ tax_pct: e.target.value })}
                    inputMode="decimal"
                    style={BARE_INPUT}
                  />
                  <span style={{ font: "500 14px/1 var(--font-sans)", color: "var(--fg-3)" }}>
                    %
                  </span>
                </div>
              </Field>
            </Grid>
          </Card>

          <Card title="Payment">
            <Grid min={180}>
              <MoneyField
                label="Amount received"
                value={form.received}
                onChange={onReceived}
              />
              <Field label="Balance">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 8,
                    font: "700 15px/1.2 var(--font-sans)",
                    border: `1px solid ${quote.balance > 0 ? "var(--warning-border)" : "var(--success-border)"}`,
                    background: quote.balance > 0 ? "var(--warning-bg)" : "var(--success-bg)",
                    color: quote.balance > 0 ? "var(--warning)" : "var(--success)",
                  }}
                >
                  {formatTHB(quote.balance)}
                </div>
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value })}
                  style={{ height: 44 }}
                >
                  <option value="booked">Booked</option>
                  <option value="pending">Pending</option>
                  <option value="maintenance">Maintenance block</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
              <Field label="Notes" span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  placeholder="Late arrival, extra bed, agent name…"
                />
              </Field>
            </Grid>
          </Card>

          <div
            style={{
              position: "sticky",
              bottom: 0,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              padding: "14px 16px",
              background: "rgba(255,255,255,.85)",
              backdropFilter: "blur(12px)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <button className="btn btn-outline" onClick={() => router.push("/bookings")}>
              Cancel
            </button>
            <button
              // The design deliberately restyles rather than disables, so the
              // reason stays readable (line 2410).
              className={`btn ${conflict ? "btn-outline" : "btn-primary"}`}
              style={{ padding: "12px 22px", fontSize: 15 }}
              onClick={save}
              disabled={saving}
            >
              <CheckIcon size={16} />
              {saving
                ? "Saving…"
                : conflict
                  ? "Resolve conflict to save"
                  : editId
                    ? "Save changes"
                    : "Save booking"}
            </button>
          </div>
        </div>

        {/* Live summary — first on mobile, sticky on desktop (design 2318–2320). */}
        <div
          className="order-1 md:order-none md:sticky md:top-5"
          style={{ flex: "1 1 320px", maxWidth: 400, minWidth: 0, width: "100%" }}
        >
          <div
            className="card"
            style={{
              borderRadius: 20,
              boxShadow: "var(--shadow-md)",
              borderColor: "transparent",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 16,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div>
                <div className="t-eyebrow">Live total</div>
                <div
                  style={{
                    font: "700 15px/1.3 var(--font-sans)",
                    color: "var(--fg)",
                    marginTop: 6,
                  }}
                >
                  {selectedCondo?.name ?? "Pick a condo"}
                </div>
              </div>
              <span
                className={`pill ${
                  quote.paymentStatus === "paid"
                    ? "ok"
                    : quote.paymentStatus === "partial"
                      ? "warn"
                      : "neutral"
                }`}
              >
                {quote.paymentStatus === "paid"
                  ? "Paid"
                  : quote.paymentStatus === "partial"
                    ? "Partial"
                    : "Pending"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 11, padding: "16px 0" }}>
              <Line
                label={`${quote.nights} nights × ${formatTHB(quote.nightRate)}`}
                value={formatTHB(quote.subtotal)}
              />
              <Line
                label="Discount"
                value={quote.discount ? `−${formatTHB(quote.discount)}` : formatTHB(0)}
                tone={quote.discount ? "success" : "muted"}
              />
              <Line label="Cleaning fee" value={`+${formatTHB(quote.cleaningFee)}`} />
              <Line label="Other charges" value={`+${formatTHB(quote.otherCharges)}`} />
              <Line label={`Tax (${form.tax_pct || 0}%)`} value={`+${formatTHB(quote.tax)}`} />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "16px 0",
                borderTop: "1px solid var(--line)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span style={{ font: "600 15px/1.2 var(--font-sans)", color: "var(--fg)" }}>
                Total
              </span>
              <span
                style={{
                  font: "700 26px/1.1 var(--font-sans)",
                  color: "var(--fg)",
                  letterSpacing: "-.02em",
                }}
              >
                {formatTHB(quote.total)}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 11, paddingTop: 16 }}>
              <Line label="Received" value={formatTHB(quote.received)} tone="success" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ font: "600 14px/1.4 var(--font-sans)", color: "var(--fg)" }}>
                  Balance due
                </span>
                <span
                  style={{
                    font: "700 16px/1.2 var(--font-sans)",
                    color: quote.balance > 0 ? "var(--warning)" : "var(--success)",
                  }}
                >
                  {formatTHB(quote.balance)}
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: "12px 14px",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
            >
              <div className="t-caption">
                {quote.nights > 0
                  ? `${form.check_in} → ${form.check_out} · ${quote.nights} nights · ${selectedCondo?.name ?? ""}`
                  : "Pick check-in and check-out dates"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- bits */

const INPUT_WRAP: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 12,
  border: "1px solid var(--line-strong)",
  borderRadius: 8,
  background: "var(--surface)",
};

const BARE_INPUT: React.CSSProperties = {
  border: 0,
  outline: 0,
  background: "transparent",
  padding: 0,
  width: "100%",
  font: "600 15px/1 var(--font-sans)",
  color: "var(--fg)",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Grid({ min, children }: { min: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`,
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  span,
  style,
  children,
}: {
  label: string;
  error?: string;
  span?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className="field" style={{ ...(span ? { gridColumn: "1/-1" } : {}), ...style }}>
      <label>{label}</label>
      {children}
      {error ? <small className="error">{error}</small> : null}
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <div style={{ ...INPUT_WRAP, background: disabled ? "var(--bg-alt)" : "var(--surface)" }}>
        <span style={{ font: "500 14px/1 var(--font-sans)", color: "var(--fg-3)" }}>฿</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          inputMode="decimal"
          style={BARE_INPUT}
        />
      </div>
    </Field>
  );
}

function ModeOption({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <div
      role="radio"
      aria-checked={active}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 14,
        borderRadius: 12,
        cursor: "pointer",
        transition: "all 120ms var(--ease-out)",
        border: `1px solid ${active ? "var(--brand-purple)" : "var(--line-strong)"}`,
        background: active ? "var(--brand-purple-50)" : "var(--surface)",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          flex: "none",
          marginTop: 1,
          boxSizing: "border-box",
          transition: "all 120ms",
          border: active ? "5px solid var(--brand-purple)" : "1.5px solid var(--line-strong)",
        }}
      />
      <div>
        <div style={{ font: "600 14px/1.2 var(--font-sans)", color: "var(--fg)" }}>{title}</div>
        <div className="t-caption" style={{ marginTop: 3 }}>
          {hint}
        </div>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "muted";
}) {
  const color =
    tone === "success" ? "var(--success)" : tone === "muted" ? "var(--fg-4)" : "var(--fg-2)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ font: "500 13px/1.4 var(--font-sans)", color: "var(--fg-3)" }}>{label}</span>
      <span style={{ font: "600 14px/1.4 var(--font-sans)", color }}>{value}</span>
    </div>
  );
}
