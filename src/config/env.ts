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
 * VALIDATION NEVER THROWS. It used to: a `parse()` at module scope meant one
 * malformed variable — a URL pasted without its `https://` — raised at import
 * time, before any route could load. The result was a bare
 * `500 Internal Server Error` with no body, no digest and no error boundary,
 * on every page of the site, from one typo in a dashboard.
 *
 * A misconfigured deployment must degrade, not disappear. Bad values are
 * dropped (the app then behaves exactly as it does when that integration is
 * absent), the reason is logged once per variable, and `configWarnings()`
 * reports it through the health endpoint so the problem is findable without
 * reading a server log.
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

/** Variable name → what is wrong with it. Values are never recorded. */
const warnings = new Map<string, string>();

function warn(variable: string, problem: string): void {
  if (warnings.has(variable)) return;
  warnings.set(variable, problem);
  // Server-side only: in the browser this would be noise the visitor cannot act on.
  if (typeof window === "undefined") {
    console.warn(`[config] ${variable}: ${problem}`);
  }
}

/**
 * Normalise a URL-shaped variable before validation.
 *
 * Two mistakes account for nearly every broken deployment, and both are
 * unambiguous enough to correct rather than reject:
 *
 *  - Surrounding whitespace, from copying out of a dashboard.
 *  - A missing scheme ("getmespace.in"). There is no plausible reading of that
 *    other than https, and the alternative is an offline site.
 *
 * Anything still unparseable is dropped, not guessed at.
 */
export function normaliseUrl(raw: string | undefined, variable: string): string {
  const value = raw?.trim();
  if (!value) return "";

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  if (candidate !== value) {
    warn(variable, `no scheme, read as ${candidate.split("://")[0]}://`);
  }

  try {
    const url = new URL(candidate);
    // A trailing slash here becomes a double slash in every canonical URL and
    // OG tag built from it.
    return url.origin + url.pathname.replace(/\/$/, "") + url.search;
  } catch {
    warn(variable, "is not a valid URL and has been ignored");
    return "";
  }
}

function readClientEnv(): ClientEnv {
  const candidate = {
    NEXT_PUBLIC_SUPABASE_URL: normaliseUrl(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
    NEXT_PUBLIC_APP_URL: normaliseUrl(process.env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL"),
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  };

  const parsed = clientSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  // Should be unreachable after normalisation, but a schema change must never
  // be able to take the site down. Drop the offending fields and carry on.
  for (const issue of parsed.error.issues) {
    warn(String(issue.path[0] ?? "unknown"), `${issue.message}; ignored`);
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    NEXT_PUBLIC_APP_URL: "",
    NEXT_PUBLIC_APP_NAME: candidate.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: candidate.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  };
}

/**
 * Public configuration. Referenced with literal `process.env.X` keys so that
 * the Next.js compiler can inline them into the client bundle.
 */
export const clientEnv: ClientEnv = readClientEnv();

/**
 * Read the server environment ONE VARIABLE AT A TIME.
 *
 * This used to validate `process.env` as a single object and, on any failure,
 * fall back to the schema's defaults — which discarded every real value,
 * including the service-role key. One unrelated variable set to something the
 * schema did not recognise ("MAP_PROVIDER=mapbox") therefore took privileged
 * operations down across the admin console, and the message on screen —
 * "Administrative operations are unavailable in this environment" — pointed
 * nowhere near the cause.
 *
 * Validating field by field keeps the blast radius to the variable that is
 * actually wrong: that one falls back to its default and is reported by name,
 * and everything else is used as configured.
 */
function readServerEnv(): ServerEnv {
  const result: Record<string, unknown> = {};

  for (const [variable, field] of Object.entries(serverSchema.shape)) {
    // Whitespace comes free with anything pasted out of a dashboard, and a
    // variable set to "" is one somebody left blank, not one they set.
    const raw = process.env[variable]?.trim();
    const value = raw === "" ? undefined : raw;

    const parsed = field.safeParse(value);
    if (parsed.success) {
      result[variable] = parsed.data;
      continue;
    }

    warn(variable, `${parsed.error.issues[0]?.message ?? "is invalid"}; using the default`);
    const fallback = field.safeParse(undefined);
    result[variable] = fallback.success ? fallback.data : undefined;
  }

  return result as ServerEnv;
}

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must never be called in the browser.");
  }

  if (!cachedServerEnv) cachedServerEnv = readServerEnv();
  return cachedServerEnv;
}

/**
 * Every environment variable found to be misconfigured, as
 * `{ variable, problem }`. Names and problems only — never values, which is
 * what makes it safe to surface through the health endpoint.
 */
export function configWarnings(): { variable: string; problem: string }[] {
  return [...warnings.entries()].map(([variable, problem]) => ({ variable, problem }));
}

/**
 * True when Supabase credentials are present. The app is designed to render
 * its public shell without them (useful for a first `vercel deploy` before the
 * database is wired up), so callers can degrade gracefully instead of crashing.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(clientEnv.NEXT_PUBLIC_SUPABASE_URL && clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
