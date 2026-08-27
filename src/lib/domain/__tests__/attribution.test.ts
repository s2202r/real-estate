import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUALIFICATION_RULES,
  qualifyVisit,
  summariseAttribution,
  type VisitQualificationInput,
} from "../attribution";
import { boundingBox, distanceMeters, formatDistance, isWithinGeofence } from "../geo";

const PROPERTY = { latitude: 28.5041, longitude: 77.391 };

function goodVisit(overrides: Partial<VisitQualificationInput> = {}): VisitQualificationInput {
  return {
    visitId: "visit-1",
    visitType: "PHYSICAL",
    startedAt: "2026-08-18T10:00:00Z",
    endedAt: "2026-08-18T10:45:00Z",
    agentCheckedInAt: "2026-08-18T10:00:00Z",
    customerConfirmedAt: "2026-08-18T10:47:00Z",
    otpVerifiedAt: "2026-08-18T10:46:00Z",
    agentLocation: { latitude: 28.5041, longitude: 77.3911, accuracyMeters: 8 },
    propertyLocation: PROPERTY,
    outcomeRecorded: true,
    ...overrides,
  };
}

describe("visit qualification — the gate on the money", () => {
  it("qualifies a visit where every signal agrees", () => {
    const result = qualifyVisit(goodVisit());
    expect(result.qualified).toBe(true);
    expect(result.disqualificationReason).toBeNull();
    expect(result.durationMinutes).toBe(45);
  });

  it("rejects a visit the agent never checked in to", () => {
    const result = qualifyVisit(goodVisit({ agentCheckedInAt: null }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReason).toMatch(/never checked in/i);
  });

  it("rejects a visit the customer never confirmed", () => {
    // This is the collusion-resistant signal: without the customer, no payout.
    const result = qualifyVisit(goodVisit({ customerConfirmedAt: null, otpVerifiedAt: null }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReason).toMatch(/has not confirmed/i);
  });

  it("accepts OTP as customer confirmation when the policy allows it", () => {
    const result = qualifyVisit(goodVisit({ customerConfirmedAt: null }));
    expect(result.qualified).toBe(true);
    expect(result.checks.find((c) => c.key === "customerConfirmation")?.detail).toMatch(/OTP/);
  });

  it("rejects OTP-only confirmation when the policy forbids it", () => {
    const result = qualifyVisit(goodVisit({ customerConfirmedAt: null }), {
      ...DEFAULT_QUALIFICATION_RULES,
      allowOtpAsCustomerConfirmation: false,
    });
    expect(result.qualified).toBe(false);
  });

  it("rejects a drive-by visit that is too short to be meaningful", () => {
    const result = qualifyVisit(
      goodVisit({ startedAt: "2026-08-18T10:00:00Z", endedAt: "2026-08-18T10:04:00Z" }),
    );
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReason).toMatch(/below the 10-minute minimum/);
  });

  it("rejects an incomplete visit", () => {
    const result = qualifyVisit(goodVisit({ endedAt: null }));
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReason).toMatch(/never completed/i);
  });

  it("rejects a visit whose GPS fix contradicts the property location", () => {
    // Checked in from ~9 km away: not a weak signal, a contradicted one.
    const result = qualifyVisit(
      goodVisit({ agentLocation: { latitude: 28.58, longitude: 77.391, accuracyMeters: 10 } }),
    );
    expect(result.qualified).toBe(false);
    expect(result.geofencePassed).toBe(false);
    expect(result.disqualificationReason).toMatch(/outside the 200 m geofence/);
  });

  it("tolerates a missing GPS fix by default, since basements exist", () => {
    const result = qualifyVisit(goodVisit({ agentLocation: null }));
    expect(result.qualified).toBe(true);
    expect(result.geofencePassed).toBeNull();
  });

  it("requires a GPS fix when the deployment demands one", () => {
    const result = qualifyVisit(goodVisit({ agentLocation: null }), {
      ...DEFAULT_QUALIFICATION_RULES,
      requireGeofenceForPhysical: true,
    });
    expect(result.qualified).toBe(false);
    expect(result.disqualificationReason).toMatch(/No usable location fix/);
  });

  it("credits GPS accuracy so an imprecise phone is not punished", () => {
    // 250 m away but the device reports ±100 m: inside a 200 m fence.
    const result = qualifyVisit(
      goodVisit({
        agentLocation: { latitude: 28.50635, longitude: 77.391, accuracyMeters: 100 },
      }),
    );
    expect(result.geofencePassed).toBe(true);
    expect(result.qualified).toBe(true);
  });

  it("skips the location check for a virtual visit", () => {
    const result = qualifyVisit(
      goodVisit({ visitType: "VIRTUAL", agentLocation: null, propertyLocation: null }),
    );
    expect(result.qualified).toBe(true);
    expect(result.geofencePassed).toBeNull();
  });

  it("does not disqualify merely for a missing outcome, but says so", () => {
    const result = qualifyVisit(goodVisit({ outcomeRecorded: false }));
    expect(result.qualified).toBe(true);
    const check = result.checks.find((c) => c.key === "outcomeRecorded");
    expect(check?.passed).toBe(false);
    expect(check?.required).toBe(false);
  });

  it("explains every check, pass or fail", () => {
    const result = qualifyVisit(goodVisit({ agentCheckedInAt: null }));
    expect(result.checks).toHaveLength(6);
    expect(result.checks.every((c) => c.detail.length > 0)).toBe(true);
  });

  it("rejects a negative-duration visit rather than trusting the clock", () => {
    const result = qualifyVisit(
      goodVisit({ startedAt: "2026-08-18T11:00:00Z", endedAt: "2026-08-18T10:00:00Z" }),
    );
    expect(result.qualified).toBe(false);
    expect(result.durationMinutes).toBeNull();
  });

  it("is deterministic", () => {
    const input = goodVisit();
    const first = qualifyVisit(input);
    for (let i = 0; i < 20; i += 1) expect(qualifyVisit(input)).toEqual(first);
  });
});

describe("geo", () => {
  it("computes a known distance", () => {
    // Noida Sector 137 to Connaught Place is roughly 22 km.
    const distance = distanceMeters(PROPERTY, { latitude: 28.6315, longitude: 77.2167 });
    expect(distance).toBeGreaterThan(20_000);
    expect(distance).toBeLessThan(25_000);
  });

  it("returns zero for the same point", () => {
    expect(distanceMeters(PROPERTY, PROPERTY)).toBe(0);
  });

  it("evaluates a geofence with accuracy", () => {
    const near = isWithinGeofence({ latitude: 28.5042, longitude: 77.3911 }, PROPERTY, 200);
    expect(near.within).toBe(true);
    const far = isWithinGeofence({ latitude: 28.6, longitude: 77.391 }, PROPERTY, 200);
    expect(far.within).toBe(false);
  });

  it("builds a usable bounding box", () => {
    const box = boundingBox(PROPERTY, 5);
    expect(box.minLat).toBeLessThan(PROPERTY.latitude);
    expect(box.maxLat).toBeGreaterThan(PROPERTY.latitude);
    expect(box.minLng).toBeLessThan(PROPERTY.longitude);
    expect(box.maxLng).toBeGreaterThan(PROPERTY.longitude);
  });

  it("does not blow up at the poles", () => {
    const box = boundingBox({ latitude: 90, longitude: 0 }, 5);
    expect(Number.isFinite(box.minLng)).toBe(true);
    expect(box.maxLat).toBeLessThanOrEqual(90);
  });

  it("formats distances the way people read them", () => {
    expect(formatDistance(0.4)).toBe("400 m");
    expect(formatDistance(2.35)).toBe("2.4 km");
    expect(formatDistance(18.2)).toBe("18 km");
  });
});

describe("lead attribution projection", () => {
  it("keeps the FIRST listing agent and the LATEST sales agent", () => {
    const summary = summariseAttribution([
      { agentId: "a", role: "LISTING_AGENT", source: "ORGANIC_WEBSITE", occurredAt: "2026-01-01T00:00:00Z" },
      { agentId: "b", role: "SALES_AGENT", source: "CUSTOMER_SEARCH", occurredAt: "2026-01-02T00:00:00Z" },
      { agentId: "c", role: "SALES_AGENT", source: "AGENT_INVENTORY_SHARE", occurredAt: "2026-01-05T00:00:00Z" },
      { agentId: "z", role: "LISTING_AGENT", source: "ORGANIC_WEBSITE", occurredAt: "2026-01-06T00:00:00Z" },
    ]);
    expect(summary.listingAgentId).toBe("a");
    expect(summary.salesAgentId).toBe("c");
  });

  it("accumulates distinct visiting agents in visit order", () => {
    const summary = summariseAttribution([
      { agentId: "v1", role: "VISITING_AGENT", source: "OTHER", occurredAt: "2026-01-03T00:00:00Z" },
      { agentId: "v2", role: "VISITING_AGENT", source: "OTHER", occurredAt: "2026-01-04T00:00:00Z" },
      { agentId: "v1", role: "VISITING_AGENT", source: "OTHER", occurredAt: "2026-01-09T00:00:00Z" },
    ]);
    expect(summary.visitingAgentIds).toEqual(["v1", "v2"]);
  });

  it("records first and last touch", () => {
    const summary = summariseAttribution([
      { agentId: "b", role: "SALES_AGENT", source: "WHATSAPP", occurredAt: "2026-02-02T00:00:00Z" },
      { agentId: "a", role: "LISTING_AGENT", source: "ORGANIC_WEBSITE", occurredAt: "2026-01-01T00:00:00Z" },
    ]);
    expect(summary.firstTouch?.agentId).toBe("a");
    expect(summary.lastTouch?.agentId).toBe("b");
  });

  it("handles an empty log", () => {
    const summary = summariseAttribution([]);
    expect(summary.listingAgentId).toBeNull();
    expect(summary.visitingAgentIds).toEqual([]);
    expect(summary.firstTouch).toBeNull();
  });
});
