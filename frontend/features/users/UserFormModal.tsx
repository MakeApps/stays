"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CloseIcon } from "@/components/layout/icons";
import { useCreateUser, useUpdateUser } from "@/features/users/api";
import { ApiError } from "@/services/http";
import type { TeamMember } from "@/types/api";

/** Matches the server's floor. Anything stricter belongs in one place. */
const MIN_PASSWORD = 8;

const schema = z.object({
  full_name: z.string().trim().min(1, "Who is this?").max(160),
  email: z
    .string()
    .trim()
    .min(3, "Add an email address")
    .max(255)
    .refine((v) => v.includes("@") && !v.includes(" "), "That does not look like an email"),
  password: z.string(),
});

type Values = z.infer<typeof schema>;

/**
 * Add or edit a team member.
 *
 * No role field. Everyone created here gets the same access — everything
 * except this screen — because the product does not expose roles yet, and a
 * picker with one real option is a decision nobody asked for.
 */
export function UserFormModal({
  open,
  member,
  onClose,
}: {
  open: boolean;
  member: TeamMember | null;
  onClose: () => void;
}) {
  const editing = member !== null;
  const create = useCreateUser();
  const update = useUpdateUser(member?.id ?? "");

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(
      // On create the password is required; on edit it is a reset, so blank
      // means "leave it alone".
      schema.superRefine((values, ctx) => {
        const needed = !editing || values.password.length > 0;
        if (needed && values.password.length < MIN_PASSWORD) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: `At least ${MIN_PASSWORD} characters`,
          });
        }
      }),
    ),
    mode: "onTouched",
    defaultValues: { full_name: "", email: "", password: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      full_name: member?.full_name ?? "",
      email: member?.email ?? "",
      password: "",
    });
  }, [open, member, reset]);

  async function onSubmit(values: Values) {
    try {
      if (member) {
        await update.mutateAsync({
          full_name: values.full_name,
          email: values.email,
          // Omitted entirely when blank, so a rename never resets a password.
          ...(values.password ? { password: values.password } : {}),
        });
        toast.success("User updated", {
          description: values.password
            ? `${values.full_name} was signed out everywhere.`
            : `${values.full_name} saved.`,
        });
      } else {
        await create.mutateAsync(values);
        toast.success("User added", {
          description: `${values.full_name} can sign in with the password you set.`,
        });
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, messages] of Object.entries(error.fields)) {
          if (messages[0] && field in ({ full_name: 1, email: 1, password: 1 } as const)) {
            setError(field as keyof Values, { message: messages[0] });
          }
        }
        toast.error("Could not save", { description: error.message });
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
            aria-describedby="user-modal-hint"
          >
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "contents" }}>
              <div className="modal-head">
                <div>
                  <Dialog.Title asChild>
                    <h2>{editing ? "Edit user" : "Add user"}</h2>
                  </Dialog.Title>
                  <div className="t-caption" style={{ marginTop: 4 }} id="user-modal-hint">
                    They will be able to use the whole app, but not manage users.
                  </div>
                </div>
                <Dialog.Close className="modal-close" aria-label="Close">
                  <CloseIcon size={17} />
                </Dialog.Close>
              </div>

              <div className="modal-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Field label="Full name" error={errors.full_name?.message}>
                    <input placeholder="Nok Chaiyaphum" {...register("full_name")} />
                  </Field>

                  <Field label="Email" error={errors.email?.message}>
                    <input
                      type="email"
                      autoComplete="off"
                      placeholder="nok@localshouts.co.th"
                      {...register("email")}
                    />
                  </Field>

                  <Field
                    label={editing ? "New password" : "Password"}
                    error={errors.password?.message}
                    hint={
                      editing
                        ? "Leave blank to keep the current one. Setting it signs them out everywhere."
                        : `At least ${MIN_PASSWORD} characters. Share it with them directly — there is no invitation email.`
                    }
                  >
                    <input
                      type="password"
                      // Stops a password manager offering the admin's own
                      // credentials while they create somebody else's.
                      autoComplete="new-password"
                      placeholder={editing ? "Unchanged" : "At least 8 characters"}
                      {...register("password")}
                    />
                  </Field>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add user"}
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
