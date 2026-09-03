import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/config/env";
import { features } from "@/config/features";
import { describeRefresh, refreshExchangeRates } from "@/lib/services/exchange-rates";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Scheduled refresh of the indicative exchange rates.
 *
 * Called by the platform's scheduler (see vercel.json). It writes with the
 * service-role client, so the ONLY thing standing between the open internet
 * and that is the shared secret below — which is why it is compared in
 * constant time and why an unset secret closes the endpoint rather than
 * opening it.
 *
 * The response says what happened per pair. A refusal is reported, not hidden:
 * a pair that quietly stops refreshing would go on showing a rate that looks
 * current for as long as nobody checked.
 */
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  if (!features.ENABLE_NRI_MODE) {
    return NextResponse.json(
      { error: { message: "NRI mode is off; there is nothing to refresh." } },
      { status: 404 },
    );
  }

  const { CRON_SECRET } = getServerEnv();

  // No secret configured means no scheduled refresh. Failing closed is the
  // only safe reading: the alternative is an unauthenticated endpoint that
  // writes to the database on demand.
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: { message: "CRON_SECRET is not configured." } },
      { status: 503 },
    );
  }

  const offered = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!matches(offered, CRON_SECRET)) {
    return NextResponse.json({ error: { message: "Not authorised." } }, { status: 401 });
  }

  const outcome = await refreshExchangeRates({ trigger: "cron" });

  // Non-200 so the scheduler's own log shows a failed run rather than a green
  // tick over an empty result. A provider outage and a database that cannot be
  // written to are both real failures; a vetting refusal is not — that is the
  // safeguard doing its job.
  const providerDown = Boolean(outcome.error) && outcome.updated.length === 0;
  const cannotStore = outcome.failed.length > 0;

  return NextResponse.json(
    { data: { ...outcome, summary: describeRefresh(outcome) } },
    { status: providerDown ? 502 : cannotStore ? 500 : 200 },
  );
}

/**
 * Constant-time comparison.
 *
 * `===` on a secret leaks its length and its matching prefix through timing.
 * The lengths are compared first because `timingSafeEqual` throws on a
 * mismatch, and a length check is not the part worth hiding.
 */
function matches(offered: string, expected: string): boolean {
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
