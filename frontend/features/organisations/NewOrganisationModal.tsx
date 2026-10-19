"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CloseIcon } from "@/components/layout/icons";
import { useSession } from "@/components/providers/Providers";
import {
  useCreateOrganisation,
  useSwitchOrganisation,
} from "@/features/organisations/api";
import { CURRENCIES, currencyOf } from "@/lib/money";
import { ApiError } from "@/services/http";
import type { CurrencyCode } from "@/types/api";

/** Matches the server's floor. Anything stricter belongs in one place. */
const MIN_NAME = 2;

const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

const schema = z.object({
  name: z.string().trim().min(MIN_NAME, `At least ${MIN_NAME} characters`).max(160),
  currency: z.enum(CURRENCY_CODES),
});

type Values = z.infer<typeof schema>;

/**
 * Stand up a new set of condos.
 *
 * Creating and then moving into it are two calls, not one: the server refuses
 * to relocate a session as a side effect, because doing that would drop an
 * admin out of the organisation they were working in without being asked. Here
 * the person did ask, so the switch follows immediately.
 *
 * The currency is asked for here, before the first rate is typed, because it
 * cannot be fixed by conversion later — only relabelled. It starts as whatever
 * the current organisation uses, which is the likeliest answer for a second
 * portfolio and one click away from the other.
 */
export function NewOrganisationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const user = useSession();
  const create = useCreateOrganisation();
  const switcher = useSwitchOrganisation();
  const current = currencyOf(user?.organisation);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", currency: current.code },
  });

  useEffect(() => {
    if (open) reset({ name: "", currency: current.code });
  }, [open, reset, current.code]);

  async function onSubmit(values: Values) {
    try {
      const created = await create.mutateAsync({
        name: values.name,
        currency: values.currency,
      });
      toast.success("Organisation created", {
        description: `Now showing ${created.name}. It starts empty, in ${created.currency_symbol}.`,
      });
      onClose();
      await switcher.mutateAsync(created.id);
    } catch (error) {
      if (error instanceof ApiError) {
        const nameMessage = error.fields.name?.[0];
        if (nameMessage) setError("name", { message: nameMessage });
        const currencyMessage = error.fields.currency?.[0];
        if (currencyMessage) setError("currency", { message: currencyMessage });
        toast.error("Could not create organisation", { description: error.message });
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
              maxWidth: 460,
              pointerEvents: "auto",
              animation: "lsPop 280ms var(--ease-out) both",
            }}
            aria-describedby="org-modal-hint"
          >
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "contents" }}>
              <div className="modal-head">
                <div>
                  <Dialog.Title asChild>
                    <h2>New organisation</h2>
                  </Dialog.Title>
                  <div className="t-caption" style={{ marginTop: 4 }} id="org-modal-hint">
                    A separate set of condos, bookings and expenses. Nothing is shared
                    with this one.
                  </div>
                </div>
                <Dialog.Close className="modal-close" aria-label="Close">
                  <CloseIcon size={17} />
                </Dialog.Close>
              </div>

              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="field">
                  <label>Name</label>
                  <input
                    placeholder="Sukhumvit Portfolio"
                    autoComplete="off"
                    {...register("name")}
                  />
                  {errors.name?.message ? (
                    <small className="error">{errors.name.message}</small>
                  ) : (
                    <small>You will be its admin, and can add people to it.</small>
                  )}
                </div>

                <div className="field">
                  <label>Currency</label>
                  <select
                    {...register("currency")}
                    aria-invalid={errors.currency ? true : undefined}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.symbol}) · {c.code}
                      </option>
                    ))}
                  </select>
                  {errors.currency?.message ? (
                    <small className="error">{errors.currency.message}</small>
                  ) : (
                    <small>What its books are kept in. It can be changed later in Settings.</small>
                  )}
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create organisation"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
