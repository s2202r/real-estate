/**
 * Visit qualification and attribution.
 *
 * A visit is where commission is earned, which makes it the obvious target for
 * fraud: two colluding agents can "conduct" a visit that never happened. So a
 * visit does not earn money because someone pressed a button — it earns money
 * when several INDEPENDENT signals agree.
 *
 * The predicate is pure and exhaustively tested because it is the gate on the
 * money. It is also deliberately explainable: `qualifyVisit` returns the reason
 * for every decision, so a rejected agent can see exactly which signal failed.
 */

import { distanceMeters, isValidCoordinates, type Coordinates } from "./geo";

export type VisitType = "PHYSICAL" | "VIRTUAL" | "LIVE_VIDEO";

export interface VisitQualificationInput {
  readonly visitId: string;
  readonly visitType: VisitType;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly agentCheckedInAt: string | null;
  readonly customerConfirmedAt: string | null;
  readonly otpVerifiedAt: string | null;
  /** Where the agent checked in from, if reported. */
  readonly agentLocation?: (Coordinates & { accuracyMeters?: number }) | null;
  readonly propertyLocation?: Coordinates | null;
  readonly outcomeRecorded: boolean;
}

export interface QualificationRules {
  readonly minDurationMinutes: number;
  readonly geofenceRadiusMeters: number;
  /**
   * Whether a physical visit must produce a GPS fix at all. Left configurable
   * because indoor basements and older devices genuinely fail to get one; when
   * false, a missing fix is tolerated but a fix that lands far away still fails.
   */
  readonly requireGeofenceForPhysical: boolean;
  /** Whether OTP confirmation may substitute for in-app confirmation. */
  readonly allowOtpAsCustomerConfirmation: boolean;
}

export const DEFAULT_QUALIFICATION_RULES: QualificationRules = {
  minDurationMinutes: 10,
  geofenceRadiusMeters: 200,
  requireGeofenceForPhysical: false,
  allowOtpAsCustomerConfirmation: true,
};

export interface QualificationCheck {
  readonly key:
    | "agentCheckIn"
    | "visitCompleted"
    | "minimumDuration"
    | "customerConfirmation"
    | "geofence"
    | "outcomeRecorded";
  readonly passed: boolean;
  readonly required: boolean;
  readonly detail: string;
}

export interface QualificationResult {
  readonly visitId: string;
  readonly qualified: boolean;
  readonly checks: readonly QualificationCheck[];
  readonly durationMinutes: number | null;
  readonly geofenceDistanceMeters: number | null;
  readonly geofencePassed: boolean | null;
  /** Present when `qualified` is false: the first failing REQUIRED check. */
  readonly disqualificationReason: string | null;
}

export function qualifyVisit(
  input: VisitQualificationInput,
  rules: QualificationRules = DEFAULT_QUALIFICATION_RULES,
): QualificationResult {
  const checks: QualificationCheck[] = [];

  /* -- The agent must have been there ------------------------------------- */
  checks.push({
    key: "agentCheckIn",
    passed: Boolean(input.agentCheckedInAt),
    required: true,
    detail: input.agentCheckedInAt
      ? "Agent checked in."
      : "The agent never checked in to this visit.",
  });

  /* -- The visit must have run to completion ------------------------------- */
  const completed = Boolean(input.startedAt && input.endedAt);
  checks.push({
    key: "visitCompleted",
    passed: completed,
    required: true,
    detail: completed ? "Visit has a start and an end time." : "Visit was never completed.",
  });

  const durationMinutes = computeDurationMinutes(input.startedAt, input.endedAt);

  /* -- It must have lasted long enough to be meaningful -------------------- */
  const durationPassed = durationMinutes !== null && durationMinutes >= rules.minDurationMinutes;
  checks.push({
    key: "minimumDuration",
    passed: durationPassed,
    required: true,
    detail:
      durationMinutes === null
        ? "Visit duration is unknown."
        : durationPassed
          ? `Visit lasted ${durationMinutes} minutes.`
          : `Visit lasted ${durationMinutes} minutes, below the ${rules.minDurationMinutes}-minute minimum.`,
  });

  /* -- The customer must independently confirm ----------------------------- */
  // This is the signal an agent cannot fabricate alone, and it is why visit
  // fraud is hard here.
  const confirmedInApp = Boolean(input.customerConfirmedAt);
  const confirmedByOtp = rules.allowOtpAsCustomerConfirmation && Boolean(input.otpVerifiedAt);
  const customerConfirmed = confirmedInApp || confirmedByOtp;
  checks.push({
    key: "customerConfirmation",
    passed: customerConfirmed,
    required: true,
    detail: confirmedByOtp
      ? "Customer confirmed the visit by OTP."
      : confirmedInApp
        ? "Customer confirmed the visit in the app."
        : "The customer has not confirmed that this visit took place.",
  });

  /* -- A physical visit should have happened at the property --------------- */
  const geofence = evaluateGeofence(input, rules);
  checks.push({
    key: "geofence",
    passed: geofence.passed ?? !rules.requireGeofenceForPhysical,
    required: input.visitType === "PHYSICAL" && rules.requireGeofenceForPhysical,
    detail: geofence.detail,
  });

  /* -- The agent must record what happened --------------------------------- */
  checks.push({
    key: "outcomeRecorded",
    passed: input.outcomeRecorded,
    required: false,
    detail: input.outcomeRecorded
      ? "Visit outcome recorded."
      : "No visit outcome recorded (does not disqualify, but lowers the contribution score).",
  });

  // A reported location that is demonstrably far from the property fails the
  // visit whether or not a fix was strictly required: that is not a weak
  // signal, it is a contradicted one.
  const contradictedLocation = geofence.passed === false;

  const failedRequired = checks.find((check) => check.required && !check.passed);
  const qualified = !failedRequired && !contradictedLocation;

  return {
    visitId: input.visitId,
    qualified,
    checks,
    durationMinutes,
    geofenceDistanceMeters: geofence.distanceMeters,
    geofencePassed: geofence.passed,
    disqualificationReason: qualified
      ? null
      : contradictedLocation && !failedRequired
        ? geofence.detail
        : (failedRequired?.detail ?? null),
  };
}

function computeDurationMinutes(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / 60_000);
}

function evaluateGeofence(
  input: VisitQualificationInput,
  rules: QualificationRules,
): { passed: boolean | null; distanceMeters: number | null; detail: string } {
  if (input.visitType !== "PHYSICAL") {
    return {
      passed: null,
      distanceMeters: null,
      detail: "Remote visit; no location check applies.",
    };
  }

  if (!isValidCoordinates(input.agentLocation) || !isValidCoordinates(input.propertyLocation)) {
    return {
      passed: null,
      distanceMeters: null,
      detail: rules.requireGeofenceForPhysical
        ? "No usable location fix was recorded for this physical visit."
        : "No location fix recorded; location check skipped.",
    };
  }

  const distance = distanceMeters(input.agentLocation, input.propertyLocation);
  const accuracy = Math.max(0, input.agentLocation.accuracyMeters ?? 0);
  const passed = distance - accuracy <= rules.geofenceRadiusMeters;

  return {
    passed,
    distanceMeters: Math.round(distance * 100) / 100,
    detail: passed
      ? `Agent checked in ${Math.round(distance)} m from the property, inside the ${rules.geofenceRadiusMeters} m geofence.`
      : `Agent checked in ${Math.round(distance)} m from the property, outside the ${rules.geofenceRadiusMeters} m geofence.`,
  };
}

/* ------------------------------------------------------------------------ *
 * Lead attribution
 * ------------------------------------------------------------------------ */

export type LeadSource =
  | "ORGANIC_WEBSITE"
  | "DIRECT_AGENT_REFERRAL"
  | "AGENT_INVENTORY_SHARE"
  | "ADVERTISEMENT"
  | "SOCIAL_MEDIA"
  | "WHATSAPP"
  | "DIRECT_ENQUIRY"
  | "CUSTOMER_SEARCH"
  | "REQUIREMENT_MATCH"
  | "CALLBACK_REQUEST"
  | "OTHER";

export interface AttributionEvent {
  readonly agentId: string;
  readonly role: "LISTING_AGENT" | "SALES_AGENT" | "REFERRAL_AGENT" | "VISITING_AGENT";
  readonly source: LeadSource;
  readonly occurredAt: string;
}

export interface AttributionSummary {
  readonly listingAgentId: string | null;
  readonly salesAgentId: string | null;
  readonly referralAgentId: string | null;
  readonly visitingAgentIds: readonly string[];
  readonly firstTouch: AttributionEvent | null;
  readonly lastTouch: AttributionEvent | null;
}

/**
 * Project an append-only attribution log into the current role assignment.
 *
 * Rules, chosen so that a dispute has an unambiguous answer:
 *  - the listing agent is whoever FIRST claimed that role (it is a property
 *    fact, not a race);
 *  - the sales agent is whoever MOST RECENTLY holds it (relationships move);
 *  - visiting agents accumulate, in the order they first visited.
 */
export function summariseAttribution(events: readonly AttributionEvent[]): AttributionSummary {
  const ordered = [...events].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );

  let listingAgentId: string | null = null;
  let salesAgentId: string | null = null;
  let referralAgentId: string | null = null;
  const visitingAgentIds: string[] = [];

  for (const event of ordered) {
    switch (event.role) {
      case "LISTING_AGENT":
        listingAgentId ??= event.agentId;
        break;
      case "SALES_AGENT":
        salesAgentId = event.agentId;
        break;
      case "REFERRAL_AGENT":
        referralAgentId ??= event.agentId;
        break;
      case "VISITING_AGENT":
        if (!visitingAgentIds.includes(event.agentId)) visitingAgentIds.push(event.agentId);
        break;
    }
  }

  return {
    listingAgentId,
    salesAgentId,
    referralAgentId,
    visitingAgentIds,
    firstTouch: ordered[0] ?? null,
    lastTouch: ordered[ordered.length - 1] ?? null,
  };
}
