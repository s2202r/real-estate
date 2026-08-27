import { describe, expect, it } from "vitest";
import {
  calculateMatch,
  DEFAULT_MATCH_WEIGHTS,
  matchLabel,
  matchListings,
  type ListingCandidate,
  type MatchRanker,
  type RequirementInput,
} from "../matching";

const requirement: RequirementInput = {
  id: "req-1",
  listingType: "SALE",
  propertyTypes: ["APARTMENT"],
  city: "Greater Noida",
  localities: ["Noida Extension", "Sector 137"],
  budgetMin: "9000000.00",
  budgetMax: "15000000.00",
  minArea: 1400,
  bedroomsMin: 3,
  bedroomsMax: 3,
  facing: ["EAST", "NORTH_EAST"],
  furnishing: ["SEMI_FURNISHED", "FULLY_FURNISHED"],
  possession: ["READY_TO_MOVE"],
  amenities: ["lift", "security_24x7", "covered_parking", "gym"],
  coordinates: { latitude: 28.61, longitude: 77.44 },
};

const perfect: ListingCandidate = {
  id: "listing-perfect",
  listingType: "SALE",
  propertyType: "APARTMENT",
  city: "Greater Noida",
  locality: "Noida Extension",
  price: "13500000.00",
  builtUpArea: 1650,
  bedrooms: 3,
  bathrooms: 3,
  facing: "EAST",
  furnishing: "SEMI_FURNISHED",
  possessionStatus: "READY_TO_MOVE",
  amenities: ["lift", "security_24x7", "covered_parking", "gym", "park"],
  coordinates: { latitude: 28.611, longitude: 77.441 },
  verificationScore: 95,
  agentTrustScore: 92,
  isVerified: true,
};

describe("match scoring", () => {
  it("scores a perfect match near 100", () => {
    const result = calculateMatch(requirement, perfect);
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.disqualifiers).toEqual([]);
  });

  it("returns a breakdown for every dimension", () => {
    const result = calculateMatch(requirement, perfect);
    expect(result.breakdown).toHaveLength(Object.keys(DEFAULT_MATCH_WEIGHTS).length);
    expect(result.breakdown.every((d) => d.explanation.length > 0)).toBe(true);
    expect(result.breakdown.every((d) => d.score >= 0 && d.score <= 100)).toBe(true);
  });

  it("never scores outside 0-100", () => {
    const absurd = calculateMatch(requirement, { ...perfect, price: "999999999.00", builtUpArea: 1 });
    expect(absurd.score).toBeGreaterThanOrEqual(0);
    expect(absurd.score).toBeLessThanOrEqual(100);
  });

  it("penalises being over budget steeply", () => {
    const slightly = calculateMatch(requirement, { ...perfect, price: "16000000.00" });
    const badly = calculateMatch(requirement, { ...perfect, price: "22000000.00" });
    expect(slightly.score).toBeLessThan(calculateMatch(requirement, perfect).score);
    expect(badly.score).toBeLessThan(slightly.score);
    expect(badly.breakdown.find((d) => d.dimension === "budget")?.score).toBe(0);
  });

  it("treats a one-bedroom miss as a near miss and a two-bedroom miss as a different product", () => {
    const oneOff = calculateMatch(requirement, { ...perfect, bedrooms: 2 });
    const twoOff = calculateMatch(requirement, { ...perfect, bedrooms: 1 });
    expect(oneOff.breakdown.find((d) => d.dimension === "bedrooms")?.score).toBe(55);
    expect(twoOff.breakdown.find((d) => d.dimension === "bedrooms")?.score).toBe(20);
  });

  it("scores a nearby locality below an exact one but above an unrelated one", () => {
    const exact = calculateMatch(requirement, perfect);
    const nearby = calculateMatch(requirement, {
      ...perfect,
      locality: "Sector 16B",
      coordinates: { latitude: 28.62, longitude: 77.45 },
    });
    const distant = calculateMatch(requirement, {
      ...perfect,
      locality: "Sector 62",
      coordinates: { latitude: 28.75, longitude: 77.6 },
    });
    expect(exact.score).toBeGreaterThan(nearby.score);
    expect(nearby.score).toBeGreaterThan(distant.score);
  });

  it("credits partial amenity coverage proportionally", () => {
    const half = calculateMatch(requirement, { ...perfect, amenities: ["lift", "gym"] });
    expect(half.breakdown.find((d) => d.dimension === "amenities")?.score).toBe(50);
  });
});

describe("hard disqualifiers", () => {
  it("refuses to offer a rental against a purchase requirement", () => {
    const result = calculateMatch(requirement, { ...perfect, listingType: "RENT" });
    expect(result.score).toBe(0);
    expect(result.disqualifiers[0]).toMatch(/sale/i);
  });

  it("refuses to offer an unverified listing", () => {
    const result = calculateMatch(requirement, { ...perfect, isVerified: false });
    expect(result.score).toBe(0);
    expect(result.disqualifiers).toContain("Listing is not verified.");
  });

  it("refuses a property in a different city", () => {
    const result = calculateMatch(requirement, { ...perfect, city: "Mumbai" });
    expect(result.score).toBe(0);
  });

  it("refuses a property type that was not requested", () => {
    const result = calculateMatch(requirement, { ...perfect, propertyType: "PLOT" });
    expect(result.score).toBe(0);
  });

  it("matches city names case- and whitespace-insensitively", () => {
    const result = calculateMatch(requirement, { ...perfect, city: "  greater noida " });
    expect(result.disqualifiers).toEqual([]);
  });
});

describe("matchListings", () => {
  const candidates: ListingCandidate[] = [
    perfect,
    // Same locality and bedroom count, but priced at the top of budget, with
    // half the requested amenities and a west-facing unit.
    {
      ...perfect,
      id: "listing-ok",
      price: "14800000.00",
      locality: "Sector 137",
      facing: "WEST",
      amenities: ["lift", "security_24x7"],
      verificationScore: 72,
    },
    { ...perfect, id: "listing-weak", price: "14900000.00", bedrooms: 2, locality: "Sector 62", coordinates: { latitude: 28.75, longitude: 77.6 } },
    { ...perfect, id: "listing-rental", listingType: "RENT" },
    { ...perfect, id: "listing-unverified", isVerified: false },
  ];

  it("returns only qualifying listings, best first", () => {
    const results = matchListings(requirement, candidates);
    expect(results[0]!.listingId).toBe("listing-perfect");
    expect(results.map((r) => r.listingId)).not.toContain("listing-rental");
    expect(results.map((r) => r.listingId)).not.toContain("listing-unverified");
  });

  it("honours the minimum score", () => {
    const strict = matchListings(requirement, candidates, { minimumScore: 95 });
    expect(strict.every((r) => r.score >= 95)).toBe(true);
  });

  it("is stable: equal scores keep a deterministic order", () => {
    const twins: ListingCandidate[] = [
      { ...perfect, id: "b-twin" },
      { ...perfect, id: "a-twin" },
    ];
    expect(matchListings(requirement, twins).map((r) => r.listingId)).toEqual(["a-twin", "b-twin"]);
  });

  it("lets a ranker reorder results without inventing matches", () => {
    const reverseRanker: MatchRanker = {
      name: "reverse",
      rerank: (matches) => [...matches].reverse(),
    };
    const normal = matchListings(requirement, candidates);
    const ranked = matchListings(requirement, candidates, { ranker: reverseRanker });
    expect(ranked.map((m) => m.listingId)).toEqual(normal.map((m) => m.listingId).reverse());
    expect(ranked).toHaveLength(normal.length);
  });

  it("handles an empty candidate set", () => {
    expect(matchListings(requirement, [])).toEqual([]);
  });
});

describe("matchLabel", () => {
  it("labels bands for display", () => {
    expect(matchLabel(95)).toBe("Excellent");
    expect(matchLabel(80)).toBe("Strong");
    expect(matchLabel(65)).toBe("Good");
    expect(matchLabel(45)).toBe("Partial");
  });
});
