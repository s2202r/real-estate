import { NextResponse } from "next/server";
import { appConfig } from "@/config/app";
import { isSupabaseConfigured } from "@/config/env";
import { features } from "@/config/features";

export const dynamic = "force-dynamic";

/**
 * Health and capability probe.
 *
 * Deliberately reports only whether integrations are CONFIGURED, never any
 * value: a health endpoint that echoes configuration is a reconnaissance gift.
 */
export function GET() {
  return NextResponse.json({
    data: {
      status: "ok",
      application: appConfig.name,
      apiVersion: "v1",
      database: isSupabaseConfigured() ? "configured" : "not_configured",
      features: Object.fromEntries(Object.entries(features).map(([key, value]) => [key, value])),
    },
  });
}
