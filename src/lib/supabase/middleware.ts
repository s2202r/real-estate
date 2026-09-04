import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv, isSupabaseConfigured } from "@/config/env";
import { mightHaveSession } from "./has-session-cookie";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookie on every request and returns the
 * authenticated user, if any.
 *
 * This is session PLUMBING, not authorisation. Route gating in middleware is a
 * convenience that avoids rendering a dashboard shell for a signed-out visitor;
 * the real boundary is RLS plus the server-side checks in lib/auth/permissions.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return { response, user: null };
  }

  // No session cookie, no session to refresh. This runs on every request, and
  // for an anonymous visitor the round trip below could only ever return null.
  if (!mightHaveSession(request.cookies.getAll())) {
    return { response, user: null };
  }

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates against the auth server. getSession() would trust a
  // cookie the client could have tampered with.
  //
  // Wrapped because this runs on EVERY request: an exception here — a paused
  // project, a DNS failure, a TLS error — would escape into middleware and
  // return a bare 500 with no body and no digest for the whole site. A session
  // that cannot be refreshed means "signed out", not "the site is down".
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { response, user };
  } catch (error) {
    console.error("[middleware] session refresh failed", error);
    return { response, user: null };
  }
}
