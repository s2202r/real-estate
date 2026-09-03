import { describe, expect, it } from "vitest";
import {
  NRI_TIME_ZONES,
  TIME_ZONE_REGIONS,
  describeInBothZones,
  isKnownTimeZone,
  offsetMinutesBetween,
  resolveTimeZone,
} from "../timezones";

const IST = "Asia/Kolkata";

describe("the offered list", () => {
  it("only offers zones the runtime can actually format", () => {
    // A zone in the picker that Intl rejects means every date rendered for
    // that customer silently falls back and nobody notices.
    for (const zone of NRI_TIME_ZONES) {
      expect(isKnownTimeZone(zone.id), zone.id).toBe(true);
    }
  });

  it("has no duplicates", () => {
    const ids = NRI_TIME_ZONES.map((zone) => zone.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes India, and puts it first", () => {
    expect(NRI_TIME_ZONES[0]?.id).toBe(IST);
  });

  it("assigns every zone to a region the picker knows how to group", () => {
    for (const zone of NRI_TIME_ZONES) {
      expect(TIME_ZONE_REGIONS, zone.id).toContain(zone.region);
    }
  });

  it("covers the corridors that matter", () => {
    const ids = NRI_TIME_ZONES.map((zone) => zone.id);
    for (const expected of [
      "Asia/Dubai",
      "Asia/Singapore",
      "Europe/London",
      "America/New_York",
      "Australia/Sydney",
    ]) {
      expect(ids).toContain(expected);
    }
  });
});

describe("isKnownTimeZone", () => {
  it("rejects nonsense, empty and absent values", () => {
    for (const bad of ["", "  ", "Mars/Olympus_Mons", null, undefined]) {
      expect(isKnownTimeZone(bad as string), String(bad)).toBe(false);
    }
  });

  it("rejects bare abbreviations, which ICU accepts as the wrong thing", () => {
    // ICU maps "EST" to America/Panama, which does not observe daylight
    // saving: a customer in New York storing "EST" would see every summer
    // visit an hour out. "IST" is India, Ireland or Israel depending on who
    // is speaking. Both format without error, and neither should be stored.
    for (const abbreviation of ["IST", "EST", "PST", "GMT"]) {
      expect(isKnownTimeZone(abbreviation), abbreviation).toBe(false);
    }
  });

  it("accepts UTC, which is unambiguous", () => {
    expect(isKnownTimeZone("UTC")).toBe(true);
  });
});

describe("resolveTimeZone", () => {
  it("uses the stored zone when it is usable", () => {
    expect(resolveTimeZone("Asia/Dubai", IST)).toBe("Asia/Dubai");
  });

  it("falls back rather than throwing on a stored value that has gone bad", () => {
    // The row is user input that outlived its validation: a renamed zone, a
    // hand-edited row. A page must not 500 over it.
    expect(resolveTimeZone("Mars/Olympus_Mons", IST)).toBe(IST);
    expect(resolveTimeZone(null, IST)).toBe(IST);
  });
});

describe("describeInBothZones", () => {
  const instant = new Date("2026-09-05T05:30:00Z"); // 11:00 IST

  it("gives both clocks for a buyer abroad", () => {
    const both = describeInBothZones(instant, IST, "Asia/Dubai");
    expect(both).not.toBeNull();
    expect(both!.property).toMatch(/11:00/);
    // Dubai is 90 minutes behind IST.
    expect(both!.viewer).toMatch(/09:30/);
  });

  it("says nothing when both clocks read the same", () => {
    // Two identical times on screen is noise, not clarity.
    expect(describeInBothZones(instant, IST, IST)).toBeNull();
  });

  it("returns nothing rather than throwing on an unusable zone", () => {
    expect(describeInBothZones(instant, IST, "Mars/Olympus_Mons")).toBeNull();
    expect(describeInBothZones(instant, "Mars/Olympus_Mons", IST)).toBeNull();
  });
});

describe("offsetMinutesBetween", () => {
  it("measures the gap in the direction of the viewer", () => {
    const instant = new Date("2026-09-05T05:30:00Z");
    // Dubai is behind India by 90 minutes.
    expect(offsetMinutesBetween(instant, IST, "Asia/Dubai")).toBe(-90);
    expect(offsetMinutesBetween(instant, "Asia/Dubai", IST)).toBe(90);
  });

  it("is zero between a zone and itself", () => {
    expect(offsetMinutesBetween(new Date("2026-09-05T05:30:00Z"), IST, IST)).toBe(0);
  });

  it("tracks daylight saving rather than assuming a fixed offset", () => {
    // London is BST in July (IST +4:30 behind) and GMT in January (+5:30).
    const july = new Date("2026-07-15T12:00:00Z");
    const january = new Date("2026-01-15T12:00:00Z");

    expect(offsetMinutesBetween(july, IST, "Europe/London")).toBe(-270);
    expect(offsetMinutesBetween(january, IST, "Europe/London")).toBe(-330);
  });
});
