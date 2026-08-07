import { cookies } from "next/headers";

import type { SessionUser } from "@/types/api";

/**
 * Server-side session read.
 *
 * This is the real authorisation boundary. `middleware.ts` only checks whether
 * a cookie is present — fast, and enough to avoid a flash of the app shell,
 * but it verifies nothing. The `(app)` layout calls this, which asks Flask to
 * validate the token properly.
 */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

export const ACCESS_COOKIE = "ls_at";
export const REFRESH_COOKIE = "ls_rt";

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE);
  if (!access) return null;

  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/auth/me`, {
      headers: { Cookie: `${ACCESS_COOKIE}=${access.value}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user: SessionUser };
    return body.user;
  } catch {
    // Backend down: treat as signed out rather than crashing the layout.
    return null;
  }
}

export function can(user: SessionUser | null, capability: string): boolean {
  return Boolean(user?.capabilities.includes(capability as SessionUser["capabilities"][number]));
}
