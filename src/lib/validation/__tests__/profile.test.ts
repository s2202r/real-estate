import { describe, expect, it } from "vitest";
import { AGENT_LANGUAGES, AgentProfileSchema, CustomerProfileSchema } from "../profile";

const agent = {
  agencyName: "Sharma Realty",
  headline: "Resale flats in Noida Extension",
  bio: "Nine years in the NCR resale market.",
  experienceYears: 9,
  languages: ["English", "Hindi"],
  serviceCities: ["Noida", "Ghaziabad"],
  acceptsVisitRequests: true,
  maxVisitDistanceKm: 25,
};

describe("CustomerProfileSchema", () => {
  it("accepts a filled-in profile and canonicalises the city", () => {
    const result = CustomerProfileSchema.parse({
      fullName: "  Sunita Rao ",
      displayName: "Sunita",
      phone: "9876543210",
      city: "bangalore",
    });

    expect(result.fullName).toBe("Sunita Rao");
    expect(result.city).toBe("Bengaluru");
  });

  it("treats empty optional fields as absent rather than as empty strings", () => {
    const result = CustomerProfileSchema.parse({
      fullName: "Sunita Rao",
      displayName: "",
      phone: "",
      city: "",
    });

    expect(result.displayName).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.city).toBeUndefined();
  });

  it("requires a name and a real mobile number when one is given", () => {
    expect(CustomerProfileSchema.safeParse({ fullName: "A" }).success).toBe(false);
    expect(
      CustomerProfileSchema.safeParse({ fullName: "Sunita Rao", phone: "1234567890" }).success,
    ).toBe(false);
  });

  it("has no field for anything the account is identified or trusted by", () => {
    // The schema IS the boundary: a field absent here cannot be written by the
    // form that uses it.
    const fields = Object.keys(CustomerProfileSchema.shape);
    for (const forbidden of ["email", "emailVerifiedAt", "phoneVerifiedAt", "role", "id"]) {
      expect(fields, forbidden).not.toContain(forbidden);
    }
  });
});

describe("AgentProfileSchema", () => {
  it("accepts a complete profile", () => {
    expect(AgentProfileSchema.safeParse(agent).success).toBe(true);
  });

  it("canonicalises every service city", () => {
    const result = AgentProfileSchema.parse({
      ...agent,
      serviceCities: ["  noida ", "BENGALURU"],
    });
    expect(result.serviceCities).toEqual(["Noida", "Bengaluru"]);
  });

  it("insists on at least one city and one language", () => {
    expect(AgentProfileSchema.safeParse({ ...agent, serviceCities: [] }).success).toBe(false);
    expect(AgentProfileSchema.safeParse({ ...agent, languages: [] }).success).toBe(false);
  });

  it("caps the city list, because forty cities is not forty cities served", () => {
    const many = Array.from({ length: 13 }, (_, index) => `City ${index}`);
    expect(AgentProfileSchema.safeParse({ ...agent, serviceCities: many }).success).toBe(false);
  });

  it("rejects a language outside the set the directory filters on", () => {
    // Free text here would be unfindable by the filter that reads it.
    expect(AgentProfileSchema.safeParse({ ...agent, languages: ["Klingon"] }).success).toBe(false);
    expect(AGENT_LANGUAGES).toContain("Hindi");
  });

  it("keeps experience and travel distance within stated bounds", () => {
    expect(AgentProfileSchema.safeParse({ ...agent, experienceYears: 71 }).success).toBe(false);
    expect(AgentProfileSchema.safeParse({ ...agent, experienceYears: -1 }).success).toBe(false);
    expect(AgentProfileSchema.safeParse({ ...agent, maxVisitDistanceKm: 0 }).success).toBe(false);
    expect(AgentProfileSchema.safeParse({ ...agent, maxVisitDistanceKm: 500 }).success).toBe(false);
  });

  it("has NO field for anything the platform judges about an agent", () => {
    // §10, §13: standing is granted after review and never self-claimed. The
    // database reverts these too; this is the half a reviewer can read.
    const fields = Object.keys(AgentProfileSchema.shape);
    for (const forbidden of [
      "badges", "verificationLevel", "trustScore", "ratingAverage", "ratingCount",
      "responseRate", "conversionRate", "complaintCount", "closedDealCount",
      "riskScore", "status", "slug",
    ]) {
      expect(fields, forbidden).not.toContain(forbidden);
    }
  });
});
