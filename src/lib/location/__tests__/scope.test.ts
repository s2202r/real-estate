import { describe, expect, it } from "vitest";
import { applyScope, describeScope, parseScope } from "../scope";

const PROJECT_ID = "11111111-2222-4333-8444-555555555555";

describe("parseScope", () => {
  it("accepts any real Indian city", () => {
    expect(parseScope({ city: "Noida" })).toEqual({ city: "Noida" });
    // Not one of the cities the platform promotes — inventory is wherever
    // agents put it, and the scope has to be able to say so.
    expect(parseScope({ city: "Indore" })).toEqual({ city: "Indore" });
  });

  it("canonicalises the spelling", () => {
    // Cities are stored one way. A cookie saying "bangalore" has to become
    // "Bengaluru" or it silently matches nothing.
    expect(parseScope({ city: "noida" })).toEqual({ city: "Noida" });
    expect(parseScope({ city: "  BENGALURU " })).toEqual({ city: "Bengaluru" });
  });

  it("rejects a city that does not exist", () => {
    // The cookie is user input: a value that reaches a query unchecked would
    // filter every result out and look like an empty market.
    expect(parseScope({ city: "Atlantis" })).toEqual({});
    expect(parseScope({ city: 42 })).toEqual({});
  });

  it("drops a locality with no city, which would match nothing", () => {
    expect(parseScope({ locality: "Sector 137" })).toEqual({});
    expect(parseScope({ city: "Noida", locality: "Sector 137" })).toEqual({
      city: "Noida",
      locality: "Sector 137",
    });
  });

  it("requires a project id to look like an id", () => {
    expect(parseScope({ projectId: "'; drop table listings; --" })).toEqual({});
    expect(parseScope({ projectId: PROJECT_ID })).toEqual({ projectId: PROJECT_ID });
  });

  it("keeps a project name only alongside a valid id", () => {
    expect(parseScope({ projectName: "Fake Towers" })).toEqual({});
    expect(parseScope({ projectId: PROJECT_ID, projectName: "Green Valley" })).toEqual({
      projectId: PROJECT_ID,
      projectName: "Green Valley",
    });
  });

  it("caps free text rather than passing a long string to a query", () => {
    expect(parseScope({ city: "Noida", locality: "x".repeat(200) })).toEqual({ city: "Noida" });
  });

  it("treats anything that is not an object as no scope", () => {
    expect(parseScope(null)).toEqual({});
    expect(parseScope("Noida")).toEqual({});
    expect(parseScope(undefined)).toEqual({});
  });
});

describe("applyScope", () => {
  const scope = { city: "Noida", locality: "Sector 137", projectId: PROJECT_ID };

  it("fills in what the URL did not say", () => {
    expect(applyScope({}, scope)).toEqual(scope);
  });

  it("never overrides a city stated in the URL", () => {
    // A shared link has to mean the same thing for whoever opens it.
    expect(applyScope({ city: "Mumbai" }, scope)).toEqual({ city: "Mumbai" });
  });

  it("does not layer a stored locality onto a different city", () => {
    // Sector 137 is in Noida; applying it to a Mumbai search would return
    // nothing and look like an empty market.
    const result = applyScope({ city: "Mumbai" }, scope);
    expect(result.locality).toBeUndefined();
    expect(result.projectId).toBeUndefined();
  });

  it("keeps other filters untouched", () => {
    const filters = { bedroomsMin: 3, priceMax: 9000000 };
    expect(applyScope(filters, scope)).toEqual({ ...filters, ...scope });
  });

  it("is a no-op with no scope set", () => {
    const filters = { city: "Pune", bedroomsMin: 2 };
    expect(applyScope(filters, {})).toEqual(filters);
    expect(applyScope({ bedroomsMin: 2 }, {})).toEqual({ bedroomsMin: 2 });
  });
});

describe("describeScope", () => {
  it("names the most specific thing chosen", () => {
    expect(describeScope({})).toBe("All cities");
    expect(describeScope({ city: "Noida" })).toBe("Noida");
    expect(describeScope({ city: "Noida", locality: "Sector 137" })).toBe("Sector 137, Noida");
    expect(
      describeScope({ city: "Noida", locality: "Sector 137", projectName: "Green Valley" }),
    ).toBe("Green Valley");
  });
});
