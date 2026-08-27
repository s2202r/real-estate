/**
 * Demand ↔ supply matching.
 *
 * Deterministic, rule-based and fully explainable: the customer sees "92% match"
 * alongside the per-dimension breakdown that produced it. An opaque score would
 * be worthless here — the whole point is that the customer can tell WHY a
 * property was suggested, and correct the requirement if the reason is wrong.
 *
 * `MatchRanker` is the seam for a future ML/LLM re-ranker. It receives the
 * deterministic scores and may reorder them; it can never invent a match that
 * the rules rejected outright.
 */

import { fromMajor, toMajorNumber, type Money } from "./money";
import { distanceKm, isValidCoordinates, type Coordinates } from "./geo";

export type PropertyType = string;
export type ListingType = "SALE" | "RENT" | "LEASE";
export type Facing =
  | "NORTH" | "SOUTH" | "EAST" | "WEST"
  | "NORTH_EAST" | "NORTH_WEST" | "SOUTH_EAST" | "SOUTH_WEST";
export type Furnishing = "UNFURNISHED" | "SEMI_FURNISHED" | "FULLY_FURNISHED";
export type Possession = "READY_TO_MOVE" | "UNDER_CONSTRUCTION" | "NEW_LAUNCH" | "RESALE";

export interface RequirementInput {
  readonly id: string;
  readonly listingType: ListingType;
  readonly propertyTypes: readonly PropertyType[];
  readonly city: string;
  readonly localities: readonly string[];
  readonly budgetMin?: string | null;
  readonly budgetMax: string;
  readonly minArea?: number | null;
  readonly maxArea?: number | null;
  readonly bedroomsMin?: number | null;
  readonly bedroomsMax?: number | null;
  readonly bathroomsMin?: number | null;
  readonly facing?: readonly Facing[];
  readonly furnishing?: readonly Furnishing[];
  readonly possession?: readonly Possession[];
  readonly amenities?: readonly string[];
  readonly coordinates?: Coordinates | null;
  /** How far outside the named localities the customer will still consider. */
  readonly searchRadiusKm?: number;
}

export interface ListingCandidate {
  readonly id: string;
  readonly listingType: ListingType;
  readonly propertyType: PropertyType;
  readonly city: string;
  readonly locality: string;
  readonly price: string;
  readonly builtUpArea?: number | null;
  readonly bedrooms?: number | null;
  readonly bathrooms?: number | null;
  readonly facing?: Facing | null;
  readonly furnishing?: Furnishing | null;
  readonly possessionStatus?: Possession | null;
  readonly amenities?: readonly string[];
  readonly coordinates?: Coordinates | null;
  /** 0–100 platform verification score for the property. */
  readonly verificationScore?: number;
  /** 0–100 trust score of the listing agent. */
  readonly agentTrustScore?: number;
  readonly isVerified: boolean;
}

export type MatchDimension =
  | "budget"
  | "location"
  | "size"
  | "bedrooms"
  | "amenities"
  | "facing"
  | "furnishing"
  | "possession"
  | "verification"
  | "agentQuality";

export type MatchWeights = Record<MatchDimension, number>;

/**
 * Weights sum to 1. Budget and location dominate because, in practice, those
 * are the two dimensions a customer refuses to compromise on.
 */
export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  budget: 0.26,
  location: 0.22,
  size: 0.13,
  bedrooms: 0.13,
  amenities: 0.08,
  facing: 0.05,
  furnishing: 0.04,
  possession: 0.04,
  verification: 0.03,
  agentQuality: 0.02,
};

export interface DimensionScore {
  readonly dimension: MatchDimension;
  /** 0–100. */
  readonly score: number;
  readonly weight: number;
  readonly explanation: string;
}

export interface MatchResult {
  readonly listingId: string;
  readonly requirementId: string;
  /** 0–100, rounded. This is the number shown as "92% Match". */
  readonly score: number;
  readonly breakdown: readonly DimensionScore[];
  /** Hard mismatches. A non-empty list means score 0 and no recommendation. */
  readonly disqualifiers: readonly string[];
  readonly algorithmVersion: string;
}

export const MATCHING_VERSION = "rules-v1";

/** A future ML/LLM re-ranker plugs in here without touching the rules. */
export interface MatchRanker {
  readonly name: string;
  rerank(matches: readonly MatchResult[]): readonly MatchResult[];
}

export function calculateMatch(
  requirement: RequirementInput,
  listing: ListingCandidate,
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
): MatchResult {
  const disqualifiers: string[] = [];

  // Hard filters. A rental is not a near-miss for a purchase.
  if (requirement.listingType !== listing.listingType) {
    disqualifiers.push(
      `Requirement is for ${requirement.listingType.toLowerCase()}, listing is for ${listing.listingType.toLowerCase()}.`,
    );
  }
  if (!listing.isVerified) {
    disqualifiers.push("Listing is not verified.");
  }
  if (
    requirement.propertyTypes.length > 0 &&
    !requirement.propertyTypes.includes(listing.propertyType)
  ) {
    disqualifiers.push(`Property type ${listing.propertyType} is not among the requested types.`);
  }
  if (normalise(requirement.city) !== normalise(listing.city)) {
    disqualifiers.push(`Listing is in ${listing.city}, requirement is for ${requirement.city}.`);
  }

  if (disqualifiers.length > 0) {
    return {
      listingId: listing.id,
      requirementId: requirement.id,
      score: 0,
      breakdown: [],
      disqualifiers,
      algorithmVersion: MATCHING_VERSION,
    };
  }

  const breakdown: DimensionScore[] = [
    scoreBudget(requirement, listing, weights.budget),
    scoreLocation(requirement, listing, weights.location),
    scoreSize(requirement, listing, weights.size),
    scoreBedrooms(requirement, listing, weights.bedrooms),
    scoreAmenities(requirement, listing, weights.amenities),
    scoreEnum("facing", requirement.facing, listing.facing, weights.facing),
    scoreEnum("furnishing", requirement.furnishing, listing.furnishing, weights.furnishing),
    scoreEnum("possession", requirement.possession, listing.possessionStatus, weights.possession),
    scoreVerification(listing, weights.verification),
    scoreAgentQuality(listing, weights.agentQuality),
  ];

  const totalWeight = breakdown.reduce((acc, d) => acc + d.weight, 0);
  const weighted = breakdown.reduce((acc, d) => acc + d.score * d.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round(weighted / totalWeight);

  return {
    listingId: listing.id,
    requirementId: requirement.id,
    score: Math.max(0, Math.min(100, score)),
    breakdown,
    disqualifiers,
    algorithmVersion: MATCHING_VERSION,
  };
}

export function matchListings(
  requirement: RequirementInput,
  listings: readonly ListingCandidate[],
  options: { weights?: MatchWeights; minimumScore?: number; ranker?: MatchRanker } = {},
): MatchResult[] {
  const { weights = DEFAULT_MATCH_WEIGHTS, minimumScore = 40, ranker } = options;

  const matches = listings
    .map((listing) => calculateMatch(requirement, listing, weights))
    .filter((match) => match.disqualifiers.length === 0 && match.score >= minimumScore)
    // Ties break on listing id so paging is stable across requests.
    .sort((a, b) => b.score - a.score || (a.listingId < b.listingId ? -1 : 1));

  return ranker ? [...ranker.rerank(matches)] : matches;
}

/* ------------------------------------------------------------------------ *
 * Dimension scoring
 * ------------------------------------------------------------------------ */

function scoreBudget(
  requirement: RequirementInput,
  listing: ListingCandidate,
  weight: number,
): DimensionScore {
  const price = toMajorNumber(fromMajor(listing.price));
  const maxBudget = toMajorNumber(fromMajor(requirement.budgetMax));
  const minBudget = requirement.budgetMin ? toMajorNumber(fromMajor(requirement.budgetMin)) : 0;

  if (maxBudget <= 0) {
    return dimension("budget", 50, weight, "No budget ceiling specified.");
  }

  if (price <= maxBudget && price >= minBudget) {
    return dimension("budget", 100, weight, `Within budget at ${inr(price)}.`);
  }

  if (price < minBudget) {
    // Cheaper than expected is a mild signal, not a failure: it may simply be
    // a smaller unit, which the size dimension will already have penalised.
    const ratio = minBudget === 0 ? 1 : price / minBudget;
    return dimension(
      "budget",
      Math.round(Math.max(60, ratio * 100)),
      weight,
      `Below the stated minimum budget at ${inr(price)}.`,
    );
  }

  // Over budget: decay steeply. 10% over ≈ 60, 25% over ≈ 0.
  const overshoot = (price - maxBudget) / maxBudget;
  const score = Math.round(Math.max(0, 100 - overshoot * 400));
  return dimension(
    "budget",
    score,
    weight,
    `${Math.round(overshoot * 100)}% above the ${inr(maxBudget)} budget.`,
  );
}

function scoreLocation(
  requirement: RequirementInput,
  listing: ListingCandidate,
  weight: number,
): DimensionScore {
  const wanted = requirement.localities.map(normalise);
  const actual = normalise(listing.locality);

  if (wanted.length === 0) {
    return dimension("location", 85, weight, `In ${listing.city}; no specific locality requested.`);
  }

  if (wanted.includes(actual)) {
    return dimension("location", 100, weight, `In the preferred locality ${listing.locality}.`);
  }

  // Partial name overlap: "Sector 137" vs "Sector 137 Noida".
  if (wanted.some((w) => w.includes(actual) || actual.includes(w))) {
    return dimension("location", 88, weight, `Adjacent to a preferred locality (${listing.locality}).`);
  }

  if (isValidCoordinates(requirement.coordinates) && isValidCoordinates(listing.coordinates)) {
    const radius = requirement.searchRadiusKm ?? 8;
    const distance = distanceKm(requirement.coordinates, listing.coordinates);
    if (distance <= radius) {
      const score = Math.round(90 - (distance / radius) * 40);
      return dimension("location", score, weight, `${distance.toFixed(1)} km from the preferred area.`);
    }
    return dimension("location", 20, weight, `${distance.toFixed(1)} km outside the preferred area.`);
  }

  return dimension("location", 45, weight, `In ${listing.city}, but not a preferred locality.`);
}

function scoreSize(
  requirement: RequirementInput,
  listing: ListingCandidate,
  weight: number,
): DimensionScore {
  const area = listing.builtUpArea ?? null;
  if (area == null) return dimension("size", 60, weight, "Listing does not state an area.");
  if (requirement.minArea == null && requirement.maxArea == null) {
    return dimension("size", 85, weight, "No area preference stated.");
  }

  const min = requirement.minArea ?? 0;
  const max = requirement.maxArea ?? Number.POSITIVE_INFINITY;

  if (area >= min && area <= max) {
    return dimension("size", 100, weight, `${area} sq ft is within the requested range.`);
  }
  if (area < min) {
    const ratio = min === 0 ? 1 : area / min;
    return dimension(
      "size",
      Math.round(Math.max(0, ratio * 100 - 10)),
      weight,
      `${area} sq ft is smaller than the ${min} sq ft minimum.`,
    );
  }
  const overshoot = (area - max) / max;
  return dimension(
    "size",
    Math.round(Math.max(50, 100 - overshoot * 60)),
    weight,
    `${area} sq ft is larger than requested.`,
  );
}

function scoreBedrooms(
  requirement: RequirementInput,
  listing: ListingCandidate,
  weight: number,
): DimensionScore {
  const bedrooms = listing.bedrooms ?? null;
  if (bedrooms == null) return dimension("bedrooms", 60, weight, "Bedroom count not stated.");
  if (requirement.bedroomsMin == null && requirement.bedroomsMax == null) {
    return dimension("bedrooms", 85, weight, "No bedroom preference stated.");
  }

  const min = requirement.bedroomsMin ?? 0;
  const max = requirement.bedroomsMax ?? Number.POSITIVE_INFINITY;

  if (bedrooms >= min && bedrooms <= max) {
    return dimension("bedrooms", 100, weight, `${bedrooms} BHK matches the requirement.`);
  }
  // One bedroom off is a real near-miss; two is usually a different product.
  const distance = bedrooms < min ? min - bedrooms : bedrooms - max;
  const score = distance === 1 ? 55 : distance === 2 ? 20 : 0;
  return dimension(
    "bedrooms",
    score,
    weight,
    `${bedrooms} BHK against a requested ${min}${max === Number.POSITIVE_INFINITY ? "+" : `–${max}`} BHK.`,
  );
}

function scoreAmenities(
  requirement: RequirementInput,
  listing: ListingCandidate,
  weight: number,
): DimensionScore {
  const wanted = requirement.amenities ?? [];
  if (wanted.length === 0) return dimension("amenities", 85, weight, "No amenity preference stated.");

  const available = new Set((listing.amenities ?? []).map(normalise));
  const matched = wanted.filter((a) => available.has(normalise(a)));
  const score = Math.round((matched.length / wanted.length) * 100);

  return dimension(
    "amenities",
    score,
    weight,
    `${matched.length} of ${wanted.length} requested amenities available.`,
  );
}

function scoreEnum<T extends string>(
  name: MatchDimension,
  wanted: readonly T[] | undefined,
  actual: T | null | undefined,
  weight: number,
): DimensionScore {
  if (!wanted || wanted.length === 0) {
    return dimension(name, 85, weight, `No ${name} preference stated.`);
  }
  if (actual == null) {
    return dimension(name, 55, weight, `Listing does not state ${name}.`);
  }
  return wanted.includes(actual)
    ? dimension(name, 100, weight, `${humanise(actual)} matches the ${name} preference.`)
    : dimension(name, 30, weight, `${humanise(actual)} is not a preferred ${name}.`);
}

function scoreVerification(listing: ListingCandidate, weight: number): DimensionScore {
  const score = Math.round(listing.verificationScore ?? 60);
  return dimension("verification", score, weight, `Property verification score ${score}/100.`);
}

function scoreAgentQuality(listing: ListingCandidate, weight: number): DimensionScore {
  const score = Math.round(listing.agentTrustScore ?? 60);
  // Never surfaced verbatim to customers (§13): the API layer strips this
  // dimension's explanation from customer-facing responses.
  return dimension("agentQuality", score, weight, "Listing agent standing on the platform.");
}

/* ------------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------------ */

function dimension(
  name: MatchDimension,
  score: number,
  weight: number,
  explanation: string,
): DimensionScore {
  return {
    dimension: name,
    score: Math.max(0, Math.min(100, Math.round(score))),
    weight,
    explanation,
  };
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Customer-facing label for a score. */
export function matchLabel(score: number): "Excellent" | "Strong" | "Good" | "Partial" {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Good";
  return "Partial";
}

/** Money helper re-exported for callers assembling requirement budgets. */
export function budgetOf(value: string): Money {
  return fromMajor(value);
}
