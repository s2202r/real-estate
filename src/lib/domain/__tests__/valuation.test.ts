import { describe, expect, it } from "vitest";
import {
  calculateIndicativeValuation,
  describeRange,
  MINIMUM_COMPARABLES,
  VALUATION_DISCLAIMER,
} from "../valuation";
import { toMajorNumber } from "../money";

/** Twelve comparables around ₹8,000/sq ft, with one outlier at each end. */
const COMPARABLES = [3000, 7200, 7500, 7800, 8000, 8100, 8300, 8500, 8800, 9000, 9400, 25000];

describe("calculateIndicativeValuation", () => {
  it("offers nothing below the minimum sample", () => {
    // A range from three listings is arithmetic, not information — and a
    // caveat still leaves a number on screen for somebody to remember.
    const result = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1200,
      comparablePricesPerSqft: [8000, 8100, 8200],
    });
    expect(result.available).toBe(false);
    expect(result.low).toBeNull();
    expect(result.sampleSize).toBe(3);
    expect(result.disclaimer).toBe(VALUATION_DISCLAIMER);
  });

  it("offers nothing without a usable area", () => {
    for (const area of [null, undefined, 0, -50]) {
      expect(
        calculateIndicativeValuation({
          askingPrice: "10000000",
          areaSqft: area,
          comparablePricesPerSqft: COMPARABLES,
        }).available,
      ).toBe(false);
    }
  });

  it("produces a range, not a figure", () => {
    const result = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1200,
      comparablePricesPerSqft: COMPARABLES,
    });

    expect(result.available).toBe(true);
    expect(result.low).not.toBeNull();
    expect(result.high).not.toBeNull();
    expect(toMajorNumber(result.high!)).toBeGreaterThan(toMajorNumber(result.low!));
  });

  it("uses the interquartile range, so one absurd listing cannot set it", () => {
    // 3000 and 25000 are in the sample. If the range were min-max, the low
    // would be 3000/sq ft and the high 25000 — which is the outliers, not the
    // market.
    const result = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1000,
      comparablePricesPerSqft: COMPARABLES,
    });

    expect(result.perSqftLow).toBeGreaterThan(3000);
    expect(result.perSqftHigh).toBeLessThan(25000);
    expect(result.perSqftLow).toBeGreaterThan(7000);
    expect(result.perSqftHigh).toBeLessThan(10000);
  });

  it("reports the sample size, which is what makes the range readable", () => {
    const result = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1000,
      comparablePricesPerSqft: COMPARABLES,
    });
    expect(result.sampleSize).toBe(COMPARABLES.length);
  });

  it("discards junk comparables before counting them", () => {
    const withJunk = [...COMPARABLES, Number.NaN, 0, -100, Number.POSITIVE_INFINITY];
    const result = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1000,
      comparablePricesPerSqft: withJunk,
    });
    expect(result.sampleSize).toBe(COMPARABLES.length);
  });

  it("says where the asking price sits against the range", () => {
    const base = { areaSqft: 1000, comparablePricesPerSqft: COMPARABLES };
    const inside = calculateIndicativeValuation({ ...base, askingPrice: "8300000" });
    const below = calculateIndicativeValuation({ ...base, askingPrice: "3000000" });
    const above = calculateIndicativeValuation({ ...base, askingPrice: "40000000" });

    expect(inside.askingPosition).toBe("INSIDE");
    expect(below.askingPosition).toBe("BELOW");
    expect(above.askingPosition).toBe("ABOVE");
  });

  it("scales with area, because that is the only property-specific input", () => {
    const small = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1000,
      comparablePricesPerSqft: COMPARABLES,
    });
    const large = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 2000,
      comparablePricesPerSqft: COMPARABLES,
    });

    expect(toMajorNumber(large.low!)).toBeCloseTo(toMajorNumber(small.low!) * 2, 0);
  });

  it("is deterministic and does not mutate its input", () => {
    const input = [...COMPARABLES];
    const first = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1000,
      comparablePricesPerSqft: input,
    });
    const second = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1000,
      comparablePricesPerSqft: input,
    });

    expect(second).toEqual(first);
    // A domain function that reorders its caller's array is a trap.
    expect(input).toEqual(COMPARABLES);
  });

  it("always carries the disclaimer, available or not", () => {
    expect(
      calculateIndicativeValuation({
        askingPrice: "10000000",
        areaSqft: 1000,
        comparablePricesPerSqft: COMPARABLES,
      }).disclaimer,
    ).toMatch(/not a valuation/i);
  });

  it("needs exactly MINIMUM_COMPARABLES to start offering a range", () => {
    const atLimit = Array.from({ length: MINIMUM_COMPARABLES }, (_, i) => 8000 + i);
    const belowLimit = atLimit.slice(0, -1);

    expect(
      calculateIndicativeValuation({
        askingPrice: "10000000",
        areaSqft: 1000,
        comparablePricesPerSqft: atLimit,
      }).available,
    ).toBe(true);
    expect(
      calculateIndicativeValuation({
        askingPrice: "10000000",
        areaSqft: 1000,
        comparablePricesPerSqft: belowLimit,
      }).available,
    ).toBe(false);
  });
});

describe("describeRange", () => {
  it("reads as a range", () => {
    const result = calculateIndicativeValuation({
      askingPrice: "10000000",
      areaSqft: 1000,
      comparablePricesPerSqft: COMPARABLES,
    });
    expect(describeRange(result)).toMatch(/–/);
  });

  it("returns nothing when there is no range", () => {
    expect(
      describeRange(
        calculateIndicativeValuation({
          askingPrice: "10000000",
          areaSqft: 1000,
          comparablePricesPerSqft: [8000],
        }),
      ),
    ).toBeNull();
  });
});
