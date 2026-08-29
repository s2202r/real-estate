import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Session refresh and coarse route gating.
 *
 * This is a UX optimisation, NOT the security boundary: it avoids rendering a
 * dashboard shell for a signed-out visitor. Authorisation is enforced by
 * Postgres RLS and by the server-side capability checks in lib/auth.
 */

const PROTECTED_PREFIXES = ["/dashboard", "/agent", "/investor", "/admin"] as const;
const AUTH_PAGES = ["/login", "/register"] as const;

export async function middleware(request: NextRequest) {
  try {
    return await route(request);
  } catch (error) {
    // Middleware runs before everything. A throw here is not a page error with
    // a digest and an error boundary — it is an empty 500 on every route in the
    // app, which is indistinguishable from the site being down. Whatever went
    // wrong, letting the request through is the better failure.
    console.error("[middleware] failed, passing the request through", error);
    return NextResponse.next();
  }
}

async function route(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // A signed-in user has no use for the login page.
  if (user && AUTH_PAGES.includes(pathname as (typeof AUTH_PAGES)[number])) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never need a
     * session refresh, and excluding them keeps middleware off the hot path.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
