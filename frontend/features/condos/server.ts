import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/session";
import type { Condo } from "@/types/api";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

/**
 * Server-side condo fetch.
 *
 * Server components cannot use the browser client, so the access cookie is
 * forwarded explicitly. Returns null rather than throwing so the route can
 * render notFound() instead of a 500.
 */
export async function getCondo(id: string): Promise<Condo | null> {
  const access = (await cookies()).get(ACCESS_COOKIE);
  if (!access) return null;

  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/condos/${id}`, {
      headers: { Cookie: `${ACCESS_COOKIE}=${access.value}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Condo;
  } catch {
    return null;
  }
}
