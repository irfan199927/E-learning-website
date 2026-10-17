/**
 * Runs before every page request:
 *  1. Per-request nonce-based Content-Security-Policy (no 'unsafe-inline' scripts).
 *  2. Cheap auth gate: no session cookie → redirect to /sign-in. (Real validation happens
 *     server-side in layouts and API routes; this only avoids rendering for signed-out users.)
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/calendar", "/library", "/assignments", "/messages", "/admin"];

function csp(nonce: string): string {
  const storage = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).origin : "";
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // React style props + FullCalendar inject styles
    `img-src 'self' data: blob: https://lh3.googleusercontent.com ${storage}`,
    "font-src 'self' data:", // FullCalendar ships its icon font inline
    // Video segments and direct-to-storage multipart uploads.
    `connect-src 'self' ${storage}${isDev ? " ws:" : ""}`,
    `media-src 'self' blob: ${storage}`,
    "worker-src 'self'", // the PWA service worker (public/sw.js)
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
    "base-uri 'self'",
    "object-src 'none'",
    // Only on HTTPS deployments: on a plain-HTTP LAN host it would send every asset request to https:// and fail.
    ...(!isDev && process.env.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !getSessionCookie(req)) {
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set("next", pathname + search);
    return NextResponse.redirect(signIn);
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", policy);
  if (process.env.APP_URL?.startsWith("https://")) {
    res.headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
    res.headers.set("cross-origin-opener-policy", "same-origin");
  }
  return res;
}

export const config = {
  // Pages only — API routes, static assets and images skip the middleware.
  matcher: [{ source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)" }],
};
