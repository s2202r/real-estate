import { describe, expect, it } from "vitest";
import {
  calculateListingCompleteness,
  calculateLocationScore,
  calculatePriceIntelligence,
  calculateTrustScore,
  type AgentPerformanceInput,
  type NearbyPlace,
} from "../scoring";
import { assessDuplicate, DUPLICATE_REVIEW_THRESHOLD, propertyFingerprint } from "../duplicates";
import { formatReference, isValidReference, listingPath, parseReference } from "../references";

describe("location score", () => {
  const wellConnected: NearbyPlace[] = [
    { placeType: "METRO", name: "Sector 137 Metro", distanceKm: 0.6 },
    { placeType: "SCHOOL", name: "DPS", distanceKm: 1.1 },
    { placeType: "HOSPITAL", name: "Fortis", distanceKm: 1.8 },
    { placeType: "MALL", name: "Great India Place", distanceKm: 1.9 },
    { placeType: "OFFICE_HUB", name: "Sector 62 IT Park", distanceKm: 3.5 },
    { placeType: "HIGHWAY", name: "Noida Expressway", distanceKm: 0.9 },
    { placeType: "AIRPORT", name: "IGI Airport", distanceKm: 32 },
  ];

  it("grades a well-connected property highly", () => {
    const result = calculateLocationScore(wellConnected);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.grade).toBe("Excellent");
  });

  it("grades a remote property poorly", () => {
    const result = calculateLocationScore([
      { placeType: "METRO", name: "Far Metro", distanceKm: 12 },
      { placeType: "SCHOOL", name: "Far School", distanceKm: 9 },
      { placeType: "HOSPITAL", name: "Far Hospital", distanceKm: 15 },
      { placeType: "AIRPORT", name: "Airport", distanceKm: 80 },
    ]);
    expect(result.score).toBeLessThan(35);
    expect(result.grade).toBe("Limited");
  });

  it("reports coverage so low-data properties are not over-claimed", () => {
    const sparse = calculateLocationScore([
      { placeType: "METRO", name: "Metro", distanceKm: 0.5 },
    ]);
    expect(sparse.coverage).toBeLessThan(0.3);
    // Scoring against covered weight only: one perfect factor is still 100...
    expect(sparse.score).toBe(100);
    // ...but the caller can see the evidence was thin.
    expect(sparse.factors.filter((f) => f.nearest === null).length).toBeGreaterThan(4);
  });

  it("returns zero with no data at all rather than a flattering default", () => {
    const empty = calculateLocationScore([]);
    expect(empty.score).toBe(0);
    expect(empty.coverage).toBe(0);
  });

  it("picks the nearest place of each type", () => {
    const result = calculateLocationScore([
      { placeType: "METRO", name: "Far", distanceKm: 5 },
      { placeType: "METRO", name: "Near", distanceKm: 0.4 },
    ]);
    expect(result.factors.find((f) => f.key === "transit")?.nearest?.name).toBe("Near");
  });

  it("stays within 0-100", () => {
    for (const distance of [0, 0.1, 1, 5, 50, 500]) {
      const result = calculateLocationScore([
        { placeType: "METRO", name: "M", distanceKm: distance },
      ]);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("agent trust score", () => {
  const strong: AgentPerformanceInput = {
    closedDealCount: 24,
    ratingAverage: 4.8,
    ratingCount: 40,
    responseRate: 96,
    visitCompletionRate: 94,
    cancellationRate: 3,
    complaintCount: 0,
    listingAccuracyRate: 97,
    monthsOnPlatform: 30,
    isIdentityVerified: true,
    isReraVerified: true,
  };

  it("scores an excellent agent highly and awards both badges", () => {
    const result = calculateTrustScore(strong);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.eligibleForTrustedBadge).toBe(true);
    expect(result.eligibleForTopPerformerBadge).toBe(true);
  });

  it("does not let a tiny sample of 5-star ratings inflate the score", () => {
    const newAgent = calculateTrustScore({
      ...strong,
      ratingAverage: 5,
      ratingCount: 1,
      closedDealCount: 0,
      monthsOnPlatform: 1,
    });
    const established = calculateTrustScore({ ...strong, ratingAverage: 4.5, ratingCount: 60 });
    expect(newAgent.score).toBeLessThan(established.score);
    expect(newAgent.eligibleForTopPerformerBadge).toBe(false);
  });

  it("penalises complaints hard", () => {
    const clean = calculateTrustScore(strong);
    const complained = calculateTrustScore({ ...strong, complaintCount: 3 });
    expect(clean.score - complained.score).toBeGreaterThanOrEqual(18);
    expect(complained.eligibleForTrustedBadge).toBe(false);
  });

  it("withholds the trusted badge from an unverified agent regardless of score", () => {
    const result = calculateTrustScore({ ...strong, isIdentityVerified: false });
    expect(result.eligibleForTrustedBadge).toBe(false);
  });

  it("stays within 0-100 for a worst case", () => {
    const worst = calculateTrustScore({
      closedDealCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
      responseRate: 0,
      visitCompletionRate: 0,
      cancellationRate: 100,
      complaintCount: 50,
      listingAccuracyRate: 0,
      monthsOnPlatform: 0,
      isIdentityVerified: false,
      isReraVerified: false,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});

describe("price intelligence", () => {
  const comparables = [7000, 7200, 6800, 7100, 7300, 6900, 7050];

  it("calls a mid-market price fair", () => {
    const result = calculatePriceIntelligence("11200000.00", 1600, comparables);
    expect(result.verdict).toBe("FAIR_PRICE");
  });

  it("identifies a below-market price", () => {
    const result = calculatePriceIntelligence("8800000.00", 1600, comparables);
    expect(result.verdict).toBe("BELOW_MARKET");
    expect(result.deltaPercent).toBeLessThan(-12);
  });

  it("identifies an above-market price", () => {
    const result = calculatePriceIntelligence("14000000.00", 1600, comparables);
    expect(result.verdict).toBe("ABOVE_MARKET");
  });

  it("refuses a verdict on a thin sample rather than guessing", () => {
    const result = calculatePriceIntelligence("11200000.00", 1600, [7000, 7100]);
    expect(result.verdict).toBe("INSUFFICIENT_DATA");
    expect(result.pricePerSqft).toBeNull();
  });

  it("refuses a verdict without an area", () => {
    expect(calculatePriceIntelligence("11200000.00", null, comparables).verdict).toBe(
      "INSUFFICIENT_DATA",
    );
  });

  it("always carries a disclaimer, whatever the verdict", () => {
    for (const price of ["8800000.00", "11200000.00", "14000000.00"]) {
      const result = calculatePriceIntelligence(price, 1600, comparables);
      expect(result.disclaimer).toMatch(/not a valuation/i);
    }
    expect(calculatePriceIntelligence("1.00", null, []).disclaimer).toMatch(/not a valuation/i);
  });

  it("reports the sample size behind the verdict", () => {
    const result = calculatePriceIntelligence("11200000.00", 1600, comparables);
    expect(result.sampleSize).toBe(comparables.length);
  });
});

describe("listing completeness", () => {
  it("scores a complete listing at 100 with nothing missing", () => {
    const result = calculateListingCompleteness({
      hasImages: 8,
      hasFloorPlan: true,
      hasVideoOrTour: true,
      hasDescription: true,
      hasAmenities: true,
      hasNearbyPlaces: true,
      hasCoordinates: true,
      hasReraNumber: true,
      hasDocuments: true,
      hasCarpetArea: true,
    });
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it("tells an agent exactly what is missing", () => {
    const result = calculateListingCompleteness({
      hasImages: 2,
      hasFloorPlan: false,
      hasVideoOrTour: false,
      hasDescription: true,
      hasAmenities: false,
      hasNearbyPlaces: false,
      hasCoordinates: true,
      hasReraNumber: false,
      hasDocuments: false,
      hasCarpetArea: true,
    });
    expect(result.score).toBeLessThan(60);
    expect(result.missing).toContain("At least 5 photographs");
    expect(result.missing).toContain("Floor plan");
  });
});

describe("duplicate detection", () => {
  const base = {
    id: "a",
    projectId: "project-1",
    tower: "Tower B",
    unitNumber: "1203",
    floor: 12,
    builtUpArea: 1650,
    bedrooms: 3,
    coordinates: { latitude: 28.5041, longitude: 77.391 },
    price: 13500000,
    imageHashes: ["hash-1", "hash-2"],
  };

  it("flags the same unit listed twice", () => {
    const result = assessDuplicate(base, { ...base, id: "b", price: 13800000 });
    expect(result.confidence).toBeGreaterThanOrEqual(DUPLICATE_REVIEW_THRESHOLD);
    expect(result.verdict).toBe("LIKELY_DUPLICATE");
    expect(result.requiresReview).toBe(true);
  });

  it("does NOT flag two different units in the same tower", () => {
    const result = assessDuplicate(base, {
      ...base,
      id: "b",
      unitNumber: "1204",
      imageHashes: ["hash-9"],
    });
    expect(result.requiresReview).toBe(false);
  });

  it("treats identical photographs as strong evidence", () => {
    const withShared = assessDuplicate(base, {
      ...base,
      id: "b",
      projectId: "project-2",
      unitNumber: "77",
    });
    const withoutShared = assessDuplicate(base, {
      ...base,
      id: "b",
      projectId: "project-2",
      unitNumber: "77",
      imageHashes: ["different"],
    });
    expect(withShared.confidence).toBeGreaterThan(withoutShared.confidence);
  });

  it("returns a signal breakdown a human can adjudicate from", () => {
    const result = assessDuplicate(base, { ...base, id: "b" });
    expect(result.signals.length).toBeGreaterThanOrEqual(6);
    expect(result.signals.every((s) => s.detail.length > 0)).toBe(true);
  });

  it("copes with missing data instead of guessing", () => {
    const sparse = assessDuplicate(
      { id: "a" },
      { id: "b" },
    );
    expect(sparse.confidence).toBe(0);
    expect(sparse.verdict).toBe("UNLIKELY");
  });

  it("never returns a confidence outside 0-100", () => {
    const result = assessDuplicate(base, { ...base, id: "b" });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it("buckets fingerprints so near-identical areas collide", () => {
    const a = propertyFingerprint({ city: "Noida", locality: "Sector 137", tower: "B", unitNumber: "1203", bedrooms: 3, builtUpArea: 1648 });
    const b = propertyFingerprint({ city: " noida ", locality: "sector 137", tower: "b", unitNumber: "1203", bedrooms: 3, builtUpArea: 1652 });
    expect(a).toBe(b);
  });
});

describe("reference codes", () => {
  it("formats a passport reference", () => {
    expect(formatReference("PROP", "NCR", 1827, 7)).toBe("PROP-NCR-0001827");
  });

  it("parses and identifies a reference kind", () => {
    const parsed = parseReference("PROP-NCR-0001827");
    expect(parsed).toEqual({ kind: "property", prefix: "PROP", scope: "NCR", sequence: 1827 });
  });

  it("parses a deal reference", () => {
    expect(parseReference("DEAL-NCR-000456")?.kind).toBe("deal");
  });

  it("rejects malformed references", () => {
    expect(parseReference("not-a-reference")).toBeNull();
    expect(parseReference("PROP-NCR")).toBeNull();
    expect(isValidReference("PROP-NCR-0001827", "listing")).toBe(false);
    expect(isValidReference("PROP-NCR-0001827", "property")).toBe(true);
  });

  it("builds the SEO listing path from the brief", () => {
    expect(
      listingPath({
        locality: "Noida Extension",
        slug: "3BHK Apartment Sector 12",
        reference: "PROP-123456",
      }),
    ).toBe("/property/noida-extension/3bhk-apartment-sector-12/prop-123456");
  });
});
