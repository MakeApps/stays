import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/features/settings/ChangePasswordForm";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

/**
 * Your own account, not the admin's view of everyone else's — that is /users.
 *
 * No capability gate: every signed-in account reaches this, which is the point.
 * A manager cannot use /users at all, so this is the only place they can change
 * their own password.
 */
export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            Signed in as {user.email}.
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-head">
          <div className="card-title">Change password</div>
        </div>
        <div style={{ padding: "18px 20px 20px" }}>
          <div className="t-small" style={{ marginBottom: 16 }}>
            Changing it signs out every other device. You will stay signed in here.
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </section>
  );
}
