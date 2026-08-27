import { z } from "zod";

/**
 * Environment validation.
 *
 * Two schemas, deliberately separate:
 *
 *  - `clientEnv` holds only NEXT_PUBLIC_* values. It is safe in the browser.
 *  - `getServerEnv()` reads secrets and is callable only on the server. It is
 *    a function rather than a module constant so that importing this file from
 *    a client component cannot throw or leak.
 *
 * Values are validated rather than trusted: a malformed SUPABASE_URL should
 * fail loudly at boot, not produce a confusing runtime error later.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url().or(z.literal("")).optional(),
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  MAP_PROVIDER: z.enum(["google", "none"]).default("none"),
  AI_PROVIDER: z.enum(["rules", "anthropic", "openai"]).default("rules"),
  AI_PROVIDER_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["console", "resend", "ses", "sendgrid"]).default("console"),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SMS_PROVIDER: z.enum(["noop", "msg91", "twilio"]).default("noop"),
  WHATSAPP_PROVIDER: z.enum(["noop", "meta_cloud", "gupshup"]).default("noop"),
  PUSH_PROVIDER: z.enum(["noop", "webpush", "fcm"]).default("noop"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Public configuration. Referenced with literal `process.env.X` keys so that
 * the Next.js compiler can inline them into the client bundle.
 */
export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "",
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
});

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must never be called in the browser.");
  }
  if (!cachedServerEnv) {
    cachedServerEnv = serverSchema.parse(process.env);
  }
  return cachedServerEnv;
}

/**
 * True when Supabase credentials are present. The app is designed to render
 * its public shell without them (useful for a first `vercel deploy` before the
 * database is wired up), so callers can degrade gracefully instead of crashing.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
