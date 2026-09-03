import { formatMoney, fromMajor, money, type Money } from "./money";

/**
 * An indicative price range from comparable listings.
 *
 * WHAT THIS IS NOT, and the reason the wording matters more than the maths: it
 * is not a valuation. Nobody has seen the property, nobody has examined title,
 * and no two flats on the same floor are worth the same once one of them faces
 * the road. It is the range that VERIFIED LISTINGS IN THE SAME LOCALITY are
 * asking per square foot, multiplied by this property's area.
 *
 * Three decisions follow from that:
 *
 *  - A RANGE, never a single figure. One number invites reliance; "₹1.6–2.1 Cr
 *    across 14 comparable listings" is the same information without the false
 *    precision, and it is honest about how wide the real uncertainty is.
 *  - The interquartile range, not the full spread. A locality usually has one
 *    listing at a wild price, and the min/max would be that listing rather
 *    than the market.
 *  - Below a minimum sample it returns nothing at all. A range drawn from
 *    three listings is arithmetic, not information, and showing it with a
 *    caveat still leaves a number on the screen for somebody to remember.
 *
 * Pure: same inputs, same output, no clock, no I/O, and nothing decided by a
 * model.
 */

/** Fewer comparables than this and no range is offered. */
export const MINIMUM_COMPARABLES = 8;

export const VALUATION_DISCLAIMER =
  "An indicative range from what comparable listings in this locality are asking, not a valuation. " +
  "It does not account for floor, facing, condition, view, legal status or negotiation. " +
  "Commission your own valuer before you rely on a number.";

export interface IndicativeValuation {
  readonly available: boolean;
  readonly sampleSize: number;
  /** Null whenever `available` is false. */
  readonly low: Money | null;
  readonly high: Money | null;
  readonly midpoint: Money | null;
  readonly perSqftLow: number | null;
  readonly perSqftHigh: number | null;
  readonly perSqftMedian: number | null;
  /** How the asking price sits against the range: below, inside, or above. */
  readonly askingPosition: "BELOW" | "INSIDE" | "ABOVE" | null;
  readonly disclaimer: string;
}

const UNAVAILABLE = (sampleSize: number): IndicativeValuation => ({
  available: false,
  sampleSize,
  low: null,
  high: null,
  midpoint: null,
  perSqftLow: null,
  perSqftHigh: null,
  perSqftMedian: null,
  askingPosition: null,
  disclaimer: VALUATION_DISCLAIMER,
});

export function calculateIndicativeValuation(input: {
  /** The listing's asking price, as a major-unit string from the database. */
  readonly askingPrice: string;
  readonly areaSqft: number | null | undefined;
  /** Price per square foot of verified comparables in the same locality. */
  readonly comparablePricesPerSqft: readonly number[];
}): IndicativeValuation {
  const usable = input.comparablePricesPerSqft
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!input.areaSqft || input.areaSqft <= 0 || usable.length < MINIMUM_COMPARABLES) {
    return UNAVAILABLE(usable.length);
  }

  const perSqftLow = quantile(usable, 0.25);
  const perSqftHigh = quantile(usable, 0.75);
  const perSqftMedian = quantile(usable, 0.5);

  const low = money(Math.round(perSqftLow * input.areaSqft * 100), "INR");
  const high = money(Math.round(perSqftHigh * input.areaSqft * 100), "INR");
  const midpoint = money(Math.round(perSqftMedian * input.areaSqft * 100), "INR");

  const asking = fromMajor(input.askingPrice, "INR").amountMinor;
  const askingPosition =
    asking < low.amountMinor ? "BELOW" : asking > high.amountMinor ? "ABOVE" : "INSIDE";

  return {
    available: true,
    sampleSize: usable.length,
    low,
    high,
    midpoint,
    perSqftLow: Math.round(perSqftLow),
    perSqftHigh: Math.round(perSqftHigh),
    perSqftMedian: Math.round(perSqftMedian),
    askingPosition,
    disclaimer: VALUATION_DISCLAIMER,
  };
}

/** How the range reads: "₹1.64 Cr – ₹2.08 Cr". */
export function describeRange(valuation: IndicativeValuation): string | null {
  if (!valuation.available || !valuation.low || !valuation.high) return null;
  return `${formatMoney(valuation.low)} – ${formatMoney(valuation.high)}`;
}

/**
 * Linear-interpolated quantile over a SORTED ascending array.
 *
 * Interpolated rather than nearest-rank so that adding one comparable moves
 * the range a little instead of making it jump, which is what somebody
 * watching a locality week to week would expect.
 */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;

  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}
