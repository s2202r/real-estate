import { describe, expect, it } from "vitest";
import {
  checkVisitSlot,
  earliestVisitDate,
  earliestVisitTimeOn,
  localDateTimeToInstant,
} from "../visits";

const IST = "Asia/Kolkata";
const LEAD = 12;

describe("localDateTimeToInstant", () => {
  it("reads a wall-clock time in the platform zone, not in UTC", () => {
    // 09:00 IST is 03:30 UTC — the +05:30 offset, applied in the right
    // direction. Getting the sign wrong here would shift every visit by 11
    // hours and only show up in production.
    const instant = localDateTimeToInstant("2026-03-15", "09:00", IST);
    expect(instant?.toISOString()).toBe("2026-03-15T03:30:00.000Z");
  });

  it("handles a zone that observes DST, on both sides of the change", () => {
    // London: GMT in January, BST in July.
    expect(localDateTimeToInstant("2026-01-15", "12:00", "Europe/London")?.toISOString()).toBe(
      "2026-01-15T12:00:00.000Z",
    );
    expect(localDateTimeToInstant("2026-07-15", "12:00", "Europe/London")?.toISOString()).toBe(
      "2026-07-15T11:00:00.000Z",
    );
  });

  it("returns null for malformed input rather than an Invalid Date", () => {
    expect(localDateTimeToInstant("15-03-2026", "09:00", IST)).toBeNull();
    expect(localDateTimeToInstant("2026-03-15", "9:00", IST)).toBeNull();
    expect(localDateTimeToInstant("2026-03-15", "25:00", IST)).toBeNull();
  });
});

describe("checkVisitSlot", () => {
  // 2026-03-15, 10:00 IST.
  const now = new Date("2026-03-15T04:30:00.000Z");

  it("rejects a slot inside the lead time", () => {
    const result = checkVisitSlot("2026-03-15", "18:00", now, LEAD, IST);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("12 hours");
  });

  it("rejects a slot in the past", () => {
    expect(checkVisitSlot("2026-03-14", "09:00", now, LEAD, IST).ok).toBe(false);
  });

  it("accepts a slot exactly at the boundary", () => {
    // 10:00 + 12h = 22:00 IST the same day.
    expect(checkVisitSlot("2026-03-15", "22:00", now, LEAD, IST).ok).toBe(true);
  });

  it("rejects one minute before the boundary", () => {
    expect(checkVisitSlot("2026-03-15", "21:59", now, LEAD, IST).ok).toBe(false);
  });

  it("accepts a slot on a later day", () => {
    expect(checkVisitSlot("2026-03-17", "09:00", now, LEAD, IST).ok).toBe(true);
  });

  it("rejects a malformed slot", () => {
    expect(checkVisitSlot("", "", now, LEAD, IST).ok).toBe(false);
  });

  it("honours a different lead time", () => {
    // The rule is configuration, not a constant: a market that wants 2 hours
    // gets 2 hours without a code change.
    expect(checkVisitSlot("2026-03-15", "13:00", now, 2, IST).ok).toBe(true);
    expect(checkVisitSlot("2026-03-15", "13:00", now, 24, IST).ok).toBe(false);
  });
});

describe("the values the form uses", () => {
  it("gives the earliest bookable date in the platform zone", () => {
    // 22:00 IST + 12h lands on the next calendar day in IST.
    const lateEvening = new Date("2026-03-15T16:30:00.000Z");
    expect(earliestVisitDate(lateEvening, LEAD, IST)).toBe("2026-03-16");
  });

  it("floors the time only on the first available day", () => {
    const now = new Date("2026-03-15T04:30:00.000Z"); // 10:00 IST
    expect(earliestVisitTimeOn("2026-03-15", now, LEAD, IST)).toBe("22:00");
    expect(earliestVisitTimeOn("2026-03-16", now, LEAD, IST)).toBeNull();
  });

  it("agrees with the rule it mirrors", () => {
    const now = new Date("2026-03-15T04:30:00.000Z");
    const date = earliestVisitDate(now, LEAD, IST);
    const time = earliestVisitTimeOn(date, now, LEAD, IST);
    // Whatever the form offers as its minimum must pass the server's check;
    // if these ever disagree the first slot in the picker is un-submittable.
    expect(checkVisitSlot(date, time ?? "00:00", now, LEAD, IST).ok).toBe(true);
  });
});
