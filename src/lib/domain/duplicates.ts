/**
 * Duplicate property detection.
 *
 * The Property Passport only works if one physical property maps to one row.
 * Duplicates fragment price history, split visit attribution and let two agents
 * claim the same unit — so detection matters. Auto-MERGING, however, would be
 * far worse than a duplicate: merging two genuinely distinct flats destroys
 * history and can misattribute a commission.
 *
 * Therefore this module only ever produces a CONFIDENCE and a set of SIGNALS.
 * A human adjudicates.
 */

import { distanceMeters, isValidCoordinates, type Coordinates } from "./geo";

export interface DuplicateCandidateInput {
  readonly id: string;
  readonly projectId?: string | null;
  readonly tower?: string | null;
  readonly unitNumber?: string | null;
  readonly floor?: number | null;
  readonly builtUpArea?: number | null;
  readonly bedrooms?: number | null;
  readonly coordinates?: Coordinates | null;
  readonly address?: string | null;
  readonly price?: number | null;
  readonly imageHashes?: readonly string[];
}

export interface DuplicateSignal {
  readonly key: string;
  readonly label: string;
  /** Contribution to confidence, 0–100 before weighting. */
  readonly score: number;
  readonly weight: number;
  readonly detail: string;
}

export interface DuplicateAssessment {
  readonly confidence: number;
  readonly signals: readonly DuplicateSignal[];
  /** True once confidence crosses the review threshold. Never an auto-merge. */
  readonly requiresReview: boolean;
  readonly verdict: "LIKELY_DUPLICATE" | "POSSIBLE_DUPLICATE" | "UNLIKELY";
}

export const DUPLICATE_REVIEW_THRESHOLD = 75;

export function assessDuplicate(
  a: DuplicateCandidateInput,
  b: DuplicateCandidateInput,
): DuplicateAssessment {
  const signals: DuplicateSignal[] = [];

  /* -- The decisive signal: the same unit in the same tower ---------------- */
  const sameProject = Boolean(a.projectId && b.projectId && a.projectId === b.projectId);
  const sameTower = normaliseOrNull(a.tower) === normaliseOrNull(b.tower) && a.tower != null;
  const sameUnit = normaliseOrNull(a.unitNumber) === normaliseOrNull(b.unitNumber) && a.unitNumber != null;

  if (sameProject && sameUnit) {
    signals.push({
      key: "unitIdentity",
      label: "Unit identity",
      score: sameTower ? 100 : 85,
      weight: 0.4,
      detail: sameTower
        ? "Same project, tower and unit number."
        : "Same project and unit number, tower not confirmed.",
    });
  } else {
    signals.push({
      key: "unitIdentity",
      label: "Unit identity",
      score: 0,
      weight: 0.4,
      detail: sameProject ? "Same project but a different unit number." : "Different or unknown project.",
    });
  }

  /* -- Physical proximity -------------------------------------------------- */
  if (isValidCoordinates(a.coordinates) && isValidCoordinates(b.coordinates)) {
    const distance = distanceMeters(a.coordinates, b.coordinates);
    const score = distance <= 25 ? 100 : distance <= 100 ? 70 : distance <= 300 ? 35 : 0;
    signals.push({
      key: "proximity",
      label: "Location",
      score,
      weight: 0.18,
      detail: `${Math.round(distance)} m apart.`,
    });
  } else {
    signals.push({
      key: "proximity",
      label: "Location",
      score: 0,
      weight: 0.18,
      detail: "Coordinates unavailable for one or both properties.",
    });
  }

  /* -- Physical attributes ------------------------------------------------- */
  signals.push(areaSignal(a.builtUpArea, b.builtUpArea));
  signals.push(scalarSignal("floor", "Floor", a.floor, b.floor, 0.07));
  signals.push(scalarSignal("bedrooms", "Bedrooms", a.bedrooms, b.bedrooms, 0.07));

  /* -- Duplicated imagery: strong, because photos are rarely coincidental -- */
  const sharedImages = countShared(a.imageHashes ?? [], b.imageHashes ?? []);
  signals.push({
    key: "images",
    label: "Photographs",
    score: sharedImages > 0 ? 100 : 0,
    weight: 0.12,
    detail:
      sharedImages > 0
        ? `${sharedImages} identical photograph${sharedImages === 1 ? "" : "s"}.`
        : "No identical photographs detected.",
  });

  /* -- Price similarity ---------------------------------------------------- */
  signals.push(priceSignal(a.price, b.price));

  const totalWeight = signals.reduce((acc, s) => acc + s.weight, 0);
  const confidence =
    totalWeight === 0
      ? 0
      : Math.round(signals.reduce((acc, s) => acc + s.score * s.weight, 0) / totalWeight);

  return {
    confidence,
    signals,
    requiresReview: confidence >= DUPLICATE_REVIEW_THRESHOLD,
    verdict:
      confidence >= DUPLICATE_REVIEW_THRESHOLD
        ? "LIKELY_DUPLICATE"
        : confidence >= 45
          ? "POSSIBLE_DUPLICATE"
          : "UNLIKELY",
  };
}

function areaSignal(a: number | null | undefined, b: number | null | undefined): DuplicateSignal {
  if (a == null || b == null || a <= 0 || b <= 0) {
    return { key: "area", label: "Area", score: 0, weight: 0.1, detail: "Area unavailable." };
  }
  const delta = Math.abs(a - b) / Math.max(a, b);
  const score = delta <= 0.01 ? 100 : delta <= 0.05 ? 70 : delta <= 0.1 ? 35 : 0;
  return {
    key: "area",
    label: "Area",
    score,
    weight: 0.1,
    detail: `${a} vs ${b} sq ft (${Math.round(delta * 1000) / 10}% apart).`,
  };
}

function scalarSignal(
  key: string,
  label: string,
  a: number | null | undefined,
  b: number | null | undefined,
  weight: number,
): DuplicateSignal {
  if (a == null || b == null) {
    return { key, label, score: 0, weight, detail: `${label} unavailable.` };
  }
  return {
    key,
    label,
    score: a === b ? 100 : 0,
    weight,
    detail: a === b ? `Both ${a}.` : `${a} vs ${b}.`,
  };
}

function priceSignal(a: number | null | undefined, b: number | null | undefined): DuplicateSignal {
  if (a == null || b == null || a <= 0 || b <= 0) {
    return { key: "price", label: "Price", score: 0, weight: 0.06, detail: "Price unavailable." };
  }
  const delta = Math.abs(a - b) / Math.max(a, b);
  // Two agents listing the same flat often quote slightly different prices, so
  // a small gap is still evidence of duplication.
  const score = delta <= 0.02 ? 100 : delta <= 0.08 ? 65 : delta <= 0.15 ? 30 : 0;
  return {
    key: "price",
    label: "Price",
    score,
    weight: 0.06,
    detail: `${Math.round(delta * 1000) / 10}% apart.`,
  };
}

function countShared(a: readonly string[], b: readonly string[]): number {
  const set = new Set(a);
  return b.filter((hash) => set.has(hash)).length;
}

function normaliseOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, "");
  return trimmed === "" ? null : trimmed;
}

/**
 * A stable fingerprint used to shortlist candidates cheaply in SQL before the
 * full assessment runs. Deliberately coarse: it is a bucket, not an identity.
 */
export function propertyFingerprint(input: {
  city: string;
  locality: string;
  projectName?: string | null;
  tower?: string | null;
  unitNumber?: string | null;
  bedrooms?: number | null;
  builtUpArea?: number | null;
}): string {
  const parts = [
    normalise(input.city),
    normalise(input.locality),
    normalise(input.projectName ?? ""),
    normaliseOrNull(input.tower) ?? "",
    normaliseOrNull(input.unitNumber) ?? "",
    input.bedrooms == null ? "" : String(input.bedrooms),
    // Bucket the area to 25 sq ft so small measurement differences still collide.
    input.builtUpArea == null ? "" : String(Math.round(input.builtUpArea / 25) * 25),
  ];
  return parts.join("|");
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
