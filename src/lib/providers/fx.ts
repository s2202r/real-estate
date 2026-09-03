import "server-only";

import { getServerEnv } from "@/config/env";
import type { CurrencyCode } from "@/lib/domain/money";

/**
 * Exchange-rate provider abstraction.
 *
 * The application asks for "today's rates against the rupee" and never imports
 * a vendor SDK, the same arrangement as maps and notifications. Swapping one
 * feed for another is a config change.
 *
 * Rates are for DISPLAY. Nothing here is a dealing rate, and the service that
 * calls this vets every figure before it is stored — a wrong rate looks exactly
 * like a right one on a property page, so a feed is not trusted merely because
 * it answered.
 */

export interface FetchedRate {
  readonly quote: CurrencyCode;
  /** Units of `quote` for one unit of the base. */
  readonly rate: number;
  /** The date the provider says the rate is for, `YYYY-MM-DD`. */
  readonly asOf: string;
}

export interface RateFetchResult {
  readonly rates: readonly FetchedRate[];
  readonly provider: string;
  readonly error?: string;
}

export interface RateProvider {
  readonly name: string;
  isConfigured(): boolean;
  fetchRates(base: CurrencyCode, quotes: readonly CurrencyCode[]): Promise<RateFetchResult>;
}

/** Nothing configured: the manual editor in /admin/settings remains the way in. */
class NoRateProvider implements RateProvider {
  readonly name = "none";

  isConfigured(): boolean {
    return false;
  }

  async fetchRates(): Promise<RateFetchResult> {
    return {
      rates: [],
      provider: this.name,
      error: "No exchange-rate provider is configured (FX_PROVIDER).",
    };
  }
}

/**
 * Frankfurter — European Central Bank reference rates, no key required.
 *
 * The ECB publishes once a working day, so `date` in the response is the
 * business day the rates are FOR and is passed through unchanged rather than
 * replaced with today. On a Sunday that means Friday's date, which is correct
 * and is what the label should say.
 */
class FrankfurterRateProvider implements RateProvider {
  readonly name = "frankfurter";

  constructor(private readonly baseUrl = "https://api.frankfurter.app") {}

  isConfigured(): boolean {
    return true;
  }

  async fetchRates(
    base: CurrencyCode,
    quotes: readonly CurrencyCode[],
  ): Promise<RateFetchResult> {
    const url = `${this.baseUrl}/latest?base=${base}&symbols=${quotes.join(",")}`;

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        // A refresh is a background job; it must not hang a cron invocation.
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });

      if (!response.ok) {
        return {
          rates: [],
          provider: this.name,
          error: `Provider responded ${response.status}`,
        };
      }

      const payload = (await response.json()) as {
        date?: string;
        rates?: Record<string, number>;
      };

      if (!payload.date || !payload.rates) {
        return { rates: [], provider: this.name, error: "Response had no rates." };
      }

      return {
        rates: quotes
          .filter((quote) => typeof payload.rates?.[quote] === "number")
          .map((quote) => ({ quote, rate: payload.rates![quote]!, asOf: payload.date! })),
        provider: this.name,
      };
    } catch (error) {
      return {
        rates: [],
        provider: this.name,
        error: error instanceof Error ? error.message : "Request failed.",
      };
    }
  }
}

/**
 * open.er-api.com — no key, and covers currencies the ECB set does not.
 *
 * Its `time_last_update_utc` is the publication moment rather than a business
 * date, so it is reduced to a date. Reducing rather than defaulting to today
 * matters: the two differ across midnight UTC, and the label must not claim a
 * rate is newer than it is.
 */
class OpenErApiRateProvider implements RateProvider {
  readonly name = "open_er_api";

  constructor(private readonly baseUrl = "https://open.er-api.com/v6") {}

  isConfigured(): boolean {
    return true;
  }

  async fetchRates(
    base: CurrencyCode,
    quotes: readonly CurrencyCode[],
  ): Promise<RateFetchResult> {
    try {
      const response = await fetch(`${this.baseUrl}/latest/${base}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });

      if (!response.ok) {
        return { rates: [], provider: this.name, error: `Provider responded ${response.status}` };
      }

      const payload = (await response.json()) as {
        result?: string;
        time_last_update_utc?: string;
        rates?: Record<string, number>;
      };

      if (payload.result !== "success" || !payload.rates) {
        return { rates: [], provider: this.name, error: "Response was not a success." };
      }

      const published = payload.time_last_update_utc
        ? new Date(payload.time_last_update_utc)
        : new Date();
      const asOf = Number.isNaN(published.getTime())
        ? new Date().toISOString().slice(0, 10)
        : published.toISOString().slice(0, 10);

      return {
        rates: quotes
          .filter((quote) => typeof payload.rates?.[quote] === "number")
          .map((quote) => ({ quote, rate: payload.rates![quote]!, asOf })),
        provider: this.name,
      };
    } catch (error) {
      return {
        rates: [],
        provider: this.name,
        error: error instanceof Error ? error.message : "Request failed.",
      };
    }
  }
}

let cached: RateProvider | null = null;

export function getRateProvider(): RateProvider {
  if (cached) return cached;

  const { FX_PROVIDER } = getServerEnv();
  cached =
    FX_PROVIDER === "frankfurter"
      ? new FrankfurterRateProvider()
      : FX_PROVIDER === "open_er_api"
        ? new OpenErApiRateProvider()
        : new NoRateProvider();

  return cached;
}

/** Test seam: point the registry at a stub. */
export function setRateProviderForTests(provider: RateProvider | null): void {
  cached = provider;
}
