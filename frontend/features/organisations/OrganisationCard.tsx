"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCan, useSession } from "@/components/providers/Providers";
import { useRenameOrganisation } from "@/features/organisations/api";
import { ApiError } from "@/services/http";

const MIN_NAME = 2;

const schema = z.object({
  name: z.string().trim().min(MIN_NAME, `At least ${MIN_NAME} characters`).max(160),
});

type Values = z.infer<typeof schema>;

/**
 * The organisation this session is in, and its name.
 *
 * Read-only for anyone without `organisation:write`, which is every role but
 * admin — a manager should be able to see which set of condos they are looking
 * at without being able to rename it under everyone else.
 */
export function OrganisationCard() {
  const user = useSession();
  const can = useCan();
  const organisation = user?.organisation;
  const rename = useRenameOrganisation(organisation?.id ?? "");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    values: { name: organisation?.name ?? "" },
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
        </div>
      </div>
    );
  }

  async function onSubmit(values: Values) {
    try {
      await rename.mutateAsync(values.name);
      toast.success("Organisation renamed", { description: `Now called ${values.name}.` });
    } catch (error) {
      if (error instanceof ApiError) {
        const message = error.fields.name?.[0];
        if (message) setError("name", { message });
        toast.error("Could not rename", { description: error.message });
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
          Renaming it changes what everyone in it sees.
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
            <div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !isDirty}
              >
                {isSubmitting ? "Saving…" : "Save name"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
