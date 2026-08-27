import { describe, expect, it } from "vitest";
import {
  add,
  allocate,
  clamp,
  compare,
  formatMoney,
  formatMoneyCompact,
  fromMajor,
  money,
  MoneyError,
  percentOf,
  pricePerSqft,
  subtract,
  sum,
  toMajorString,
  zero,
} from "../money";

describe("construction and conversion", () => {
  it("rejects non-integer minor units", () => {
    expect(() => money(10.5)).toThrow(MoneyError);
  });

  it("parses major-unit strings exactly", () => {
    expect(fromMajor("11000000.00").amountMinor).toBe(1_100_000_000);
    expect(fromMajor("0.01").amountMinor).toBe(1);
    expect(fromMajor("1").amountMinor).toBe(100);
    expect(fromMajor("-250.75").amountMinor).toBe(-25_075);
  });

  it("rejects precision the currency cannot represent, rather than rounding it away", () => {
    expect(() => fromMajor("100.005")).toThrow(MoneyError);
  });

  it("rejects malformed input", () => {
    expect(() => fromMajor("")).toThrow(MoneyError);
    expect(() => fromMajor("1,00,000")).toThrow(MoneyError);
    expect(() => fromMajor("abc")).toThrow(MoneyError);
  });

  it("round-trips through the database representation", () => {
    for (const text of ["0.00", "0.01", "999.99", "11000000.00", "12345678.91"]) {
      expect(toMajorString(fromMajor(text))).toBe(text);
    }
  });

  it("survives the float trap that motivates this module", () => {
    const a = fromMajor("0.1");
    const b = fromMajor("0.2");
    expect(toMajorString(add(a, b))).toBe("0.30");
    // The naive equivalent does not:
    expect(0.1 + 0.2).not.toBe(0.3);
  });
});

describe("arithmetic", () => {
  it("adds, subtracts and sums", () => {
    expect(toMajorString(add(fromMajor("100"), fromMajor("250.50")))).toBe("350.50");
    expect(toMajorString(subtract(fromMajor("100"), fromMajor("250.50")))).toBe("-150.50");
    expect(toMajorString(sum([fromMajor("1.10"), fromMajor("2.20"), fromMajor("3.30")]))).toBe("6.60");
  });

  it("refuses to mix currencies", () => {
    expect(() => add(money(100, "INR"), money(100, "USD"))).toThrow(MoneyError);
  });

  it("computes percentages with half-up rounding", () => {
    expect(toMajorString(percentOf(fromMajor("11000000"), 2))).toBe("220000.00");
    expect(toMajorString(percentOf(fromMajor("500000"), 15))).toBe("75000.00");
    // 4-decimal percentages stay exact.
    expect(toMajorString(percentOf(fromMajor("1000000"), 2.5))).toBe("25000.00");
    expect(toMajorString(percentOf(fromMajor("100"), 33.3333))).toBe("33.33");
  });

  it("clamps to a floor and a ceiling", () => {
    const value = fromMajor("10000");
    expect(toMajorString(clamp(value, fromMajor("25000"), null))).toBe("25000.00");
    expect(toMajorString(clamp(value, null, fromMajor("5000")))).toBe("5000.00");
    expect(toMajorString(clamp(value, fromMajor("1000"), fromMajor("50000")))).toBe("10000.00");
  });

  it("orders amounts", () => {
    expect(compare(fromMajor("1"), fromMajor("2"))).toBe(-1);
    expect(compare(fromMajor("2"), fromMajor("2"))).toBe(0);
    expect(compare(fromMajor("3"), fromMajor("2"))).toBe(1);
  });
});

describe("allocate — the invariant that matters", () => {
  it("splits the documented commission pool exactly", () => {
    const pool = fromMajor("500000");
    const result = allocate(pool, [
      { key: "LISTING_AGENT", weight: 20 },
      { key: "SALES_AGENT", weight: 40 },
      { key: "VISIT_POOL", weight: 15 },
      { key: "PLATFORM", weight: 25 },
    ]);

    expect(result.map((r) => toMajorString(r.amount))).toEqual([
      "100000.00",
      "200000.00",
      "75000.00",
      "125000.00",
    ]);
    expect(sum(result.map((r) => r.amount)).amountMinor).toBe(pool.amountMinor);
  });

  it("splits the visit pool exactly", () => {
    const visitPool = fromMajor("75000");
    const result = allocate(visitPool, [
      { key: "latest", weight: 50 },
      { key: "previous", weight: 25 },
      { key: "earlier", weight: 25 },
    ]);
    expect(result.map((r) => toMajorString(r.amount))).toEqual([
      "37500.00",
      "18750.00",
      "18750.00",
    ]);
  });

  it("never loses or invents a paisa, across many awkward splits", () => {
    // Three-way splits of amounts that do not divide evenly are exactly where
    // naive percentage maths leaks money.
    const awkward = [1, 2, 7, 99, 100, 101, 3333, 10_000, 123_457, 999_999_999];
    const weightSets = [
      [1, 1, 1],
      [50, 25, 25],
      [33.33, 33.33, 33.34],
      [70, 30],
      [1, 2, 3, 4, 5, 6, 7],
      [0.5, 0.25, 0.25],
    ];

    for (const minor of awkward) {
      for (const weights of weightSets) {
        const total = money(minor);
        const parts = allocate(
          total,
          weights.map((weight, i) => ({ key: `p${i}`, weight })),
        );
        const distributed = parts.reduce((acc, p) => acc + p.amount.amountMinor, 0);
        expect(distributed).toBe(minor);
        // No part may be negative when the total is positive.
        expect(parts.every((p) => p.amount.amountMinor >= 0)).toBe(true);
      }
    }
  });

  it("is deterministic: identical input yields identical output", () => {
    const input = [
      { key: "a", weight: 33.333 },
      { key: "b", weight: 33.333 },
      { key: "c", weight: 33.334 },
    ];
    const first = allocate(money(100_000), input);
    for (let i = 0; i < 50; i += 1) {
      expect(allocate(money(100_000), input)).toEqual(first);
    }
  });

  it("breaks remainder ties by input order, not by chance", () => {
    // 10 paise across 3 equal parts: 4/3/3, with the extra paisa going to the
    // earliest participant.
    const result = allocate(money(10), [
      { key: "first", weight: 1 },
      { key: "second", weight: 1 },
      { key: "third", weight: 1 },
    ]);
    expect(result.map((r) => r.amount.amountMinor)).toEqual([4, 3, 3]);
  });

  it("handles zero weights without dividing by zero", () => {
    const result = allocate(money(1000), [
      { key: "a", weight: 0 },
      { key: "b", weight: 0 },
    ]);
    expect(result.every((r) => r.amount.amountMinor === 0)).toBe(true);
  });

  it("handles a single participant taking the whole pool", () => {
    const result = allocate(fromMajor("75000"), [{ key: "only", weight: 50 }]);
    expect(toMajorString(result[0]!.amount)).toBe("75000.00");
  });

  it("rejects negative weights", () => {
    expect(() => allocate(money(100), [{ key: "a", weight: -1 }])).toThrow(MoneyError);
  });

  it("allocates negative totals (reversal entries) exactly too", () => {
    const result = allocate(money(-1000), [
      { key: "a", weight: 1 },
      { key: "b", weight: 2 },
    ]);
    expect(result.reduce((acc, r) => acc + r.amount.amountMinor, 0)).toBe(-1000);
  });

  it("returns nothing for no participants", () => {
    expect(allocate(money(1000), [])).toEqual([]);
  });
});

describe("formatting", () => {
  it("uses Indian short form on cards", () => {
    expect(formatMoneyCompact(fromMajor("11000000"))).toBe("₹1.1 Cr");
    expect(formatMoneyCompact(fromMajor("8500000"))).toBe("₹85 L");
    expect(formatMoneyCompact(fromMajor("15000000"))).toBe("₹1.5 Cr");
    expect(formatMoneyCompact(fromMajor("45000"))).toBe("₹45,000");
  });

  it("uses Indian digit grouping in full form", () => {
    expect(formatMoney(fromMajor("11000000"))).toBe("₹1,10,00,000");
  });

  it("formats zero", () => {
    expect(formatMoneyCompact(zero())).toBe("₹0");
  });
});

describe("pricePerSqft", () => {
  it("computes per-square-foot pricing", () => {
    expect(toMajorString(pricePerSqft(fromMajor("11000000"), 1600)!)).toBe("6875.00");
  });

  it("returns null rather than dividing by zero", () => {
    expect(pricePerSqft(fromMajor("100"), 0)).toBeNull();
    expect(pricePerSqft(fromMajor("100"), null)).toBeNull();
  });
});
