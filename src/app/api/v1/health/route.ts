import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { appConfig, missingLegalParticulars } from "@/config/app";
import { configWarnings, isSupabaseConfigured } from "@/config/env";
import { features } from "@/config/features";
import { getNotificationProvider } from "@/lib/providers/notifications";
import { canSendAuthCode } from "@/lib/services/auth-email";

export const dynamic = "force-dynamic";

/**
 * Health and capability probe.
 *
 * Deliberately reports only whether integrations are CONFIGURED, never any
 * value: a health endpoint that echoes configuration is a reconnaissance gift.
 *
 * `configWarnings` is the exception that proves the rule — it names variables
 * that are malformed and says how, without ever echoing what they contain.
 * A deployment that is quietly degraded because of a typo is worth being able
 * to diagnose in one request.
 *
 * It also answers a question that keeps coming up: WHICH BUILD IS THIS, AND
 * WHAT HOST DID YOU REACH IT ON. When one hostname works and another fails —
 * www serving fine while the apex returns 500 — the first thing to establish
 * is whether the two even reach the same deployment. Nothing in this app
 * branches on the host, so if they land on the same build they behave the
 * same, and a difference means the failing host is being routed somewhere
 * else: an older deployment, another project, or a DNS record pointing off
 * the platform entirely.
 *
 * The commit SHA and region come from the platform's own build-time variables
 * and identify a build, not a secret.
 */
export async function GET() {
  const requestHeaders = await headers();

  return NextResponse.json({
    data: {
      status: "ok",
      application: appConfig.name,
      apiVersion: "v1",
      database: isSupabaseConfigured() ? "configured" : "not_configured",
      features: Object.fromEntries(Object.entries(features).map(([key, value]) => [key, value])),
      configWarnings: configWarnings(),
      // Particulars the legal pages are required to state and cannot invent.
      missingLegalParticulars: missingLegalParticulars(),
      /**
       * Whether a sign-in code can actually reach somebody.
       *
       * `provider: "console"` with `authCodes: "supabase_fallback"` is the
       * shape of a deployment that believes it is sending email and is not:
       * EMAIL_PROVIDER is unset, misspelled, or was rejected by validation —
       * check `configWarnings` above, which names it when that is the cause.
       */
      email: {
        provider: getNotificationProvider("EMAIL")?.name ?? "none",
        configured: getNotificationProvider("EMAIL")?.isConfigured() ?? false,
        deliversExternally: getNotificationProvider("EMAIL")?.deliversExternally ?? false,
        authCodes: canSendAuthCode() ? "sent_by_app" : "supabase_fallback",
      },
      deployment: {
        /** The hostname this request actually arrived on. */
        host: requestHeaders.get("host"),
        /** What the app believes its own address is, from NEXT_PUBLIC_APP_URL. */
        configuredUrl: appConfig.url,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        region: process.env.VERCEL_REGION ?? null,
      },
    },
  });
}
