import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { getSessionUser } from "@/lib/auth/session";
import { features } from "@/config/features";
import { appConfig } from "@/config/app";
import { findRate, type ExchangeRate } from "@/lib/domain/fx";
import { resolveTimeZone } from "@/lib/domain/timezones";
import type { CurrencyCode } from "@/lib/domain/money";

/**
 * The viewer's NRI context, resolved once per request.
 *
 * Pages should not each work out "is this person abroad, in what currency, on
 * whose clock" — three pages doing it three ways is how a price appears in
 * dollars on one screen and rupees on the next. `cache()` makes it one read.
 *
 * When the module is off, or nobody is signed in, or the customer has not said
 * they are abroad, this resolves to the platform's own defaults and every
 * caller renders exactly what it rendered before.
 */

export interface NriContext {
  /** True only when the module is on AND the customer has opted in. */
  readonly active: boolean;
  /** The zone to show times in. The platform's own when not active. */
  readonly timeZone: string;
  /** The second currency to show alongside the rupee price, if any. */
  readonly currency: CurrencyCode | null;
  /** The rate for INR → currency, or null when no administrator has set one. */
  readonly rate: ExchangeRate | null;
}

const INACTIVE: NriContext = {
  active: false,
  timeZone: appConfig.timezone,
  currency: null,
  rate: null,
};

export const getNriContext = cache(async (): Promise<NriContext> => {
  if (!features.ENABLE_NRI_MODE || !isSupabaseConfigured()) return INACTIVE;

  const user = await getSessionUser();
  if (!user) return INACTIVE;

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("is_nri, preferred_timezone, display_currency")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!customer?.is_nri) return INACTIVE;

  const currency = (customer.display_currency ?? "INR") as CurrencyCode;
  const timeZone = resolveTimeZone(customer.preferred_timezone, appConfig.timezone);

  // A second currency identical to the first is not a second currency.
  if (currency === appConfig.currency) {
    return { active: true, timeZone, currency: null, rate: null };
  }

  const rates = await getExchangeRates();
  return {
    active: true,
    timeZone,
    currency,
    rate: findRate(rates, appConfig.currency as CurrencyCode, currency),
  };
});

/**
 * Every rate an administrator has set.
 *
 * Publicly readable by policy: the converted figure appears on a public
 * property page, so the rate behind it should be as inspectable as the price.
 */
export const getExchangeRates = cache(async (): Promise<ExchangeRate[]> => {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("exchange_rates")
    .select("base_currency, quote_currency, rate, as_of, source")
    .order("base_currency", { ascending: true });

  return (data ?? []).map((row) => ({
    from: row.base_currency as CurrencyCode,
    to: row.quote_currency as CurrencyCode,
    rate: Number(row.rate),
    asOf: row.as_of,
    source: row.source ?? undefined,
  }));
});
