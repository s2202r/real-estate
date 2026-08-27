import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv, isSupabaseConfigured } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Server Supabase client, scoped to the caller's session.
 *
 * Still the ANON key, so RLS applies. This is the client almost all server
 * code should use: it acts AS the user, which means a bug cannot accidentally
 * read another tenant's rows.
 */
export async function createClient() {
  // The Supabase client library's own message for missing credentials does not
  // say WHERE the credentials are missing from. On a deployment whose
  // environment variables were never set, that distinction is the whole
  // diagnosis, so say it plainly in the server log.
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from this environment. " +
        "Set them on the deployment and redeploy.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware, so this is safe to
            // ignore rather than crash the render.
          }
        },
      },
    },
  );
}
