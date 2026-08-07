"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CloseIcon, PlusIcon, TrashIcon } from "@/components/layout/icons";
import {
  useCreateCondo,
  useDeleteCondoImage,
  useUpdateCondo,
  useUploadCondoImage,
} from "@/features/condos/api";
import { ApiError } from "@/services/http";
import type { Condo } from "@/types/api";

/** Money arrives as a typed string. Coercing through Number here would be the
 *  first step toward float arithmetic on money, so it stays a decimal string
 *  and the server converts to satang. */
const money = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,8}(\.\d{1,2})?$/.test(v), "Use a number like 1800 or 1800.50");

const schema = z.object({
  name: z.string().trim().min(1, "Give the condo a name").max(160),
  code: z
    .string()
    .trim()
    .min(1, "Add a short code")
    .max(24)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 \-_/]*$/, "Letters, numbers, dashes and slashes only"),
  property_type: z.enum(["Condominium", "Serviced apartment", "Townhouse"]),
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(1).max(20),
  size_sqm: z.string().trim().refine((v) => v === "" || /^\d{1,5}$/.test(v), "Whole metres only"),
  night_rate: money,
  month_rate: money,
  cleaning_fee: money,
  security_deposit: money,
  address: z.string().trim().max(255),
  description: z.string().trim().max(5000),
  is_maintenance: z.boolean(),
});

type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  name: "",
  code: "",
  property_type: "Condominium",
  bedrooms: 1,
  bathrooms: 1,
  size_sqm: "",
  night_rate: "",
  month_rate: "",
  cleaning_fee: "500",
  security_deposit: "5000",
  address: "",
  description: "",
  is_maintenance: false,
};

function toValues(condo: Condo): Values {
  return {
    name: condo.name,
    code: condo.code,
    property_type: condo.property_type,
    bedrooms: condo.bedrooms,
    bathrooms: condo.bathrooms,
    size_sqm: condo.size_sqm ? String(condo.size_sqm) : "",
    night_rate: condo.night_rate,
    month_rate: condo.month_rate,
    cleaning_fee: condo.cleaning_fee,
    security_deposit: condo.security_deposit,
    address: condo.address ?? "",
    description: condo.description ?? "",
    is_maintenance: condo.status === "maintenance",
  };
}

export function CondoFormModal({
  open,
  condo,
  onClose,
}: {
  open: boolean;
  condo: Condo | null;
  onClose: () => void;
}) {
  const editing = Boolean(condo);
  const create = useCreateCondo();
  const update = useUpdateCondo(condo?.id ?? "");
  const uploadImage = useUploadCondoImage(condo?.id ?? "");
  const deleteImage = useDeleteCondoImage(condo?.id ?? "");
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: "onTouched" });

  useEffect(() => {
    if (open) reset(condo ? toValues(condo) : EMPTY);
  }, [open, condo, reset]);

  async function onSubmit(values: Values) {
    const payload = {
      ...values,
      size_sqm: values.size_sqm === "" ? null : Number(values.size_sqm),
      night_rate: values.night_rate || "0",
      month_rate: values.month_rate || "0",
      cleaning_fee: values.cleaning_fee || "0",
      security_deposit: values.security_deposit || "0",
      address: values.address || null,
      description: values.description || null,
    };

    try {
      if (condo) {
        await update.mutateAsync(payload);
        toast.success("Condo updated", { description: `${values.name} saved.` });
      } else {
        await create.mutateAsync(payload);
        toast.success("Condo added", { description: `${values.name} is ready to book.` });
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        // Map server-side field errors (duplicate code, etc.) back onto inputs.
        for (const [field, messages] of Object.entries(error.fields)) {
          if (field in EMPTY && messages[0]) {
            setError(field as keyof Values, { message: messages[0] });
          }
        }
        if (Object.keys(error.fields).length === 0) {
          toast.error("Could not save", { description: error.message });
        }
        return;
      }
      toast.error("Could not save", { description: "The server did not respond." });
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !condo) return;
    for (const file of Array.from(files)) {
      try {
        await uploadImage.mutateAsync(file);
      } catch (error) {
        toast.error("Upload failed", {
          description: error instanceof ApiError ? error.message : file.name,
        });
      }
    }
  }

  const saving = isSubmitting || create.isPending || update.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        {/* Radix supplies the focus trap, scroll lock and Escape handling the
            design's hand-rolled modal did not have. Styling is entirely DS. */}
        <Dialog.Overlay className="modal-bg" />
        {/* Centring lives on this wrapper, not on Content. lsPop animates
            `transform`, so a translate(-50%,-50%) on the animated element gets
            cancelled by the animation's own end state and the dialog lands
            off-centre with its footer pushed out of the viewport. */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 101,
            display: "grid",
            placeItems: "center",
            padding: 20,
            pointerEvents: "none",
          }}
        >
          <Dialog.Content
            className="modal"
            style={{
              maxWidth: 640,
              pointerEvents: "auto",
              animation: "lsPop 280ms var(--ease-out) both",
            }}
            aria-describedby="condo-modal-hint"
          >
          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "contents" }}>
            <div className="modal-head">
              <div>
                <Dialog.Title asChild>
                  <h2>{editing ? "Edit condo" : "Add condo"}</h2>
                </Dialog.Title>
                <div className="t-caption" style={{ marginTop: 4 }} id="condo-modal-hint">
                  Everything here can be changed later.
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
                <Field label="Condo name" error={errors.name?.message} span>
                  <input placeholder="e.g. Ashton Asoke 1204" {...register("name")} />
                </Field>

                <Field label="Condo code" error={errors.code?.message} hint="Short label used on the calendar.">
                  <input
                    placeholder="A-1204"
                    style={{ fontFamily: "var(--font-mono)" }}
                    {...register("code")}
                  />
                </Field>

                <Field label="Property type">
                  <select {...register("property_type")}>
                    <option>Condominium</option>
                    <option>Serviced apartment</option>
                    <option>Townhouse</option>
                  </select>
                </Field>

                <Field label="Bedrooms">
                  <select {...register("bedrooms")}>
                    <option value="0">Studio</option>
                    <option value="1">1 bedroom</option>
                    <option value="2">2 bedrooms</option>
                    <option value="3">3 bedrooms</option>
                  </select>
                </Field>

                <Field label="Bathrooms">
                  <select {...register("bathrooms")}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </Field>

                {/* Not in the approved modal, but the card and drawer both
                    display m² — the prototype hardcoded 38. */}
                <Field label="Size (m²)" error={errors.size_sqm?.message}>
                  <input placeholder="42" inputMode="numeric" {...register("size_sqm")} />
                </Field>

                <Field label="Night rate (฿)" error={errors.night_rate?.message}>
                  <input placeholder="1500" inputMode="decimal" {...register("night_rate")} />
                </Field>

                <Field label="Monthly rate (฿)" error={errors.month_rate?.message}>
                  <input placeholder="28000" inputMode="decimal" {...register("month_rate")} />
                </Field>

                <Field label="Cleaning fee (฿)" error={errors.cleaning_fee?.message}>
                  <input placeholder="500" inputMode="decimal" {...register("cleaning_fee")} />
                </Field>

                <Field
                  label="Security deposit (฿)"
                  error={errors.security_deposit?.message}
                  hint="Held at check-in, refunded at check-out."
                >
                  <input placeholder="5000" inputMode="decimal" {...register("security_deposit")} />
                </Field>

                <Field label="Address" span>
                  <input placeholder="Sukhumvit 21, Watthana, Bangkok" {...register("address")} />
                </Field>

                <Field label="Description" span>
                  <textarea
                    rows={2}
                    placeholder="High floor, BTS 4 minutes walk, pool on 42F."
                    {...register("description")}
                  />
                </Field>

                <Field label="Status" span>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      font: "500 13px/1 var(--font-sans)",
                      color: "var(--fg-2)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: 16, height: 16, accentColor: "var(--brand-purple)" }}
                      {...register("is_maintenance")}
                    />
                    Under maintenance — block this unit from being booked
                  </label>
                </Field>

                <div className="field" style={{ gridColumn: "1/-1" }}>
                  <label>Photos</label>
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
                          void handleFiles(e.dataTransfer.files);
                        }}
                        onClick={() => fileInput.current?.click()}
                        style={{
                          borderRadius: 12,
                          border: `1.5px dashed ${dragging ? "var(--brand-purple)" : "var(--line-strong)"}`,
                          background: dragging ? "var(--brand-purple-50)" : "var(--surface-2)",
                          padding: 18,
                          textAlign: "center",
                          cursor: "pointer",
                          transition: "all 120ms var(--ease-out)",
                        }}
                      >
                        <div style={{ color: "var(--brand-purple)", marginBottom: 6 }}>
                          <PlusIcon size={18} />
                        </div>
                        <div className="t-caption">
                          {uploadImage.isPending
                            ? "Uploading…"
                            : "Drag photos here, or click to browse"}
                        </div>
                      </div>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        hidden
                        onChange={(e) => {
                          void handleFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      {condo && condo.images.length > 0 ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          {condo.images.map((image) => (
                            <div
                              key={image.id}
                              style={{
                                position: "relative",
                                width: 84,
                                height: 64,
                                borderRadius: 10,
                                overflow: "hidden",
                                border: "1px solid var(--line)",
                                background: `center/cover no-repeat url(${image.url})`,
                              }}
                            >
                              <button
                                type="button"
                                className="icon-btn danger"
                                style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22 }}
                                aria-label="Remove photo"
                                onClick={() => deleteImage.mutate(image.id)}
                              >
                                <TrashIcon size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <small>Save the condo first, then photos can be added.</small>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Save condo"}
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
