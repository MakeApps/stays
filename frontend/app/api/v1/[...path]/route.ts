import { type NextRequest, NextResponse } from "next/server";

/**
 * BFF proxy.
 *
 * The browser only ever talks to this origin, so the auth cookies are
 * first-party and httpOnly and no token is reachable from JavaScript. The path
 * is mounted at /api/v1 to match Flask exactly — the refresh cookie is scoped
 * to Path=/api/v1/auth/refresh, and a different mount point would silently
 * stop the browser sending it.
 */

const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

// Hop-by-hop headers must not be forwarded; Content-Length is recomputed.
const STRIP_REQUEST = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
]);
const STRIP_RESPONSE = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const target = new URL(`/api/v1/${path.join("/")}`, API_ORIGIN);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });
  // Preserve the caller's address for rate limiting and the audit trail.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) headers.set("X-Forwarded-For", forwarded);

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "upstream_unavailable",
          message: "The API is not reachable. Is the backend running?",
        },
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE.has(key.toLowerCase())) responseHeaders.append(key, value);
  });

  // getSetCookie preserves multiple Set-Cookie headers, which a plain
  // headers.get() would collapse into one string and corrupt.
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    responseHeaders.delete("set-cookie");
    for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Context) {
  return proxy(request, (await ctx.params).path);
}
