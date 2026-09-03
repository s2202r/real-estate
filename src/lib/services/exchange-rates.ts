import "server-only";

import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { getRateProvider } from "@/lib/providers/fx";
import { recordAudit } from "@/lib/services/audit";
import { vetIncomingRate, type ExchangeRate } from "@/lib/domain/fx";
import { appConfig } from "@/config/app";
import type { CurrencyCode } from "@/lib/domain/money";

/**
 * Refreshing the indicative rates.
 *
 * The rates the site shows are display figures with a published date. Keeping
 * them current by hand means they are current for a week and then quietly are
 * not, so this fetches them — but it fetches them SUSPICIOUSLY.
 *
 * A stale rate is better than a wrong one. A week-old rate is visibly a
 * week-old rate, because the label says so; a wrong one looks exactly like a
 * right one and misprices every property on the site. So every figure is vetted
 * against what is already stored, a refusal leaves the old value in place
 * rather than clearing it, and each refusal is reported by name instead of
 * being counted as a failure of the whole run.
 */

/** The currencies offered as a second display currency. */
export const QUOTE_CURRENCIES: readonly CurrencyCode[] = ["USD", "AED", "GBP", "EUR", "SGD"];

/**
 * A plausible band for a FIRST rate against the rupee.
 *
 * Every currency above is worth many rupees, so one rupee buys a small
 * fraction of any of them — the rate is well under 1. That single fact is what
 * catches an inverted pair on the very first fetch, when there is no stored
 * rate to compare against. Revisit it only if a quote currency is ever added
 * that is worth less than a rupee.
 */
const FIRST_RATE_BOUNDS = { min: 1e-6, max: 1 };

export interface RateRefreshOutcome {
  readonly provider: string;
  readonly updated: readonly string[];
  /** Pairs the provider returned that were refused, with the reason. */
  readonly rejected: readonly { pair: string; reason: string }[];
  /** Pairs the provider did not return at all. */
  readonly missing: readonly string[];
  readonly error?: string;
}

export async function refreshExchangeRates(options: {
  /** Recorded on the audit entry. Null for a scheduled run. */
  readonly actorId?: string | null;
  readonly trigger: "cron" | "admin";
}): Promise<RateRefreshOutcome> {
  const provider = getRateProvider();

  if (!provider.isConfigured()) {
    return {
      provider: provider.name,
      updated: [],
      rejected: [],
      missing: [...QUOTE_CURRENCIES],
      error: "No exchange-rate provider is configured. Set FX_PROVIDER.",
    };
  }

  if (!isAdminClientAvailable()) {
    return {
      provider: provider.name,
      updated: [],
      rejected: [],
      missing: [...QUOTE_CURRENCIES],
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured, so rates cannot be written.",
    };
  }

  const base = appConfig.currency as CurrencyCode;
  const fetched = await provider.fetchRates(base, QUOTE_CURRENCIES);

  if (fetched.error && fetched.rates.length === 0) {
    return {
      provider: provider.name,
      updated: [],
      rejected: [],
      missing: [...QUOTE_CURRENCIES],
      error: fetched.error,
    };
  }

  const admin = createAdminClient();
  const { data: storedRows } = await admin
    .from("exchange_rates")
    .select("quote_currency, rate, as_of")
    .eq("base_currency", base);

  const stored = new Map(
    (storedRows ?? []).map((row) => [
      row.quote_currency,
      {
        from: base,
        to: row.quote_currency as CurrencyCode,
        rate: Number(row.rate),
        asOf: row.as_of,
      } satisfies ExchangeRate,
    ]),
  );

  const now = new Date();
  const updated: string[] = [];
  const rejected: { pair: string; reason: string }[] = [];

  for (const candidate of fetched.rates) {
    const incoming: ExchangeRate = {
      from: base,
      to: candidate.quote,
      rate: candidate.rate,
      asOf: candidate.asOf,
      source: `${provider.name}, fetched ${now.toISOString().slice(0, 10)}`,
    };

    const existing = stored.get(candidate.quote) ?? null;
    const verdict = vetIncomingRate({
      incoming,
      existing,
      now,
      absoluteBounds: existing ? undefined : FIRST_RATE_BOUNDS,
    });

    if (!verdict.accepted) {
      rejected.push({
        pair: `${base}->${candidate.quote}`,
        reason: verdict.reason ?? "refused",
      });
      continue;
    }

    // Nothing to do when the stored rate is already this rate for this date.
    if (existing && existing.rate === incoming.rate && existing.asOf === incoming.asOf) {
      continue;
    }

    const { error } = await admin.from("exchange_rates").upsert(
      {
        base_currency: base,
        quote_currency: candidate.quote,
        rate: String(candidate.rate),
        as_of: candidate.asOf,
        source: incoming.source ?? null,
        updated_by: options.actorId ?? null,
      },
      { onConflict: "base_currency,quote_currency" },
    );

    if (error) {
      rejected.push({ pair: `${base}->${candidate.quote}`, reason: error.message });
      continue;
    }

    updated.push(candidate.quote);

    await recordAudit({
      action: "admin.setting_changed",
      entityType: "EXCHANGE_RATE",
      entityCode: `${base}->${candidate.quote}`,
      actorId: options.actorId ?? null,
      actorRole: options.trigger === "cron" ? "system" : "admin",
      before: existing ? { rate: existing.rate, asOf: existing.asOf } : null,
      after: { rate: candidate.rate, asOf: candidate.asOf },
      reason: `Refreshed from ${provider.name} (${options.trigger}).`,
    });
  }

  const returnedQuotes = new Set(fetched.rates.map((rate) => rate.quote));
  const missing = QUOTE_CURRENCIES.filter((quote) => !returnedQuotes.has(quote));

  // A refusal is not a failure of the run — the other pairs still updated —
  // but it must be visible, or a pair silently stops being refreshed.
  for (const refusal of rejected) {
    console.warn(`[exchange-rates] refused ${refusal.pair}: ${refusal.reason}`);
  }

  return {
    provider: provider.name,
    updated,
    rejected,
    missing,
    ...(fetched.error ? { error: fetched.error } : {}),
  };
}
