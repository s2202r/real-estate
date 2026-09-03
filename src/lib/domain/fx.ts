import {
  minorPerMajor,
  money,
  MoneyError,
  type CurrencyCode,
  type Money,
} from "./money";

/**
 * Currency conversion, for showing an Indian price to a buyer who does not
 * think in rupees.
 *
 * WHAT THIS IS NOT. It is not a quote, not a rate anyone can transact at, and
 * not a live feed. Nothing on this platform is priced or settled in a foreign
 * currency: a transaction is in rupees, and remittance happens through the
 * buyer's own bank at whatever rate that bank gives on the day. A converted
 * figure here exists so somebody in Dubai can tell at a glance whether a
 * property is worth a second look.
 *
 * That is why a rate is inseparable from the DATE IT WAS SET, and why every
 * conversion carries it. A number shown without its age invites reliance it
 * cannot bear — and a rate nobody has updated for eight months is worse than
 * no conversion at all, because it looks exactly like a fresh one. `staleAfter`
 * makes that state visible rather than leaving it to be noticed.
 *
 * Pure and integer-only. Same discipline as money.ts: no float ever holds an
 * amount, and the rate is applied in minor units.
 */

export interface ExchangeRate {
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
  /** Units of `to` for one unit of `from`. */
  readonly rate: number;
  /** When the rate was recorded. ISO date or timestamp. */
  readonly asOf: string;
  /** Where it came from, for the label. e.g. "set by an administrator". */
  readonly source?: string;
}

export interface ConvertedMoney {
  readonly amount: Money;
  readonly rate: ExchangeRate;
  /** Whole days between the rate's date and the reference instant. */
  readonly ageDays: number;
  /** True once the rate is too old to show without a warning. */
  readonly stale: boolean;
}

/** A rate older than this is flagged. Currencies move; a week is generous. */
export const DEFAULT_STALE_AFTER_DAYS = 7;

export function isValidRate(rate: ExchangeRate): boolean {
  return (
    Number.isFinite(rate.rate) &&
    rate.rate > 0 &&
    rate.from !== rate.to &&
    !Number.isNaN(Date.parse(rate.asOf))
  );
}

/**
 * Convert an amount using a rate.
 *
 * Throws on a rate that does not apply to the amount, rather than silently
 * producing a number: a price shown in the wrong currency is indistinguishable
 * from a correct one, and there is no recovering from it downstream.
 */
export function convert(
  amount: Money,
  rate: ExchangeRate,
  now: Date,
  staleAfterDays = DEFAULT_STALE_AFTER_DAYS,
): ConvertedMoney {
  if (!isValidRate(rate)) {
    throw new MoneyError(`Exchange rate ${rate.from}->${rate.to} is not usable.`);
  }
  if (amount.currency !== rate.from) {
    throw new MoneyError(
      `Cannot apply a ${rate.from}->${rate.to} rate to an amount in ${amount.currency}.`,
    );
  }

  // Major units of the source, scaled into minor units of the target. Done in
  // one expression so there is a single rounding step.
  const converted = Math.round(
    (amount.amountMinor / minorPerMajor(rate.from)) * rate.rate * minorPerMajor(rate.to),
  );

  const ageDays = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(rate.asOf)) / 86_400_000),
  );

  return {
    amount: money(converted, rate.to),
    rate,
    ageDays,
    stale: ageDays > staleAfterDays,
  };
}

/**
 * Find the rate for a pair, inverting one that is recorded the other way round.
 *
 * Rates are stored one-directional (INR→USD), and a caller asking for USD→INR
 * should not have to know that. Inversion is exact enough for a display figure
 * and avoids a second row that can drift out of step with the first.
 */
export function findRate(
  rates: readonly ExchangeRate[],
  from: CurrencyCode,
  to: CurrencyCode,
): ExchangeRate | null {
  if (from === to) return null;

  const direct = rates.find((rate) => rate.from === from && rate.to === to);
  if (direct && isValidRate(direct)) return direct;

  const inverse = rates.find((rate) => rate.from === to && rate.to === from);
  if (inverse && isValidRate(inverse)) {
    return {
      from,
      to,
      rate: 1 / inverse.rate,
      asOf: inverse.asOf,
      source: inverse.source,
    };
  }

  return null;
}

/** How the conversion reads under a price: "≈ $12,000 · rate of 3 Sep 2026". */
export function describeRate(converted: ConvertedMoney, locale = "en-IN"): string {
  const on = new Date(converted.rate.asOf).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return converted.stale
    ? `indicative, from a rate last set on ${on} — ${converted.ageDays} days ago`
    : `indicative, at the rate on ${on}`;
}
