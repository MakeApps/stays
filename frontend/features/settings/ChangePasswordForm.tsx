"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useChangePassword } from "@/features/settings/api";
import { ApiError } from "@/services/http";

/** Matches the server's floor. Anything stricter belongs in one place. */
const MIN_PASSWORD = 8;

const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().min(MIN_PASSWORD, `At least ${MIN_PASSWORD} characters`),
    confirm_password: z.string().min(1, "Type it once more"),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ["confirm_password"],
    message: "These do not match",
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ["new_password"],
    message: "Choose a different one",
  });

type Values = z.infer<typeof schema>;

/** The confirm field is ours alone; the server has no use for it. */
const SERVER_FIELDS = new Set(["current_password", "new_password"]);

export function ChangePasswordForm() {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  async function onSubmit(values: Values) {
    try {
      await change.mutateAsync({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      // Cleared rather than left filled: the fields hold a live credential,
      // and the next person at this screen should not inherit it.
      reset();
      toast.success("Password changed", {
        description: "Any other device signed in as you has been signed out.",
      });
    } catch (error) {
      if (error instanceof ApiError) {
        // A wrong current password comes back as a 422 on that field rather
        // than a 401, so it lands under the input instead of ending the
        // session of the person trying to fix it.
        for (const [field, messages] of Object.entries(error.fields)) {
          if (messages[0] && SERVER_FIELDS.has(field)) {
            setError(field as keyof Values, { message: messages[0] });
          }
        }
        toast.error("Could not change password", { description: error.message });
        return;
      }
      throw error;
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
        <Field label="Current password" error={errors.current_password?.message}>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="The one you signed in with"
            {...register("current_password")}
          />
        </Field>

        <Field
          label="New password"
          error={errors.new_password?.message}
          hint={`At least ${MIN_PASSWORD} characters.`}
        >
          <input type="password" autoComplete="new-password" {...register("new_password")} />
        </Field>

        <Field label="Confirm new password" error={errors.confirm_password?.message}>
          <input type="password" autoComplete="new-password" {...register("confirm_password")} />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Change password"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error ? <small className="error">{error}</small> : hint ? <small>{hint}</small> : null}
    </div>
  );
}
