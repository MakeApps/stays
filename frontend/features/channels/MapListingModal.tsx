"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CloseIcon } from "@/components/layout/icons";
import { useMapListing } from "@/features/channels/api";
import { useCondos } from "@/features/condos/api";
import { ApiError } from "@/services/http";

const schema = z.object({
  condo_id: z.string().min(1, "Choose a condo"),
  import_url: z
    .string()
    .trim()
    .min(1, "Paste the calendar link from Airbnb")
    .url("That does not look like a URL"),
});

type Values = z.infer<typeof schema>;

/**
 * Map one condo to one Airbnb listing.
 *
 * There is no listing picker, and there cannot be one: Airbnb's calendar
 * export gives no way to enumerate an account's listings, so the host copies
 * one link per unit. The listing id is read out of that link rather than typed.
 */
export function MapListingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const map = useMapListing();
  // 100 is the server's ceiling on per_page. A portfolio past that needs a
  // searchable picker rather than a longer <select>, which is a different
  // problem from this one.
  const { data: condos } = useCondos({ per_page: 100, sort: "name", order: "asc" });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { condo_id: "", import_url: "" },
  });

  useEffect(() => {
    if (open) reset({ condo_id: "", import_url: "" });
  }, [open, reset]);

  async function onSubmit(values: Values) {
    try {
      await map.mutateAsync({
        channel: "airbnb",
        condo_id: values.condo_id,
        import_url: values.import_url,
      });
      toast.success("Listing mapped", {
        description: "The first sync runs within a few minutes, or press Sync now.",
      });
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        const field = error.fields.import_url?.[0] ?? error.fields.condo_id?.[0];
        if (error.fields.import_url?.[0]) {
          setError("import_url", { message: error.fields.import_url[0] });
        }
        toast.error("Could not map that listing", { description: field ?? error.message });
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
            aria-describedby="map-listing-hint"
          >
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "contents" }}>
              <div className="modal-head">
                <div>
                  <Dialog.Title asChild>
                    <h2>Map an Airbnb listing</h2>
                  </Dialog.Title>
                  <div className="t-caption" style={{ marginTop: 4 }} id="map-listing-hint">
                    In Airbnb, open the listing&apos;s calendar → Availability → Sync
                    calendars → Export calendar, and paste the link here.
                  </div>
                </div>
                <Dialog.Close className="modal-close" aria-label="Close">
                  <CloseIcon size={17} />
                </Dialog.Close>
              </div>

              <div className="modal-body">
                <div className="field">
                  <label>Condo</label>
                  <select {...register("condo_id")}>
                    <option value="">Choose a condo…</option>
                    {(condos?.items ?? []).map((condo) => (
                      <option key={condo.id} value={condo.id}>
                        {condo.code} · {condo.name}
                      </option>
                    ))}
                  </select>
                  {errors.condo_id?.message ? (
                    <small className="error">{errors.condo_id.message}</small>
                  ) : null}
                </div>

                <div className="field" style={{ marginTop: 14 }}>
                  <label>Airbnb calendar link</label>
                  <input
                    placeholder="https://www.airbnb.com/calendar/ical/12345678.ics?s=…"
                    autoComplete="off"
                    {...register("import_url")}
                  />
                  {errors.import_url?.message ? (
                    <small className="error">{errors.import_url.message}</small>
                  ) : (
                    <small>
                      Kept encrypted — the link contains a token that reads that
                      listing&apos;s calendar.
                    </small>
                  )}
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Mapping…" : "Map listing"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
