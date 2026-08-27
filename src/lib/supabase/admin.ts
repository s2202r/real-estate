import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv, getServerEnv } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * The `import "server-only"` above turns any attempt to pull this into a client
 * bundle into a BUILD ERROR rather than a code-review finding.
 *
 * Legitimate uses, and only these:
 *   - admin moderation and verification queues (cross-tenant by definition)
 *   - the commission engine's transactional writes
 *   - writing audit and contact-access logs, which users must not be able to
 *     forge or suppress
 *   - background jobs and seeds
 *
 * Every caller must perform its OWN authorisation check first: with this client
 * the database will not do it for you. See lib/auth/permissions.ts.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Privileged operations are unavailable.",
    );
  }

  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-application-name": "getmespace-admin" } },
    },
  );
}

/** True when privileged operations can run in this environment. */
export function isAdminClientAvailable(): boolean {
  try {
    return Boolean(getServerEnv().SUPABASE_SERVICE_ROLE_KEY);
  } catch {
    return false;
  }
}
