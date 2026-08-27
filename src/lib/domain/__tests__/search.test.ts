import { describe, expect, it } from "vitest";
import { searchTerms, statesListingType } from "../search";

describe("searchTerms", () => {
  it("splits a sentence into terms that can actually match a title", () => {
    // The exact string the homepage placeholder suggests. As one substring it
    // matches nothing; as terms it finds "3 BHK Apartment in ... Noida".
    expect(searchTerms("3BHK in Noida Extension under 1.5 Cr")).toEqual([
      "bhk",
      "noida",
      "extension",
    ]);
  });

  it("separates digits from letters so 3bhk is not one dead token", () => {
    expect(searchTerms("2bhk")).toEqual(["bhk"]);
    expect(searchTerms("sector137")).toEqual(["sector"]);
  });

  it("drops the words that would empty the result set", () => {
    // Every term is ANDed, so one unmatchable term returns nothing at all.
    expect(searchTerms("under 50 lakhs")).toEqual([]);
    expect(searchTerms("looking for a property near a metro")).toEqual(["metro"]);
  });

  it("keeps place and project names", () => {
    expect(searchTerms("Green Valley Heights Sector 137")).toEqual([
      "green",
      "valley",
      "heights",
      "sector",
    ]);
  });

  it("strips characters that are syntax inside a filter expression", () => {
    // A comma or a parenthesis reaching PostgREST would change the meaning of
    // the expression, not just the value.
    expect(searchTerms("noida,(city)%")).toEqual(["noida", "city"]);
    expect(searchTerms("title.ilike.*")).toEqual(["title", "ilike"]);
  });

  it("de-duplicates and bounds the term count", () => {
    expect(searchTerms("noida noida noida")).toEqual(["noida"]);
    expect(searchTerms("alpha beta gamma delta epsilon zeta eta").length).toBe(5);
  });

  it("returns nothing for a query made entirely of noise", () => {
    // Better to run an unfiltered search than to AND a term nothing can match.
    expect(searchTerms("under 1.5 cr")).toEqual([]);
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("statesListingType", () => {
  it("is true only when the query says which side of the market it wants", () => {
    expect(statesListingType("2 bhk for rent in powai")).toBe(true);
    expect(statesListingType("villas for sale in whitefield")).toBe(true);
    // The parser defaults to SALE; applying that here would hide every rental.
    expect(statesListingType("flats in noida")).toBe(false);
    expect(statesListingType("3 bhk sector 137")).toBe(false);
  });
});
