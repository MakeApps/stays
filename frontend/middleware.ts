import { type NextRequest, NextResponse } from "next/server";

/**
 * Cookie-presence routing only.
 *
 * This is deliberately NOT a security boundary — it does no signature
 * verification. Its job is to avoid a flash of the app shell before the server
 * layout redirects, and to bounce signed-in users away from /login. The actual
 * check lives in app/(app)/layout.tsx via getSession().
 */
const ACCESS_COOKIE = "ls_at";
const REFRESH_COOKIE = "ls_rt";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  if (pathname === "/login") {
    if (hasSession) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    // Round-trip the intended destination so sign-in lands where they meant.
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - /api/*      the BFF proxy handles its own auth
     *  - /_next/*    build output
     *  - /ds         dev-only design-system proof sheet
     *  - static files
     */
    "/((?!api|_next/static|_next/image|ds|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
