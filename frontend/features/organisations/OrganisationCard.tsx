"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCan, useSession } from "@/components/providers/Providers";
import {
  type OrganisationChanges,
  useUpdateOrganisation,
} from "@/features/organisations/api";
import { CURRENCIES, currencyOf } from "@/lib/money";
import { ApiError } from "@/services/http";
import type { CurrencyCode } from "@/types/api";

const MIN_NAME = 2;

const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

const schema = z.object({
  name: z.string().trim().min(MIN_NAME, `At least ${MIN_NAME} characters`).max(160),
  currency: z.enum(CURRENCY_CODES),
});

type Values = z.infer<typeof schema>;

/**
 * The organisation this session is in: its name, and the currency its books
 * are kept in.
 *
 * Read-only for anyone without `organisation:write`, which is every role but
 * admin — a manager should be able to see which set of condos they are looking
 * at, and what the figures are in, without being able to change either under
 * everyone else.
 *
 * The currency is a label, not a conversion. Every amount stays exactly as it
 * was entered and only the symbol in front of it changes, so the copy says so
 * in as many words: a rate of 1,800 under the wrong symbol is a figure that is
 * simply wrong, and a quiet switch would make it look right.
 */
export function OrganisationCard() {
  const user = useSession();
  const can = useCan();
  const organisation = user?.organisation;
  const update = useUpdateOrganisation(organisation?.id ?? "");
  const current = currencyOf(organisation);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    values: { name: organisation?.name ?? "", currency: current.code },
  });

  if (!organisation) return null;

  if (!can("organisation:write")) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-head">
          <div className="card-title">Organisation</div>
        </div>
        <div style={{ padding: "18px 20px 20px" }}>
          <div style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--fg)" }}>
            {organisation.name}
          </div>
          <div className="t-small" style={{ marginTop: 6 }}>
            Everything you can see belongs to this organisation. You are a{" "}
            {organisation.role} here.
          </div>
          <div className="t-small" style={{ marginTop: 6 }}>
            Books are kept in {current.name} ({current.symbol}).
          </div>
        </div>
      </div>
    );
  }

  async function onSubmit(values: Values) {
    if (!organisation) return;

    // Only what changed goes over the wire, so a rename is just a rename and
    // the cache is only dropped when the labels in it have actually gone stale.
    const changes: OrganisationChanges = {};
    if (values.name !== organisation.name) changes.name = values.name;
    if (values.currency !== organisation.currency) changes.currency = values.currency;
    if (changes.name === undefined && changes.currency === undefined) return;

    try {
      await update.mutateAsync(changes);
      const chosen = CURRENCIES.find((c) => c.code === values.currency);
      toast.success("Organisation updated", {
        description:
          changes.currency !== undefined && chosen
            ? `Every figure now shows in ${chosen.name} (${chosen.symbol}). Amounts were not converted.`
            : `Now called ${values.name}.`,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        const nameMessage = error.fields.name?.[0];
        if (nameMessage) setError("name", { message: nameMessage });
        const currencyMessage = error.fields.currency?.[0];
        if (currencyMessage) setError("currency", { message: currencyMessage });
        toast.error("Could not save", { description: error.message });
        return;
      }
      throw error;
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-head">
        <div className="card-title">Organisation</div>
      </div>
      <div style={{ padding: "18px 20px 20px" }}>
        <div className="t-small" style={{ marginBottom: 16 }}>
          Every condo, booking and expense you can see belongs to this organisation.
          Changes here change what everyone in it sees.
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
            <div className="field">
              <label>Name</label>
              <input autoComplete="off" {...register("name")} />
              {errors.name?.message ? (
                <small className="error">{errors.name.message}</small>
              ) : null}
            </div>

            <div className="field">
              <label>Currency</label>
              <select {...register("currency")} aria-invalid={errors.currency ? true : undefined}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.symbol}) · {c.code}
                  </option>
                ))}
              </select>
              {errors.currency?.message ? (
                <small className="error">{errors.currency.message}</small>
              ) : (
                <small>
                  The symbol on every figure, for everyone in this organisation. Nothing is
                  converted: a rate of 1,800 stays 1,800.
                </small>
              )}
            </div>

            <div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !isDirty}
              >
                {isSubmitting ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
