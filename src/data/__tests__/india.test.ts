import { describe, expect, it } from "vitest";
import {
  citiesInState,
  citiesNamed,
  findCity,
  findState,
  indianCities,
  indianStates,
  isKnownCity,
  isKnownState,
  searchCities,
} from "../india";

describe("the dataset", () => {
  it("covers all 28 states and 8 union territories", () => {
    expect(indianStates.filter((state) => state.kind === "state")).toHaveLength(28);
    expect(indianStates.filter((state) => state.kind === "ut")).toHaveLength(8);
  });

  it("gives every state at least one city", () => {
    for (const state of indianStates) {
      expect(citiesInState(state.name).length, state.name).toBeGreaterThan(0);
    }
  });

  it("keeps slugs unique, including names that repeat across states", () => {
    const slugs = indianCities.map((city) => city.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    // Aurangabad is in both Maharashtra and Bihar.
    const aurangabads = citiesNamed("Aurangabad");
    expect(aurangabads.length).toBeGreaterThan(1);
    expect(new Set(aurangabads.map((city) => city.slug)).size).toBe(aurangabads.length);
  });

  it("names every city's state as a state that exists", () => {
    for (const city of indianCities) {
      expect(isKnownState(city.state), `${city.name}: ${city.state}`).toBe(true);
    }
  });

  it("puts the eight metros in tier 1", () => {
    for (const name of [
      "Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata", "Hyderabad", "Pune", "Ahmedabad",
    ]) {
      expect(findCity(name)?.tier, name).toBe(1);
    }
  });
});

describe("findCity", () => {
  it("ignores case and surrounding space", () => {
    expect(findCity("  bengaluru ")?.name).toBe("Bengaluru");
    expect(findCity("NOIDA")?.state).toBe("Uttar Pradesh");
  });

  it("disambiguates a repeated name by state", () => {
    expect(findCity("Aurangabad", "Maharashtra")?.stateCode).toBe("MH");
    expect(findCity("Aurangabad", "Bihar")?.stateCode).toBe("BR");
    // A code works too, since that is what the table is keyed on.
    expect(findCity("Bilaspur", "CG")?.state).toBe("Chhattisgarh");
  });

  it("prefers the larger city when no state is given", () => {
    expect(findCity("Aurangabad")?.stateCode).toBe("MH");
  });

  it("returns nothing for a place that does not exist", () => {
    expect(findCity("Atlantis")).toBeNull();
    expect(isKnownCity("Atlantis")).toBe(false);
    expect(findCity("Aurangabad", "Kerala")).toBeNull();
  });
});

describe("findState", () => {
  it("accepts a name or a code", () => {
    expect(findState("Uttar Pradesh")?.code).toBe("UP");
    expect(findState("up")?.name).toBe("Uttar Pradesh");
    expect(findState("Kerala")?.kind).toBe("state");
    expect(findState("Delhi")?.kind).toBe("ut");
  });

  it("rejects anything else", () => {
    expect(findState("Bavaria")).toBeNull();
    expect(findState(undefined)).toBeNull();
  });
});

describe("searchCities", () => {
  it("puts an exact match first", () => {
    expect(searchCities("pune")[0]?.name).toBe("Pune");
  });

  it("ranks a prefix above a substring, and the bigger city within a band", () => {
    const results = searchCities("noida", 5).map((city) => city.name);
    // "Noida" starts with it; "Greater Noida" only contains it.
    expect(results.indexOf("Noida")).toBeLessThan(results.indexOf("Greater Noida"));
  });

  it("finds cities by their state", () => {
    const results = searchCities("kerala", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((city) => city.state === "Kerala")).toBe(true);
  });

  it("suggests the largest cities before anything is typed", () => {
    expect(searchCities("", 4).every((city) => city.tier === 1)).toBe(true);
  });

  it("honours the limit and returns nothing for nonsense", () => {
    expect(searchCities("a", 3)).toHaveLength(3);
    expect(searchCities("zzzzzz")).toHaveLength(0);
  });
});
