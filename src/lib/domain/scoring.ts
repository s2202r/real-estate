/**
 * Derived scores: location quality, agent trust and price intelligence.
 *
 * All three are deterministic and explainable. None of them is allowed to
 * produce a rupee valuation or a legal claim — see docs/LEGAL_REVIEW.md L7.
 */

import { fromMajor, toMajorNumber } from "./money";

/* ------------------------------------------------------------------------ *
 * Location score
 * ------------------------------------------------------------------------ */

export type NearbyPlaceType =
  | "METRO" | "BUS_STOP" | "RAILWAY_STATION" | "AIRPORT" | "SCHOOL" | "COLLEGE"
  | "HOSPITAL" | "MALL" | "MARKET" | "HIGHWAY" | "OFFICE_HUB" | "RESTAURANT"
  | "PARK" | "BANK" | "ATM" | "GYM" | "PLACE_OF_WORSHIP" | "OTHER";

export interface NearbyPlace {
  readonly placeType: NearbyPlaceType;
  readonly name: string;
  readonly distanceKm: number;
}

interface LocationFactor {
  readonly key: string;
  readonly label: string;
  readonly types: readonly NearbyPlaceType[];
  readonly weight: number;
  /** Distance (km) at or below which this factor scores full marks. */
  readonly idealKm: number;
  /** Distance (km) beyond which this factor scores zero. */
  readonly maxKm: number;
}

const LOCATION_FACTORS: readonly LocationFactor[] = [
  { key: "transit",    label: "Public transport", types: ["METRO", "RAILWAY_STATION", "BUS_STOP"], weight: 0.24, idealKm: 1,  maxKm: 6 },
  { key: "education",  label: "Schools",          types: ["SCHOOL", "COLLEGE"],                    weight: 0.18, idealKm: 1.5, maxKm: 7 },
  { key: "healthcare", label: "Hospitals",        types: ["HOSPITAL"],                             weight: 0.16, idealKm: 2,  maxKm: 10 },
  { key: "shopping",   label: "Shopping",         types: ["MALL", "MARKET"],                       weight: 0.14, idealKm: 2,  maxKm: 8 },
  { key: "employment", label: "Employment hubs",  types: ["OFFICE_HUB"],                           weight: 0.14, idealKm: 4,  maxKm: 18 },
  { key: "roads",      label: "Road access",      types: ["HIGHWAY"],                              weight: 0.08, idealKm: 3,  maxKm: 12 },
  { key: "airport",    label: "Airport",          types: ["AIRPORT"],                              weight: 0.06, idealKm: 15, maxKm: 60 },
];

export interface LocationFactorScore {
  readonly key: string;
  readonly label: string;
  readonly score: number;
  readonly nearest: { name: string; distanceKm: number } | null;
}

export interface LocationScore {
  /** 0–100. */
  readonly score: number;
  readonly grade: "Excellent" | "Very good" | "Good" | "Average" | "Limited";
  readonly factors: readonly LocationFactorScore[];
  /** How much of the weighting we had data for. Low coverage = low confidence. */
  readonly coverage: number;
}

export function calculateLocationScore(places: readonly NearbyPlace[]): LocationScore {
  const factors: LocationFactorScore[] = [];
  let weighted = 0;
  let coveredWeight = 0;

  for (const factor of LOCATION_FACTORS) {
    const candidates = places.filter((p) => factor.types.includes(p.placeType));
    const nearest = candidates.reduce<NearbyPlace | null>(
      (best, place) => (best === null || place.distanceKm < best.distanceKm ? place : best),
      null,
    );

    if (!nearest) {
      factors.push({ key: factor.key, label: factor.label, score: 0, nearest: null });
      continue;
    }

    const score = proximityScore(nearest.distanceKm, factor.idealKm, factor.maxKm);
    weighted += score * factor.weight;
    coveredWeight += factor.weight;
    factors.push({
      key: factor.key,
      label: factor.label,
      score,
      nearest: { name: nearest.name, distanceKm: nearest.distanceKm },
    });
  }

  // Score against the weight we actually had data for, so a property with only
  // transit data is not punished as though it had no transit.
  const score = coveredWeight === 0 ? 0 : Math.round(weighted / coveredWeight);

  return {
    score,
    grade: locationGrade(score),
    factors,
    coverage: Math.round(coveredWeight * 100) / 100,
  };
}

function proximityScore(distanceKm: number, idealKm: number, maxKm: number): number {
  if (distanceKm <= idealKm) return 100;
  if (distanceKm >= maxKm) return 0;
  return Math.round(100 * (1 - (distanceKm - idealKm) / (maxKm - idealKm)));
}

function locationGrade(score: number): LocationScore["grade"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Very good";
  if (score >= 55) return "Good";
  if (score >= 35) return "Average";
  return "Limited";
}

/* ------------------------------------------------------------------------ *
 * Agent trust score
 * ------------------------------------------------------------------------ */

export interface AgentPerformanceInput {
  readonly closedDealCount: number;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly responseRate: number;
  readonly visitCompletionRate: number;
  readonly cancellationRate: number;
  readonly complaintCount: number;
  readonly listingAccuracyRate: number;
  readonly monthsOnPlatform: number;
  readonly isIdentityVerified: boolean;
  readonly isReraVerified: boolean;
}

export interface TrustScoreResult {
  readonly score: number;
  readonly components: readonly { key: string; label: string; score: number; weight: number }[];
  readonly eligibleForTrustedBadge: boolean;
  readonly eligibleForTopPerformerBadge: boolean;
}

/**
 * Platform trust score.
 *
 * Computed by the platform from observed behaviour — never self-reported, and
 * never writable by an agent (enforced by a database trigger, not just here).
 */
export function calculateTrustScore(input: AgentPerformanceInput): TrustScoreResult {
  const components = [
    {
      key: "ratings",
      label: "Customer ratings",
      // A 4.8 from 3 customers is weaker evidence than a 4.5 from 60; shrink
      // towards the mean until enough reviews exist.
      score: bayesianRating(input.ratingAverage, input.ratingCount),
      weight: 0.24,
    },
    { key: "responsiveness", label: "Response rate", score: clamp01(input.responseRate / 100) * 100, weight: 0.18 },
    { key: "visits", label: "Visit completion", score: clamp01(input.visitCompletionRate / 100) * 100, weight: 0.16 },
    { key: "accuracy", label: "Listing accuracy", score: clamp01(input.listingAccuracyRate / 100) * 100, weight: 0.14 },
    { key: "transactions", label: "Closed transactions", score: saturating(input.closedDealCount, 20), weight: 0.12 },
    { key: "reliability", label: "Reliability", score: Math.max(0, 100 - input.cancellationRate * 2.5), weight: 0.08 },
    { key: "tenure", label: "Platform history", score: saturating(input.monthsOnPlatform, 24), weight: 0.05 },
    {
      key: "verification",
      label: "Verification",
      score: (input.isIdentityVerified ? 50 : 0) + (input.isReraVerified ? 50 : 0),
      weight: 0.03,
    },
  ];

  const base = components.reduce((acc, c) => acc + c.score * c.weight, 0);

  // Complaints are a hard penalty, not a soft weight: they are the signal a
  // customer most needs reflected.
  const penalty = Math.min(30, input.complaintCount * 6);
  const score = Math.round(Math.max(0, Math.min(100, base - penalty)));

  return {
    score,
    components: components.map((c) => ({ ...c, score: Math.round(c.score) })),
    eligibleForTrustedBadge:
      score >= 70 &&
      input.isIdentityVerified &&
      input.closedDealCount >= 3 &&
      input.complaintCount === 0,
    eligibleForTopPerformerBadge:
      score >= 85 &&
      input.closedDealCount >= 10 &&
      input.ratingAverage >= 4.5 &&
      input.ratingCount >= 10,
  };
}

/** Shrink a small-sample rating towards the platform mean (m ratings of 3.8). */
function bayesianRating(average: number, count: number, priorWeight = 8, priorMean = 3.8): number {
  const safeCount = Math.max(0, count);
  const adjusted = (average * safeCount + priorMean * priorWeight) / (safeCount + priorWeight);
  return clamp01(adjusted / 5) * 100;
}

function saturating(value: number, target: number): number {
  if (target <= 0) return 100;
  return clamp01(Math.max(0, value) / target) * 100;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/* ------------------------------------------------------------------------ *
 * Price intelligence
 * ------------------------------------------------------------------------ */

export type PriceVerdict = "BELOW_MARKET" | "FAIR_PRICE" | "ABOVE_MARKET" | "INSUFFICIENT_DATA";

export interface PriceIntelligenceResult {
  readonly verdict: PriceVerdict;
  readonly label: string;
  readonly pricePerSqft: number | null;
  readonly medianPricePerSqft: number | null;
  readonly deltaPercent: number | null;
  readonly sampleSize: number;
  /** Mandatory. Rendered wherever the verdict is displayed. */
  readonly disclaimer: string;
}

const PRICE_DISCLAIMER =
  "Indicative comparison against similar listings on this platform. It is not a valuation, " +
  "not a professional opinion of value, and must not be relied on for a transaction decision.";

/** Minimum comparable listings before any verdict is offered at all. */
const MINIMUM_SAMPLE = 5;

export function calculatePriceIntelligence(
  listingPrice: string,
  areaSqft: number | null | undefined,
  comparablePricesPerSqft: readonly number[],
): PriceIntelligenceResult {
  const usable = comparablePricesPerSqft.filter((p) => Number.isFinite(p) && p > 0);

  if (!areaSqft || areaSqft <= 0 || usable.length < MINIMUM_SAMPLE) {
    return {
      verdict: "INSUFFICIENT_DATA",
      label: "Not enough comparable listings",
      pricePerSqft: null,
      medianPricePerSqft: null,
      deltaPercent: null,
      sampleSize: usable.length,
      disclaimer: PRICE_DISCLAIMER,
    };
  }

  const perSqft = toMajorNumber(fromMajor(listingPrice)) / areaSqft;
  const median = medianOf(usable);
  const deltaPercent = Math.round(((perSqft - median) / median) * 1000) / 10;

  // A generous fair band: property is heterogeneous, and a confident-sounding
  // verdict on a 6% difference would be misleading.
  const verdict: PriceVerdict =
    deltaPercent <= -12 ? "BELOW_MARKET" : deltaPercent >= 12 ? "ABOVE_MARKET" : "FAIR_PRICE";

  return {
    verdict,
    label:
      verdict === "BELOW_MARKET"
        ? "Below comparable listings"
        : verdict === "ABOVE_MARKET"
          ? "Above comparable listings"
          : "In line with comparable listings",
    pricePerSqft: Math.round(perSqft),
    medianPricePerSqft: Math.round(median),
    deltaPercent,
    sampleSize: usable.length,
    disclaimer: PRICE_DISCLAIMER,
  };
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/* ------------------------------------------------------------------------ *
 * Listing completeness — drives the property verification score
 * ------------------------------------------------------------------------ */

export interface ListingCompletenessInput {
  readonly hasImages: number;
  readonly hasFloorPlan: boolean;
  readonly hasVideoOrTour: boolean;
  readonly hasDescription: boolean;
  readonly hasAmenities: boolean;
  readonly hasNearbyPlaces: boolean;
  readonly hasCoordinates: boolean;
  readonly hasReraNumber: boolean;
  readonly hasDocuments: boolean;
  readonly hasCarpetArea: boolean;
}

export interface CompletenessResult {
  readonly score: number;
  readonly missing: readonly string[];
}

export function calculateListingCompleteness(
  input: ListingCompletenessInput,
): CompletenessResult {
  const checks: { label: string; passed: boolean; points: number }[] = [
    { label: "At least 5 photographs", passed: input.hasImages >= 5, points: 20 },
    { label: "At least 1 photograph", passed: input.hasImages >= 1, points: 10 },
    { label: "Description", passed: input.hasDescription, points: 10 },
    { label: "Map coordinates", passed: input.hasCoordinates, points: 12 },
    { label: "Carpet area", passed: input.hasCarpetArea, points: 8 },
    { label: "Amenities", passed: input.hasAmenities, points: 8 },
    { label: "Nearby landmarks", passed: input.hasNearbyPlaces, points: 8 },
    { label: "Floor plan", passed: input.hasFloorPlan, points: 8 },
    { label: "Video or virtual tour", passed: input.hasVideoOrTour, points: 6 },
    { label: "RERA number", passed: input.hasReraNumber, points: 5 },
    { label: "Supporting documents", passed: input.hasDocuments, points: 5 },
  ];

  const score = checks.reduce((acc, check) => acc + (check.passed ? check.points : 0), 0);

  return {
    score: Math.min(100, score),
    missing: checks.filter((c) => !c.passed).map((c) => c.label),
  };
}
