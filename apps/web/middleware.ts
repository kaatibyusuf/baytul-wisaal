import { NextResponse, type NextRequest } from "next/server";

/**
 * Convenience redirect only. The real authority is the API, which validates the session on
 * every request. This just avoids flashing a protected page to someone with no cookie.
 */
export function middleware(req: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "bw_session";
  if (!req.cookies.get(cookieName)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
