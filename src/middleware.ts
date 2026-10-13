import { NextResponse, type NextRequest } from "next/server";

/**
 * Rolling session cookie.
 *
 * WHY THIS EXISTS
 * Sliding renewal extends the session's *database* expiry, but a cookie's
 * Max-Age can only be refreshed by writing the cookie again — and Next.js
 * forbids cookie mutation during a normal Server Component render. Middleware
 * is the one place allowed to write cookies on an ordinary GET, so the
 * cookie's lifetime is refreshed here while the database renewal stays in
 * src/server/auth/session.ts.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *   - no database access
 *   - no session validation, no authentication or authorization decision
 *   - no redirects
 *   - no token rotation (the value is rewritten unchanged)
 * Route protection remains exclusively server-side via requireContext() at the
 * resource boundary. If the token is invalid, expired or forged, re-writing it
 * here changes nothing: the server still resolves it to an unauthenticated
 * request. Because the value never changes, concurrent requests and multiple
 * tabs cannot race or trigger an authentication loop.
 */

const SESSION_COOKIE_NAME = "nexaflow_session";
const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // mirrors SESSION_LIFETIME_MS

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  /*
   * Only roll the cookie on idempotent navigations.
   *
   * Session-mutating requests (Server Actions and Route Handlers — always
   * POST/PUT/PATCH/DELETE) set the session cookie themselves: login and signup
   * issue a NEW token, logout clears it. If middleware also wrote the cookie on
   * those requests, the response would carry TWO conflicting Set-Cookie headers
   * for the same name — the stale request token AND the action's new value.
   * Browsers and proxies are not required to agree on which one wins, so the
   * stale token could survive a login (user appears not to be logged in) or a
   * cleared session could be resurrected after logout. Skipping non-idempotent
   * methods keeps exactly one authority over the cookie per request.
   */
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response;
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return response;

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}

export const config = {
  // Skip static assets and image optimization; those requests do not need a
  // refreshed cookie and would only add Set-Cookie noise.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
