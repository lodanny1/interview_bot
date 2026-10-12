// Route protection (Issue #03, overlaps #44). Sends visitors without a session
// cookie to /login. This is only a fast presence check: pages and actions must
// still verify the token with readSession() before trusting who the user is.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

export const PUBLIC_PATHS = ["/login", "/signup", "/landing"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Skip Next internals and static files so CSS, JS and images still load.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.[\w]+$).*)"],
};
