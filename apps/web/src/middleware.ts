import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes handle their own auth — never intercept
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Ignore static assets
  if (pathname.startsWith("/_next/") || pathname.match(/\.(.*)$/)) {
    return NextResponse.next();
  }

  // Check better-auth session token presence optimistically
  const sessionCookie = 
    request.cookies.get("better-auth.session_token")?.value || 
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  // Redirect authenticated users away from auth pages
  if (sessionCookie && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Public non-auth routes and auth pages
  if (
    pathname === "/" ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/join/") ||
    pathname === "/sign-in" ||
    pathname === "/sign-up"
  ) {
    return NextResponse.next();
  }

  // Unauthenticated users trying to access protected routes (like /dashboard) get redirected
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Real org-state routing happens in server components (layout.tsx, onboarding/page.tsx)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
