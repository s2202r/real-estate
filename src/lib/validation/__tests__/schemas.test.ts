import { describe, expect, it } from "vitest";
import { CommissionPolicySchema, CommissionRuleFormSchema } from "../commission";
import { EnquirySchema, RequirementSchema, VisitRequestSchema } from "../leads";
import { ListingDraftSchema, ModerationSchema } from "../listings";
import { DEFAULT_COMMISSION_POLICY } from "@/lib/domain/commission";

/**
 * Validation tests.
 *
 * These schemas are the SERVER-side gate. Every case below represents input a
 * client could post directly, bypassing whatever the form allowed.
 */

describe("CommissionPolicySchema", () => {
  it("accepts the platform default policy", () => {
    expect(CommissionPolicySchema.safeParse(DEFAULT_COMMISSION_POLICY).success).toBe(true);
  });

  it("rejects a policy that pays nobody", () => {
    const result = CommissionPolicySchema.safeParse({
      ...DEFAULT_COMMISSION_POLICY,
      roleShares: { LISTING_AGENT: 0, PLATFORM: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a share above 100%", () => {
    const result = CommissionPolicySchema.safeParse({
      ...DEFAULT_COMMISSION_POLICY,
      roleShares: { LISTING_AGENT: 140 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown visit model", () => {
    const result = CommissionPolicySchema.safeParse({
      ...DEFAULT_COMMISSION_POLICY,
      visitModel: "WHATEVER_THE_ADMIN_TYPED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a floor that is not a decimal amount", () => {
    const result = CommissionPolicySchema.safeParse({
      ...DEFAULT_COMMISSION_POLICY,
      floors: { LISTING_AGENT: "one lakh" },
    });
    expect(result.success).toBe(false);
  });
});

describe("CommissionRuleFormSchema", () => {
  const base = {
    code: "default-sale",
    name: "Default sale commission",
    poolMode: "PERCENT_OF_TRANSACTION" as const,
    poolPercent: 2,
    priority: 100,
    isActive: true,
    policy: DEFAULT_COMMISSION_POLICY,
  };

  it("accepts a well-formed rule", () => {
    expect(CommissionRuleFormSchema.safeParse(base).success).toBe(true);
  });

  it("requires a percentage for a percentage pool", () => {
    const result = CommissionRuleFormSchema.safeParse({ ...base, poolPercent: undefined });
    expect(result.success).toBe(false);
  });

  it("requires an amount for a fixed pool", () => {
    const result = CommissionRuleFormSchema.safeParse({
      ...base,
      poolMode: "FIXED_AMOUNT",
      poolPercent: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inverted pool range", () => {
    const result = CommissionRuleFormSchema.safeParse({
      ...base,
      minPoolAmount: "100000.00",
      maxPoolAmount: "50000.00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a code that is not URL-safe", () => {
    expect(CommissionRuleFormSchema.safeParse({ ...base, code: "Default Sale!" }).success).toBe(false);
  });
});

describe("VisitRequestSchema", () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  it("accepts a future booking", () => {
    const result = VisitRequestSchema.safeParse({
      listingId: "11111111-1111-4111-8111-111111111111",
      requestedDate: tomorrow,
      requestedTime: "16:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a booking in the past", () => {
    const result = VisitRequestSchema.safeParse({
      listingId: "11111111-1111-4111-8111-111111111111",
      requestedDate: yesterday,
      requestedTime: "16:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed time", () => {
    const result = VisitRequestSchema.safeParse({
      listingId: "11111111-1111-4111-8111-111111111111",
      requestedDate: tomorrow,
      requestedTime: "4pm",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a listing id that is not a UUID", () => {
    const result = VisitRequestSchema.safeParse({
      listingId: "'; drop table listings; --",
      requestedDate: tomorrow,
      requestedTime: "16:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("EnquirySchema", () => {
  it("caps message length", () => {
    const result = EnquirySchema.safeParse({
      listingId: "11111111-1111-4111-8111-111111111111",
      message: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("defaults the source rather than trusting an arbitrary one", () => {
    const result = EnquirySchema.safeParse({
      listingId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source).toBe("CUSTOMER_SEARCH");
  });

  it("rejects an unknown source", () => {
    const result = EnquirySchema.safeParse({
      listingId: "11111111-1111-4111-8111-111111111111",
      source: "PAID_FOR_PLACEMENT",
    });
    expect(result.success).toBe(false);
  });
});

describe("RequirementSchema", () => {
  const base = {
    listingType: "SALE" as const,
    propertyTypes: ["APARTMENT"],
    city: "Noida",
    budgetMax: 15_000_000,
  };

  it("accepts a minimal requirement", () => {
    expect(RequirementSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an inverted budget range", () => {
    const result = RequirementSchema.safeParse({
      ...base,
      budgetMin: 20_000_000,
      budgetMax: 10_000_000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inverted bedroom range", () => {
    const result = RequirementSchema.safeParse({ ...base, bedroomsMin: 4, bedroomsMax: 2 });
    expect(result.success).toBe(false);
  });

  it("requires at least one property type", () => {
    expect(RequirementSchema.safeParse({ ...base, propertyTypes: [] }).success).toBe(false);
  });
});

describe("ListingDraftSchema", () => {
  const base = {
    title: "3 BHK apartment for sale in Sector 137",
    listingType: "SALE" as const,
    propertyType: "APARTMENT" as const,
    price: "8500000",
    builtUpArea: 1650,
    city: "Noida",
    locality: "Sector 137",
    state: "Uttar Pradesh",
  };

  it("accepts a well-formed draft", () => {
    expect(ListingDraftSchema.safeParse(base).success).toBe(true);
  });

  it("rejects carpet area larger than built-up area", () => {
    const result = ListingDraftSchema.safeParse({ ...base, carpetArea: 2000 });
    expect(result.success).toBe(false);
  });

  it("rejects a floor above the building's total floors", () => {
    const result = ListingDraftSchema.safeParse({ ...base, floor: 30, totalFloors: 22 });
    expect(result.success).toBe(false);
  });

  it("rejects a security deposit on a sale listing", () => {
    const result = ListingDraftSchema.safeParse({ ...base, securityDeposit: "50000" });
    expect(result.success).toBe(false);
  });

  it("rejects a price that is not a decimal amount", () => {
    expect(ListingDraftSchema.safeParse({ ...base, price: "85 lakh" }).success).toBe(false);
  });

  it("rejects a malformed PIN code", () => {
    expect(ListingDraftSchema.safeParse({ ...base, pincode: "20130" }).success).toBe(false);
  });

  it("has no field through which an agent could set a moderation outcome", () => {
    const parsed = ListingDraftSchema.parse({
      ...base,
      // Even if a client posts these, they are stripped rather than honoured.
      status: "VERIFIED",
      verificationScore: 100,
      isExclusive: true,
    } as never);
    expect("status" in parsed).toBe(false);
    expect("verificationScore" in parsed).toBe(false);
    expect("isExclusive" in parsed).toBe(false);
  });
});

describe("ModerationSchema", () => {
  const listingId = "11111111-1111-4111-8111-111111111111";

  it("allows approval without a reason", () => {
    expect(ModerationSchema.safeParse({ listingId, decision: "APPROVE" }).success).toBe(true);
  });

  it("REQUIRES a reason when rejecting, so the agent can act on it", () => {
    expect(ModerationSchema.safeParse({ listingId, decision: "REJECT" }).success).toBe(false);
    expect(
      ModerationSchema.safeParse({
        listingId,
        decision: "REJECT",
        rejectionReason: "Photographs do not match the stated address.",
      }).success,
    ).toBe(true);
  });

  it("rejects a verification score outside 0-100", () => {
    expect(
      ModerationSchema.safeParse({ listingId, decision: "APPROVE", verificationScore: 140 }).success,
    ).toBe(false);
  });
});
