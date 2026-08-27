/**
 * Money.
 *
 * Rules this module exists to enforce:
 *
 *   1. Money is NEVER a JavaScript float. Every value is an integer count of
 *      MINOR UNITS (paise for INR). `0.1 + 0.2` cannot happen here.
 *   2. A split ALWAYS sums exactly to the amount being split. Not "close to" —
 *      exactly, to the paisa. `allocate()` uses the largest-remainder method
 *      with a stable tie-break, so no rounding dust is created or destroyed.
 *   3. Currency travels with the amount and mixed-currency arithmetic throws.
 *
 * The database stores numeric(14,2); this module is the boundary that converts
 * to and from that representation.
 */

export type CurrencyCode = "INR" | "USD" | "AED" | "GBP" | "EUR" | "SGD";

export interface Money {
  /** Integer minor units. For INR this is paise. */
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

const MINOR_UNIT_EXPONENT: Record<CurrencyCode, number> = {
  INR: 2,
  USD: 2,
  AED: 2,
  GBP: 2,
  EUR: 2,
  SGD: 2,
};

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function minorPerMajor(currency: CurrencyCode): number {
  return 10 ** MINOR_UNIT_EXPONENT[currency];
}

/** Construct from minor units. The canonical constructor. */
export function money(amountMinor: number, currency: CurrencyCode = "INR"): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new MoneyError(
      `Money must be constructed from integer minor units, received ${amountMinor}.`,
    );
  }
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError(`Money amount ${amountMinor} exceeds the safe integer range.`);
  }
  return { amountMinor, currency };
}

export const zero = (currency: CurrencyCode = "INR"): Money => money(0, currency);

/**
 * Parse a major-unit value — a rupee figure from the database (`numeric`
 * arrives as a string), a form field, or a literal.
 *
 * Strings are parsed digit-by-digit rather than through `parseFloat`, so a
 * value like "11000000.005" is rejected instead of silently rounding.
 */
export function fromMajor(value: string | number, currency: CurrencyCode = "INR"): Money {
  const exponent = MINOR_UNIT_EXPONENT[currency];
  const text = typeof value === "number" ? value.toFixed(exponent) : value.trim();

  if (text === "") throw new MoneyError("Cannot parse an empty string as money.");

  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new MoneyError(`"${text}" is not a valid ${currency} amount.`);

  const [, sign, whole = "0", fraction = ""] = match;
  if (fraction.length > exponent) {
    throw new MoneyError(
      `"${text}" has more than ${exponent} decimal places, which ${currency} cannot represent.`,
    );
  }

  const padded = fraction.padEnd(exponent, "0");
  const minor = Number(whole) * minorPerMajor(currency) + Number(padded || "0");
  return money(sign === "-" ? -minor : minor, currency);
}

/** Major-unit string suitable for a `numeric(14,2)` column. Never a float. */
export function toMajorString(value: Money): string {
  const exponent = MINOR_UNIT_EXPONENT[value.currency];
  const divisor = minorPerMajor(value.currency);
  const negative = value.amountMinor < 0;
  const absolute = Math.abs(value.amountMinor);
  const whole = Math.floor(absolute / divisor);
  const fraction = absolute % divisor;
  return `${negative ? "-" : ""}${whole}.${String(fraction).padStart(exponent, "0")}`;
}

/** Major-unit number. For DISPLAY and charting only — never for arithmetic. */
export function toMajorNumber(value: Money): number {
  return Number(toMajorString(value));
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Cannot combine ${a.currency} with ${b.currency}.`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function sum(values: readonly Money[], currency: CurrencyCode = "INR"): Money {
  return values.reduce<Money>((acc, value) => add(acc, value), zero(currency));
}

export function negate(value: Money): Money {
  return money(-value.amountMinor, value.currency);
}

export function isZero(value: Money): boolean {
  return value.amountMinor === 0;
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amountMinor === b.amountMinor ? 0 : a.amountMinor < b.amountMinor ? -1 : 1;
}

export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b;
}

export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

export function clamp(value: Money, floor?: Money | null, ceiling?: Money | null): Money {
  let result = value;
  if (floor) result = max(result, floor);
  if (ceiling) result = min(result, ceiling);
  return result;
}

/**
 * Percentage of an amount, rounded half-up to the nearest minor unit.
 *
 * Used for headline figures (e.g. "pool = 2% of transaction value"). It is NOT
 * used to split a pool between participants — that is `allocate()`, which
 * guarantees the parts sum exactly.
 */
export function percentOf(value: Money, percent: number): Money {
  if (!Number.isFinite(percent)) {
    throw new MoneyError(`Percentage must be finite, received ${percent}.`);
  }
  // Scale by 10,000 so that percentages with up to 4 decimals stay exact in
  // integer arithmetic before the final rounding step.
  const scaled = value.amountMinor * Math.round(percent * 10_000);
  return money(Math.round(scaled / 1_000_000), value.currency);
}

export interface AllocationInput {
  /** Stable identifier echoed back in the result. */
  readonly key: string;
  /**
   * Relative weight. For percentage splits pass the percentage; for score-based
   * splits pass the score. Weights need not sum to 100 — only their ratios
   * matter. Negative weights are rejected.
   */
  readonly weight: number;
}

export interface Allocation {
  readonly key: string;
  readonly weight: number;
  readonly amount: Money;
}

/**
 * Split `total` across weighted parts so that the parts sum EXACTLY to `total`.
 *
 * Largest-remainder method:
 *   1. Give each part `floor(total * weight / totalWeight)`.
 *   2. Hand the leftover minor units out one at a time, to the parts with the
 *      largest fractional remainder.
 *   3. Break ties by input order, so the result is deterministic and stable
 *      across runs, machines and years.
 *
 * With all-zero weights (or no parts) nothing is allocated and the caller is
 * responsible for the residue — `allocate` never invents or discards money.
 */
export function allocate(total: Money, parts: readonly AllocationInput[]): Allocation[] {
  for (const part of parts) {
    if (!Number.isFinite(part.weight) || part.weight < 0) {
      throw new MoneyError(
        `Allocation weight for "${part.key}" must be a non-negative finite number, received ${part.weight}.`,
      );
    }
  }

  if (parts.length === 0) return [];

  const totalWeight = parts.reduce((acc, part) => acc + part.weight, 0);
  if (totalWeight === 0) {
    return parts.map((part) => ({ key: part.key, weight: part.weight, amount: zero(total.currency) }));
  }

  const negative = total.amountMinor < 0;
  const magnitude = Math.abs(total.amountMinor);

  const provisional = parts.map((part, index) => {
    const exact = (magnitude * part.weight) / totalWeight;
    const floor = Math.floor(exact);
    return { index, key: part.key, weight: part.weight, floor, remainder: exact - floor };
  });

  const distributed = provisional.reduce((acc, item) => acc + item.floor, 0);
  let leftover = magnitude - distributed;

  // Deterministic ordering: larger remainder first, then original position.
  const order = [...provisional].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );

  const extra = new Map<number, number>();
  for (const item of order) {
    if (leftover <= 0) break;
    extra.set(item.index, 1);
    leftover -= 1;
  }

  return provisional.map((item) => {
    const amountMinor = item.floor + (extra.get(item.index) ?? 0);
    return {
      key: item.key,
      weight: item.weight,
      amount: money(negative ? -amountMinor : amountMinor, total.currency),
    };
  });
}

/* ------------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------------ */

/** Full precision with locale grouping: "₹1,10,00,000". */
export function formatMoney(
  value: Money,
  options: { locale?: string; withDecimals?: boolean } = {},
): string {
  const { locale = "en-IN", withDecimals = false } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  }).format(toMajorNumber(value));
}

/**
 * Indian short form: "₹1.10 Cr", "₹85 L", "₹45,000".
 *
 * This is how property prices are actually read in India; showing
 * "₹11,000,000" on a card makes the product look foreign. Only applied to INR.
 */
export function formatMoneyCompact(value: Money, locale = "en-IN"): string {
  if (value.currency !== "INR") return formatMoney(value, { locale });

  const rupees = toMajorNumber(value);
  const absolute = Math.abs(rupees);
  const sign = rupees < 0 ? "-" : "";

  if (absolute >= 10_000_000) {
    const crore = absolute / 10_000_000;
    return `${sign}₹${trimTrailingZeros(crore.toFixed(2))} Cr`;
  }
  if (absolute >= 100_000) {
    const lakh = absolute / 100_000;
    return `${sign}₹${trimTrailingZeros(lakh.toFixed(2))} L`;
  }
  return formatMoney(value, { locale });
}

function trimTrailingZeros(text: string): string {
  return text.replace(/\.?0+$/, "");
}

/** Price per square foot, given an area. Returns null for a zero/absent area. */
export function pricePerSqft(price: Money, areaSqft: number | null | undefined): Money | null {
  if (!areaSqft || areaSqft <= 0) return null;
  return money(Math.round(price.amountMinor / areaSqft), price.currency);
}
