import { NextResponse } from "next/server";
import { appConfig } from "@/config/app";
import { configWarnings, isSupabaseConfigured } from "@/config/env";
import { features } from "@/config/features";

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
 */
export function GET() {
  return NextResponse.json({
    data: {
      status: "ok",
      application: appConfig.name,
      apiVersion: "v1",
      database: isSupabaseConfigured() ? "configured" : "not_configured",
      features: Object.fromEntries(Object.entries(features).map(([key, value]) => [key, value])),
      configWarnings: configWarnings(),
    },
  });
}
