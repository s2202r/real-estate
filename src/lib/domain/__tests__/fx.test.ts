import { describe, expect, it } from "vitest";
import {
  MAX_RATE_MOVE_PERCENT,
  convert,
  describeRate,
  findRate,
  isValidRate,
  vetIncomingRate,
  type ExchangeRate,
} from "../fx";
import { fromMajor, MoneyError, toMajorString } from "../money";

const NOW = new Date("2026-09-03T10:00:00Z");
const RATE: ExchangeRate = { from: "INR", to: "USD", rate: 0.012, asOf: "2026-09-01" };

describe("convert", () => {
  it("converts in minor units, with one rounding step", () => {
    // ₹1,00,00,000 at 0.012 = $120,000
    const result = convert(fromMajor("10000000", "INR"), RATE, NOW);
    expect(result.amount.currency).toBe("USD");
    expect(toMajorString(result.amount)).toBe("120000.00");
  });

  it("rounds to the target's minor unit rather than truncating", () => {
    const result = convert(fromMajor("1", "INR"), { ...RATE, rate: 0.0125 }, NOW);
    // 1 × 0.0125 = 0.0125 → 0.01 after rounding to cents.
    expect(toMajorString(result.amount)).toBe("0.01");
  });

  it("refuses a rate that does not apply to the amount", () => {
    // The failure that cannot be caught downstream: a price in the wrong
    // currency looks exactly like a correct one.
    expect(() => convert(fromMajor("100", "USD"), RATE, NOW)).toThrow(MoneyError);
  });

  it("refuses an unusable rate rather than producing a number", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => convert(fromMajor("100", "INR"), { ...RATE, rate: bad }, NOW)).toThrow();
    }
    expect(() =>
      convert(fromMajor("100", "INR"), { ...RATE, asOf: "not-a-date" }, NOW),
    ).toThrow();
  });

  it("reports the rate's age", () => {
    expect(convert(fromMajor("100", "INR"), RATE, NOW).ageDays).toBe(2);
    expect(convert(fromMajor("100", "INR"), RATE, NOW).stale).toBe(false);
  });

  it("flags a rate nobody has updated", () => {
    // The state this exists for: a months-old rate renders identically to a
    // fresh one unless something says otherwise.
    const old = convert(fromMajor("100", "INR"), { ...RATE, asOf: "2026-01-01" }, NOW);
    expect(old.stale).toBe(true);
    expect(old.ageDays).toBeGreaterThan(200);
  });

  it("never reports a negative age for a rate dated in the future", () => {
    const ahead = convert(fromMajor("100", "INR"), { ...RATE, asOf: "2026-12-01" }, NOW);
    expect(ahead.ageDays).toBe(0);
    expect(ahead.stale).toBe(false);
  });
});

describe("findRate", () => {
  const rates: ExchangeRate[] = [
    RATE,
    { from: "INR", to: "AED", rate: 0.044, asOf: "2026-09-01" },
  ];

  it("finds a direct rate", () => {
    expect(findRate(rates, "INR", "USD")?.rate).toBe(0.012);
  });

  it("inverts a rate stored the other way round", () => {
    const inverted = findRate(rates, "USD", "INR");
    expect(inverted?.from).toBe("USD");
    expect(inverted?.to).toBe("INR");
    expect(inverted?.rate).toBeCloseTo(1 / 0.012, 6);
    // The inverted rate keeps the original's date; it is no fresher than its source.
    expect(inverted?.asOf).toBe("2026-09-01");
  });

  it("returns nothing for a pair it does not hold, or for a no-op", () => {
    expect(findRate(rates, "GBP", "SGD")).toBeNull();
    expect(findRate(rates, "INR", "INR")).toBeNull();
  });

  it("ignores a stored rate that is not usable", () => {
    expect(findRate([{ ...RATE, rate: 0 }], "INR", "USD")).toBeNull();
  });
});

describe("isValidRate", () => {
  it("rejects a rate from a currency to itself", () => {
    expect(isValidRate({ ...RATE, to: "INR" })).toBe(false);
  });
});

describe("describeRate", () => {
  it("always says the figure is indicative and gives the rate's date", () => {
    const label = describeRate(convert(fromMajor("100", "INR"), RATE, NOW));
    expect(label).toMatch(/indicative/);
    // Asserted loosely: the month abbreviation is the runtime's ("Sep" or
    // "Sept" depending on the ICU version), and pinning it would make this a
    // test of Node rather than of the label.
    expect(label).toMatch(/1 Sept? 2026/);
  });

  it("says how old a stale rate is, rather than only that it is old", () => {
    const label = describeRate(
      convert(fromMajor("100", "INR"), { ...RATE, asOf: "2026-01-01" }, NOW),
    );
    expect(label).toMatch(/days ago/);
  });
});

describe("vetIncomingRate", () => {
  const stored: ExchangeRate = { from: "INR", to: "USD", rate: 0.012, asOf: "2026-09-01" };
  const bounds = { min: 0.000001, max: 1 };

  it("accepts a small movement", () => {
    const incoming = { ...stored, rate: 0.0123, asOf: "2026-09-03" };
    expect(vetIncomingRate({ incoming, existing: stored, now: NOW }).accepted).toBe(true);
  });

  it("refuses an inverted pair, which is the failure that matters", () => {
    // Asking for INR->USD and being handed USD->INR: 83 instead of 0.012.
    // Accepting it would price a ₹1 Cr flat at $830,000,000.
    const inverted = { ...stored, rate: 83.15, asOf: "2026-09-03" };
    const result = vetIncomingRate({ incoming: inverted, existing: stored, now: NOW });

    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/inverted pair|moves/);
  });

  it("catches an inverted pair on the FIRST fetch, with no baseline", () => {
    // Nothing stored, so the relative check cannot help. Every currency here
    // is worth far more than a rupee, so a rate above 1 is impossible.
    const result = vetIncomingRate({
      incoming: { ...stored, rate: 83.15 },
      existing: null,
      now: NOW,
      absoluteBounds: bounds,
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/plausible range/);
  });

  it("accepts a plausible first rate", () => {
    expect(
      vetIncomingRate({ incoming: stored, existing: null, now: NOW, absoluteBounds: bounds })
        .accepted,
    ).toBe(true);
  });

  it("refuses a rate dated in the future beyond a day of slack", () => {
    expect(
      vetIncomingRate({
        incoming: { ...stored, asOf: "2026-09-20" },
        existing: stored,
        now: NOW,
      }).accepted,
    ).toBe(false);
  });

  it("allows a day of slack, for a provider publishing in another timezone", () => {
    expect(
      vetIncomingRate({
        incoming: { ...stored, asOf: "2026-09-03" },
        existing: stored,
        now: NOW,
      }).accepted,
    ).toBe(true);
  });

  it("refuses to go backwards in time", () => {
    // A cached or replayed response must not overwrite a fresher rate with an
    // older one, which would make the label lie about the age.
    const result = vetIncomingRate({
      incoming: { ...stored, asOf: "2026-08-01" },
      existing: stored,
      now: NOW,
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/older than the rate already stored/);
  });

  it("refuses junk regardless of what is stored", () => {
    for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        vetIncomingRate({ incoming: { ...stored, rate }, existing: stored, now: NOW }).accepted,
        String(rate),
      ).toBe(false);
    }
  });

  it("honours a caller's own movement limit", () => {
    const incoming = { ...stored, rate: 0.0132, asOf: "2026-09-03" }; // +10%
    expect(vetIncomingRate({ incoming, existing: stored, now: NOW }).accepted).toBe(true);
    expect(
      vetIncomingRate({ incoming, existing: stored, now: NOW, maxMovePercent: 5 }).accepted,
    ).toBe(false);
  });

  it("uses a sane default limit", () => {
    expect(MAX_RATE_MOVE_PERCENT).toBeGreaterThan(0);
    expect(MAX_RATE_MOVE_PERCENT).toBeLessThan(50);
  });
});
