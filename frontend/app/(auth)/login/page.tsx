import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/LoginForm";
import { BrandLockup } from "@/components/ds/Brand";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The approved design has no login screen, so this one is built from the
 * design system's own vocabulary — .card, .field, .btn, the DS tokens and the
 * same LocalShouts lockup as the sidebar — rather than inventing a second visual
 * language.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;

  return (
    <div
      className="ls-base"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background:
          "radial-gradient(120% 80% at 50% 0%, var(--brand-purple-50), transparent 60%), var(--bg)",
      }}
    >
      <main style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <BrandLockup size={34} text={22} />
        </div>

        <div
          className="card"
          style={{
            borderRadius: "var(--r-2xl)",
            padding: 28,
            boxShadow: "var(--shadow-lg)",
            borderColor: "transparent",
            animation: "lsPop 280ms var(--ease-out) both",
          }}
        >
          <h1
            style={{
              font: "700 20px/1.2 var(--font-sans)",
              letterSpacing: "-.01em",
              color: "var(--fg)",
              margin: 0,
            }}
          >
            Sign in
          </h1>
          <p className="t-small" style={{ margin: "6px 0 20px" }}>
            Manage your condos, bookings and expenses.
          </p>

          <LoginForm next={next} />
        </div>

        <p className="t-caption" style={{ textAlign: "center", marginTop: 18 }}>
          Accounts are created by your administrator.
        </p>
      </main>
    </div>
  );
}
