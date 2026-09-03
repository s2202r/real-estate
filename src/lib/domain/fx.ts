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

/* ------------------------------------------------------------------------ *
 * Vetting a rate that arrived from somewhere else
 * ------------------------------------------------------------------------ */

/**
 * How far a rate may move from the one already stored before it is refused.
 *
 * Fifteen percent against the rupee is not a day's movement in any of the
 * currencies here; it is an upstream mistake. The commonest is an INVERTED
 * PAIR — asking for INR→USD and being handed USD→INR — which is a move of
 * about eight thousand percent and would price a ₹1 Cr flat at $10,000,000.
 */
export const MAX_RATE_MOVE_PERCENT = 15;

export interface RateVetResult {
  readonly accepted: boolean;
  /** Why it was refused. Present only when `accepted` is false. */
  readonly reason?: string;
}

/**
 * Decide whether a fetched rate may replace what is stored.
 *
 * A STALE RATE IS BETTER THAN A WRONG ONE. A rate a week old is visibly a rate
 * a week old — the label says so — whereas a wrong rate looks exactly like a
 * right one and silently misprices every property on the site. So an automatic
 * refresh has to be able to refuse, and refusing has to leave the old value in
 * place rather than clearing it.
 */
export function vetIncomingRate(input: {
  readonly incoming: ExchangeRate;
  /** What is stored for the pair, if anything. */
  readonly existing?: ExchangeRate | null;
  readonly now: Date;
  /**
   * A plausible band for a first rate, when there is nothing to compare with.
   * For a rupee base every currency here is worth far more than one rupee, so
   * the rate is well under 1 — which is exactly what catches an inverted pair
   * on the very first fetch, before any baseline exists.
   */
  readonly absoluteBounds?: { min: number; max: number };
  readonly maxMovePercent?: number;
}): RateVetResult {
  const { incoming, existing, now } = input;

  if (!isValidRate(incoming)) {
    return { accepted: false, reason: "the rate is not a usable number" };
  }

  // A day of slack: a provider publishing in another timezone is not an error.
  if (Date.parse(incoming.asOf) > now.getTime() + 86_400_000) {
    return { accepted: false, reason: "the rate is dated in the future" };
  }

  if (existing && Date.parse(incoming.asOf) < Date.parse(existing.asOf)) {
    return {
      accepted: false,
      reason: `it is older than the rate already stored (${existing.asOf})`,
    };
  }

  if (existing && isValidRate(existing)) {
    const movePercent = Math.abs((incoming.rate - existing.rate) / existing.rate) * 100;
    const limit = input.maxMovePercent ?? MAX_RATE_MOVE_PERCENT;
    if (movePercent > limit) {
      return {
        accepted: false,
        reason: `it moves ${movePercent.toFixed(1)}% from the stored rate, past the ${limit}% limit — usually an inverted pair or an upstream error`,
      };
    }
    return { accepted: true };
  }

  const bounds = input.absoluteBounds;
  if (bounds && (incoming.rate < bounds.min || incoming.rate > bounds.max)) {
    return {
      accepted: false,
      reason: `${incoming.rate} is outside the plausible range ${bounds.min}–${bounds.max} for ${incoming.from}→${incoming.to}`,
    };
  }

  return { accepted: true };
}
