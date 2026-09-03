import "server-only";

import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { getRateProvider, providerCovers } from "@/lib/providers/fx";
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
  /**
   * Rates the provider returned that DID NOT PASS VETTING. A judgement about
   * the data: the figure was implausible, so the stored rate was kept.
   */
  readonly rejected: readonly { pair: string; reason: string }[];
  /**
   * Rates that passed vetting and then COULD NOT BE WRITTEN. Not a judgement
   * about the data at all — the database refused, or is not there. Kept apart
   * from `rejected` because reporting a missing table as a "refused rate"
   * sends somebody looking at the feed when the problem is the schema.
   */
  readonly failed: readonly { pair: string; reason: string }[];
  /** Currencies this provider carries but did not return this time. */
  readonly missing: readonly string[];
  /** Currencies this provider will NEVER return. Asking again will not help. */
  readonly unsupported: readonly string[];
  readonly error?: string;
}

export async function refreshExchangeRates(options: {
  /** Recorded on the audit entry. Null for a scheduled run. */
  readonly actorId?: string | null;
  readonly trigger: "cron" | "admin";
}): Promise<RateRefreshOutcome> {
  const provider = getRateProvider();

  const unsupported = QUOTE_CURRENCIES.filter((quote) => !providerCovers(provider, quote));
  const askable = QUOTE_CURRENCIES.filter((quote) => providerCovers(provider, quote));

  const empty = {
    provider: provider.name,
    updated: [],
    rejected: [],
    failed: [],
    missing: askable,
    unsupported,
  } as const;

  if (!provider.isConfigured()) {
    return {
      ...empty,
      missing: [...QUOTE_CURRENCIES],
      unsupported: [],
      error: "No exchange-rate provider is configured. Set FX_PROVIDER.",
    };
  }

  if (!isAdminClientAvailable()) {
    return {
      ...empty,
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured, so rates cannot be written.",
    };
  }

  const base = appConfig.currency as CurrencyCode;
  // Only ask for what this feed can actually supply. Asking for the rest just
  // produces an absence that looks like an outage.
  const fetched = await provider.fetchRates(base, askable);

  if (fetched.error && fetched.rates.length === 0) {
    return { ...empty, error: fetched.error };
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
  const failed: { pair: string; reason: string }[] = [];

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
      // The rate was fine; the write was not. Different problem, different list.
      failed.push({ pair: `${base}->${candidate.quote}`, reason: error.message });
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
  const missing = askable.filter((quote) => !returnedQuotes.has(quote));

  // A refusal is not a failure of the run — the other pairs still updated —
  // but it must be visible, or a pair silently stops being refreshed.
  for (const refusal of rejected) {
    console.warn(`[exchange-rates] refused ${refusal.pair}: ${refusal.reason}`);
  }
  for (const failure of failed) {
    console.error(`[exchange-rates] could not store ${failure.pair}: ${failure.reason}`);
  }

  return {
    provider: provider.name,
    updated,
    rejected,
    failed,
    missing,
    unsupported,
    ...(fetched.error ? { error: fetched.error } : {}),
  };
}

/**
 * A one-line account of a run, for an administrator and for a log.
 *
 * Each category is named for what it actually is. "Refused" is a judgement
 * about a figure; "could not store" is the database being unavailable or the
 * migration not applied; "does not publish" is permanent and needs a different
 * feed. Collapsing them, as this did at first, sends people to inspect a feed
 * that is working perfectly.
 */
export function describeRefresh(outcome: RateRefreshOutcome): string {
  const parts: string[] = [];

  if (outcome.updated.length > 0) parts.push(`updated ${outcome.updated.join(", ")}`);

  if (outcome.failed.length > 0) {
    const reason = outcome.failed[0]?.reason ?? "";
    const schemaMissing = /schema cache|does not exist|relation .* does not exist/i.test(reason);
    parts.push(
      schemaMissing
        ? `could not store ${outcome.failed.map((f) => f.pair).join(", ")} — the exchange_rates table is not in the database. Apply migration 20250101000016_nri_and_valuation.sql`
        : `could not store ${outcome.failed.map((f) => `${f.pair} (${f.reason})`).join("; ")}`,
    );
  }

  if (outcome.rejected.length > 0) {
    parts.push(
      `refused ${outcome.rejected.map((item) => `${item.pair} (${item.reason})`).join("; ")}`,
    );
  }

  if (outcome.missing.length > 0) {
    parts.push(`${outcome.provider} returned nothing for ${outcome.missing.join(", ")} this time`);
  }

  if (outcome.unsupported.length > 0) {
    parts.push(
      `${outcome.provider} does not publish ${outcome.unsupported.join(", ")} — set FX_PROVIDER=open_er_api to cover ${
        outcome.unsupported.length > 1 ? "them" : "it"
      }, or keep ${outcome.unsupported.length > 1 ? "those rates" : "that rate"} by hand`,
    );
  }

  if (parts.length === 0) return `From ${outcome.provider}: every rate was already current.`;
  return `From ${outcome.provider}: ${parts.join(" · ")}.`;
}
