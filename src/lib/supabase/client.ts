"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Browser Supabase client.
 *
 * Uses the ANON key only. Every query it makes is subject to RLS, so a
 * compromised browser session can reach exactly the rows that user is entitled
 * to and no more.
 */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
