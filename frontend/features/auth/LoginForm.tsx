"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError, api } from "@/services/http";
import type { SessionUser } from "@/types/api";

const schema = z.object({
  // Not z.string().email(): the server accepts whatever was typed and lets the
  // credential check decide. Validating format here would only add a way for a
  // legitimately registered address to become un-signinable.
  email: z.string().trim().min(3, "Enter your email"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
});

type Values = z.infer<typeof schema>;

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "onTouched",
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await api.post<{ user: SessionUser }>("/auth/login", values);
      // refresh() so the server layout re-reads the session cookie it was just
      // handed; push() alone would render against a stale RSC payload.
      // `next` is runtime input; typedRoutes cannot narrow it. The
      // startsWith("/") guard is what stops an open redirect.
      const destination = next && next.startsWith("/") ? next : "/";
      router.replace(destination as never);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(
          error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : error.message,
        );
        return;
      }
      setFormError("Could not reach the server. Is the backend running?");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      // Defensive: submission is handled in JS, but a form with no method
      // defaults to GET. If the bundle ever fails to load, the browser would
      // otherwise submit natively and write the password into the URL, the
      // history and every access log along the way.
      method="post"
      action="?"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {formError ? (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 10,
            padding: 12,
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            borderRadius: 10,
            animation: "lsPop 180ms var(--ease-out) both",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--danger)", flex: "none", marginTop: 1 }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <span style={{ font: "500 13px/1.5 var(--font-sans)", color: "var(--danger)" }}>
            {formError}
          </span>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          placeholder="you@company.co.th"
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          style={{ height: 44 }}
          {...register("email")}
        />
        {errors.email ? (
          <small className="error" id="email-error">
            {errors.email.message}
          </small>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? "true" : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          style={{ height: 44 }}
          {...register("password")}
        />
        {errors.password ? (
          <small className="error" id="password-error">
            {errors.password.message}
          </small>
        ) : null}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          cursor: "pointer",
          font: "500 13px/1 var(--font-sans)",
          color: "var(--fg-2)",
        }}
      >
        <input
          type="checkbox"
          style={{ width: 16, height: 16, accentColor: "var(--brand-purple)" }}
          {...register("remember")}
        />
        Keep me signed in
      </label>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={isSubmitting}
        style={{ justifyContent: "center", height: 44, fontSize: 15, position: "relative" }}
      >
        {isSubmitting ? (
          <>
            <span className="ls-ring ls-ring--sm" style={{ ["--ring-arc" as string]: "#fff" }} />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
