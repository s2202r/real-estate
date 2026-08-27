import { isSupabaseConfigured } from "@/config/env";
import type { ActionResult } from "./leads";

/**
 * Guard for server actions when the database is not configured.
 *
 * The app is designed to render its public shell without Supabase credentials
 * — every read path checks `isSupabaseConfigured()` and degrades to empty
 * results. Writes had no such check: `createClient()` would throw, the action
 * would return a 500, and the browser would show an opaque error digest. The
 * most common cause is real and mundane — the environment variables are not
 * set on the deployment — and a 500 tells nobody that.
 *
 * Actions call this first and return its result, so a misconfigured deployment
 * says what is wrong instead of failing anonymously.
 */
// `never` for the payload: the guard never carries data, and this keeps the
// result assignable to an action of any payload type without each call site
// having to name it.
export function serviceUnavailable(): ActionResult<never> | null {
  if (isSupabaseConfigured()) return null;
  return {
    ok: false,
    message:
      "This service is not connected to its database yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on the deployment and redeploy.",
  };
}
