import type { ApiErrorBody } from "@/types/api";

/**
 * Browser-side API client.
 *
 * Every call goes to a same-origin path under /api/v1, which the BFF proxy
 * forwards to Flask. That keeps the auth cookies first-party and httpOnly —
 * no token is ever reachable from JavaScript. This UI renders guest names and
 * notes next to financial totals, so an XSS with readable tokens would be
 * bank-adjacent.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;
  readonly requestId: string | undefined;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    const err = body?.error;
    super(err?.message ?? fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = err?.code ?? "unknown_error";
    this.fields = err?.details?.fields ?? {};
    this.requestId = err?.request_id;
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  get isValidation(): boolean {
    return this.status === 422;
  }
}

const BASE = "/api/v1";

/**
 * Refresh must be single-flight.
 *
 * The dashboard mounts several queries at once. If the access token is stale
 * they would each fire /auth/refresh in parallel, and the backend's rotation
 * treats a replayed token as theft — it revokes the whole family and signs the
 * user out. One shared promise means the rest await the first.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        credentials: "same-origin",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so concurrent callers all observe this result.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Internal: prevents an infinite refresh loop. */
  _retried?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, _retried, headers, ...rest } = options;

  const isFormData = body instanceof FormData;
  const init: RequestInit = {
    ...rest,
    credentials: "same-origin",
    headers: {
      // Same-origin marker the BFF checks; a cross-site form post cannot set it.
      "X-Requested-With": "fetch",
      ...(isFormData ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  };

  if (body !== undefined) {
    init.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, init);

  if (res.status === 401 && !_retried && !path.startsWith("/auth/")) {
    if (await refreshSession()) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, errorBody, `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

/** Build a query string, dropping empty and default-ish values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}
