/**
 * The commission engine.
 *
 * `calculateCommission(input)` is a PURE function: same input, same output,
 * forever. No clock, no randomness, no I/O, no AI. That is what makes a payout
 * defensible three years later when an agent disputes it.
 *
 * Everything configurable lives in `CommissionPolicy`, which is stored as data
 * in `commission_rules.policy` and snapshotted into every calculation. Nothing
 * in this file hard-codes a percentage.
 */

import {
  add,
  allocate,
  clamp,
  compare,
  formatMoney,
  fromMajor,
  isZero,
  money,
  type CurrencyCode,
  type Money,
  percentOf,
  subtract,
  sum,
  toMajorString,
  zero,
} from "./money";

/* ------------------------------------------------------------------------ *
 * Policy
 * ------------------------------------------------------------------------ */

export const PARTICIPANT_ROLES = [
  "LISTING_AGENT",
  "SALES_AGENT",
  "VISIT_POOL",
  "REFERRAL_AGENT",
  "INVESTOR",
  "PLATFORM",
] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

/** The role recorded against an individual distribution row. */
export type DistributionRole =
  | "LISTING_AGENT"
  | "SALES_AGENT"
  | "VISITING_AGENT"
  | "REFERRAL_AGENT"
  | "INVESTOR"
  | "PLATFORM";

export type VisitDistributionModel =
  | "LATEST_WEIGHTED"
  | "WEIGHTED_SCORE"
  | "EQUAL"
  | "CUSTOM";

/**
 * What to do with a role's share when no participant fills that role — for
 * example a deal with no referral agent, or no qualifying visits at all.
 *
 *  PLATFORM     the unfilled share falls to the platform (default)
 *  PRORATA      redistributed across the remaining roles in proportion
 *  SALES_AGENT  redistributed to the sales agent
 */
export type UnallocatedStrategy = "PLATFORM" | "PRORATA" | "SALES_AGENT";

export interface VisitTierShares {
  /** Share of the visit pool for the most recent qualifying visit. */
  readonly latest: number;
  /** Share for the second most recent. */
  readonly previous: number;
  /** Share split across all earlier qualifying visits. */
  readonly earlier: number;
}

export interface ContributionScoreWeights {
  readonly recency: number;
  readonly customerConfirmation: number;
  readonly duration: number;
  readonly outcome: number;
  readonly interest: number;
  readonly negotiation: number;
}

export interface CommissionPolicy {
  /** Percentage of the pool for each role. Need not sum to 100. */
  readonly roleShares: Partial<Record<ParticipantRole, number>>;
  readonly visitModel: VisitDistributionModel;
  readonly visitTiers: VisitTierShares;
  readonly scoreWeights: ContributionScoreWeights;
  readonly unallocatedStrategy: UnallocatedStrategy;
  /** Visit duration (minutes) at which the duration factor saturates. */
  readonly targetVisitMinutes: number;
  /** Optional per-role minimum payouts, as major-unit strings. */
  readonly floors?: Partial<Record<DistributionRole, string>>;
  /** Optional per-role maximum payouts, as major-unit strings. */
  readonly caps?: Partial<Record<DistributionRole, string>>;
  /** Explicit weights per visit rank, used only by the CUSTOM visit model. */
  readonly customVisitWeights?: readonly number[];
}

export const DEFAULT_COMMISSION_POLICY: CommissionPolicy = {
  roleShares: { LISTING_AGENT: 20, SALES_AGENT: 40, VISIT_POOL: 15, PLATFORM: 25 },
  visitModel: "LATEST_WEIGHTED",
  visitTiers: { latest: 50, previous: 25, earlier: 25 },
  scoreWeights: {
    recency: 0.35,
    customerConfirmation: 0.2,
    duration: 0.15,
    outcome: 0.15,
    interest: 0.1,
    negotiation: 0.05,
  },
  unallocatedStrategy: "PLATFORM",
  targetVisitMinutes: 30,
};

/* ------------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------------ */

export interface DealParticipantInput {
  readonly id: string;
  readonly role: ParticipantRole | "VISITING_AGENT";
  readonly agentId?: string | null;
  readonly investorId?: string | null;
  readonly userId?: string | null;
  /** Overrides the policy share for this participant only, as a percentage. */
  readonly overridePercent?: number | null;
  /** Overrides the computed amount entirely, as a major-unit string. */
  readonly overrideAmount?: string | null;
}

export interface QualifiedVisitInput {
  readonly id: string;
  readonly agentId: string;
  /** ISO timestamp of the end of the visit. Ordering key; never `Date.now()`. */
  readonly endedAt: string;
  readonly durationMinutes: number;
  readonly customerConfirmed: boolean;
  readonly outcome:
    | "INTERESTED"
    | "NEEDS_FOLLOW_UP"
    | "NOT_INTERESTED"
    | "PRICE_MISMATCH"
    | "LOCATION_MISMATCH"
    | "PROPERTY_MISMATCH"
    | "NEGOTIATION_STARTED"
    | "NOT_RECORDED";
  /** 1–5 as recorded by the agent and confirmed by the customer. */
  readonly interestLevel?: number | null;
  readonly involvedInNegotiation?: boolean;
}

export interface CommissionInput {
  readonly deal: {
    readonly id: string;
    readonly referenceCode: string;
    /** Final consideration, as a major-unit string (from `numeric`). */
    readonly transactionValue: string;
    /** Explicitly agreed pool. When present it overrides the policy formula. */
    readonly commissionPool?: string | null;
    readonly currency: CurrencyCode;
  };
  readonly policy: CommissionPolicy;
  readonly poolRule?: {
    readonly mode: "PERCENT_OF_TRANSACTION" | "FIXED_AMOUNT";
    readonly percent?: number | null;
    readonly fixedAmount?: string | null;
    readonly minAmount?: string | null;
    readonly maxAmount?: string | null;
    readonly ruleCode?: string;
  };
  readonly participants: readonly DealParticipantInput[];
  /** ONLY qualified visits. Filtering happens upstream, in `attribution.ts`. */
  readonly visits: readonly QualifiedVisitInput[];
}

/* ------------------------------------------------------------------------ *
 * Outputs
 * ------------------------------------------------------------------------ */

export interface ExplanationStep {
  readonly step: "pool" | "role" | "visit" | "adjustment";
  readonly detail: string;
  /** Major-unit string, so the UI renders exactly what was computed. */
  readonly amount: string;
  readonly percent?: number;
}

export interface CommissionDistribution {
  readonly role: DistributionRole;
  readonly participantId?: string | null;
  readonly agentId?: string | null;
  readonly investorId?: string | null;
  readonly userId?: string | null;
  readonly visitId?: string | null;
  readonly tier?: "LATEST" | "PREVIOUS" | "EARLIER" | null;
  readonly contributionScore?: number | null;
  readonly sharePercent?: number | null;
  readonly amount: string;
  readonly amountMinor: number;
  readonly basis: string;
}

export interface CommissionResult {
  readonly dealId: string;
  readonly dealReference: string;
  readonly currency: CurrencyCode;
  readonly transactionValue: string;
  readonly commissionPool: string;
  readonly commissionPoolMinor: number;
  readonly distributions: readonly CommissionDistribution[];
  readonly explanation: readonly ExplanationStep[];
  readonly engineVersion: string;
  readonly policySnapshot: CommissionPolicy;
  readonly warnings: readonly string[];
}

export const ENGINE_VERSION = "commission-v1";

export class CommissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommissionError";
  }
}

/* ------------------------------------------------------------------------ *
 * Engine
 * ------------------------------------------------------------------------ */

export function calculateCommission(input: CommissionInput): CommissionResult {
  const currency = input.deal.currency;
  const explanation: ExplanationStep[] = [];
  const warnings: string[] = [];

  const transactionValue = fromMajor(input.deal.transactionValue, currency);
  if (transactionValue.amountMinor <= 0) {
    throw new CommissionError(
      `Deal ${input.deal.referenceCode} has a non-positive transaction value; commission cannot be calculated.`,
    );
  }

  /* -- Step 1: the pool ---------------------------------------------------- */
  const pool = resolvePool(input, transactionValue, currency, explanation);
  if (isZero(pool)) {
    return {
      dealId: input.deal.id,
      dealReference: input.deal.referenceCode,
      currency,
      transactionValue: toMajorString(transactionValue),
      commissionPool: toMajorString(pool),
      commissionPoolMinor: 0,
      distributions: [],
      explanation,
      engineVersion: ENGINE_VERSION,
      policySnapshot: input.policy,
      warnings: [...warnings, "Commission pool is zero; nothing to distribute."],
    };
  }

  /* -- Step 2: split the pool across roles --------------------------------- */
  const visits = orderVisits(input.visits);
  const roleAmounts = splitAcrossRoles(input, pool, visits, explanation, warnings);

  /* -- Step 3 & 4: expand each role into participant distributions ---------- */
  const distributions: CommissionDistribution[] = [];

  for (const role of PARTICIPANT_ROLES) {
    const amount = roleAmounts.get(role);
    if (!amount || isZero(amount)) continue;

    if (role === "VISIT_POOL") {
      distributions.push(
        ...distributeVisitPool(amount, visits, input.policy, explanation),
      );
      continue;
    }

    const participant = findParticipant(input.participants, role);
    distributions.push({
      role: role as DistributionRole,
      participantId: participant?.id ?? null,
      agentId: participant?.agentId ?? null,
      investorId: participant?.investorId ?? null,
      userId: participant?.userId ?? null,
      sharePercent: input.policy.roleShares[role] ?? null,
      amount: toMajorString(amount),
      amountMinor: amount.amountMinor,
      basis: `${input.policy.roleShares[role] ?? 0}% of commission pool ${toMajorString(pool)}`,
    });
  }

  /* -- Step 5: floors and caps, then rebalance so the total still matches --- */
  const adjusted = applyFloorsAndCaps(distributions, input.policy, pool, currency, explanation, warnings);

  assertSumsToPool(adjusted, pool, input.deal.referenceCode);

  return {
    dealId: input.deal.id,
    dealReference: input.deal.referenceCode,
    currency,
    transactionValue: toMajorString(transactionValue),
    commissionPool: toMajorString(pool),
    commissionPoolMinor: pool.amountMinor,
    distributions: adjusted,
    explanation,
    engineVersion: ENGINE_VERSION,
    policySnapshot: input.policy,
    warnings,
  };
}

/* ------------------------------------------------------------------------ *
 * Step 1 — pool resolution
 * ------------------------------------------------------------------------ */

function resolvePool(
  input: CommissionInput,
  transactionValue: Money,
  currency: CurrencyCode,
  explanation: ExplanationStep[],
): Money {
  // An explicitly agreed pool always wins: the parties negotiated it.
  if (input.deal.commissionPool) {
    const agreed = fromMajor(input.deal.commissionPool, currency);
    explanation.push({
      step: "pool",
      detail: "Commission pool agreed manually for this deal.",
      amount: toMajorString(agreed),
    });
    return agreed;
  }

  const rule = input.poolRule;
  if (!rule) {
    throw new CommissionError(
      `Deal ${input.deal.referenceCode} has neither an agreed commission pool nor a pool rule.`,
    );
  }

  let pool: Money;
  if (rule.mode === "FIXED_AMOUNT") {
    if (!rule.fixedAmount) {
      throw new CommissionError("A FIXED_AMOUNT pool rule requires a fixed amount.");
    }
    pool = fromMajor(rule.fixedAmount, currency);
    explanation.push({
      step: "pool",
      detail: `Fixed commission pool from rule ${rule.ruleCode ?? "(unnamed)"}.`,
      amount: toMajorString(pool),
    });
  } else {
    const percent = rule.percent ?? 0;
    pool = percentOf(transactionValue, percent);
    explanation.push({
      step: "pool",
      detail: `${percent}% of transaction value ${toMajorString(transactionValue)}.`,
      amount: toMajorString(pool),
      percent,
    });
  }

  const floor = rule.minAmount ? fromMajor(rule.minAmount, currency) : null;
  const ceiling = rule.maxAmount ? fromMajor(rule.maxAmount, currency) : null;
  const clamped = clamp(pool, floor, ceiling);

  if (compare(clamped, pool) !== 0) {
    explanation.push({
      step: "pool",
      detail:
        compare(clamped, pool) > 0
          ? `Raised to the minimum pool of ${toMajorString(floor!)}.`
          : `Capped at the maximum pool of ${toMajorString(ceiling!)}.`,
      amount: toMajorString(clamped),
    });
  }

  return clamped;
}

/* ------------------------------------------------------------------------ *
 * Step 2 — role split
 * ------------------------------------------------------------------------ */

function splitAcrossRoles(
  input: CommissionInput,
  pool: Money,
  visits: readonly QualifiedVisitInput[],
  explanation: ExplanationStep[],
  warnings: string[],
): Map<ParticipantRole, Money> {
  const eligible: { role: ParticipantRole; weight: number }[] = [];
  const dropped: { role: ParticipantRole; weight: number }[] = [];

  for (const role of PARTICIPANT_ROLES) {
    const weight = input.policy.roleShares[role] ?? 0;
    if (weight <= 0) continue;

    const filled =
      role === "VISIT_POOL"
        ? visits.length > 0
        : role === "PLATFORM"
          ? true
          : findParticipant(input.participants, role) !== undefined;

    if (filled) eligible.push({ role, weight });
    else dropped.push({ role, weight });
  }

  for (const { role, weight } of dropped) {
    warnings.push(
      `No participant for ${role}; its ${weight}% share was redistributed per the ${input.policy.unallocatedStrategy} strategy.`,
    );
  }

  if (eligible.length === 0) {
    throw new CommissionError(
      `Deal ${input.deal.referenceCode} has no eligible commission participants.`,
    );
  }

  const droppedWeight = dropped.reduce((acc, d) => acc + d.weight, 0);
  const weights = new Map(eligible.map((e) => [e.role, e.weight] as const));

  if (droppedWeight > 0) {
    applyUnallocated(weights, droppedWeight, input.policy.unallocatedStrategy);
  }

  const allocations = allocate(
    pool,
    [...weights.entries()].map(([role, weight]) => ({ key: role, weight })),
  );

  const result = new Map<ParticipantRole, Money>();
  const totalWeight = [...weights.values()].reduce((a, b) => a + b, 0);

  for (const allocation of allocations) {
    const role = allocation.key as ParticipantRole;
    result.set(role, allocation.amount);
    const effectivePercent = totalWeight === 0 ? 0 : (allocation.weight / totalWeight) * 100;
    explanation.push({
      step: "role",
      detail: `${humaniseRole(role)} ${round2(effectivePercent)}% of pool`,
      amount: toMajorString(allocation.amount),
      percent: round2(effectivePercent),
    });
  }

  return result;
}

function applyUnallocated(
  weights: Map<ParticipantRole, number>,
  droppedWeight: number,
  strategy: UnallocatedStrategy,
): void {
  if (strategy === "PLATFORM") {
    weights.set("PLATFORM", (weights.get("PLATFORM") ?? 0) + droppedWeight);
    return;
  }
  if (strategy === "SALES_AGENT" && weights.has("SALES_AGENT")) {
    weights.set("SALES_AGENT", (weights.get("SALES_AGENT") ?? 0) + droppedWeight);
    return;
  }
  // PRORATA — and the fallback when the targeted role is itself absent.
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return;
  for (const [role, weight] of weights) {
    weights.set(role, weight + (droppedWeight * weight) / total);
  }
}

/* ------------------------------------------------------------------------ *
 * Step 3 — visit pool distribution
 * ------------------------------------------------------------------------ */

/** Most recent first. Ties break on visit id so ordering is total and stable. */
function orderVisits(visits: readonly QualifiedVisitInput[]): QualifiedVisitInput[] {
  return [...visits].sort((a, b) => {
    const delta = Date.parse(b.endedAt) - Date.parse(a.endedAt);
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function distributeVisitPool(
  visitPool: Money,
  visits: readonly QualifiedVisitInput[],
  policy: CommissionPolicy,
  explanation: ExplanationStep[],
): CommissionDistribution[] {
  if (visits.length === 0) return [];

  const weights = visitWeights(visits, policy);
  const allocations = allocate(
    visitPool,
    visits.map((visit, index) => ({ key: visit.id, weight: weights[index] ?? 0 })),
  );

  return allocations.map((allocation, index) => {
    const visit = visits[index]!;
    const tier = tierFor(index);
    const score = contributionScore(visit, index, visits.length, policy);

    explanation.push({
      step: "visit",
      detail: `${tierLabel(tier)} (visit ${visit.id.slice(0, 8)}) of visit pool ${toMajorString(visitPool)}`,
      amount: toMajorString(allocation.amount),
    });

    return {
      role: "VISITING_AGENT" as const,
      agentId: visit.agentId,
      visitId: visit.id,
      tier,
      contributionScore: round3(score),
      sharePercent: null,
      amount: toMajorString(allocation.amount),
      amountMinor: allocation.amount.amountMinor,
      basis: `${policy.visitModel} model, ${tierLabel(tier).toLowerCase()}, of visit pool ${toMajorString(visitPool)}`,
    };
  });
}

function visitWeights(
  visits: readonly QualifiedVisitInput[],
  policy: CommissionPolicy,
): number[] {
  switch (policy.visitModel) {
    case "EQUAL":
      return visits.map(() => 1);

    case "WEIGHTED_SCORE":
      return visits.map((visit, index) =>
        contributionScore(visit, index, visits.length, policy),
      );

    case "CUSTOM": {
      const custom = policy.customVisitWeights ?? [];
      // Beyond the supplied weights, fall back to the last one so that no
      // qualifying visit is silently dropped.
      return visits.map((_, index) => custom[index] ?? custom[custom.length - 1] ?? 0);
    }

    case "LATEST_WEIGHTED":
    default: {
      const { latest, previous, earlier } = policy.visitTiers;
      const earlierCount = Math.max(0, visits.length - 2);

      // With fewer than three visits the unused tiers collapse upward, so the
      // pool is never left short and never over-distributed.
      if (visits.length === 1) return [latest + previous + earlier];
      if (visits.length === 2) return [latest + earlier / 2, previous + earlier / 2];

      return visits.map((_, index) => {
        if (index === 0) return latest;
        if (index === 1) return previous;
        return earlier / earlierCount;
      });
    }
  }
}

function tierFor(index: number): "LATEST" | "PREVIOUS" | "EARLIER" {
  if (index === 0) return "LATEST";
  if (index === 1) return "PREVIOUS";
  return "EARLIER";
}

function tierLabel(tier: "LATEST" | "PREVIOUS" | "EARLIER"): string {
  return tier === "LATEST"
    ? "Latest meaningful visit"
    : tier === "PREVIOUS"
      ? "Previous visit"
      : "Earlier qualifying visit";
}

/**
 * Visit contribution score in [0, 1].
 *
 * Deliberately simple, weighted and inspectable — the UI shows this breakdown.
 * An opaque model must never decide money.
 */
export function contributionScore(
  visit: QualifiedVisitInput,
  index: number,
  totalVisits: number,
  policy: CommissionPolicy,
): number {
  const w = policy.scoreWeights;

  // Recency: 1 for the most recent, decaying linearly to 1/totalVisits.
  const recency = totalVisits <= 1 ? 1 : (totalVisits - index) / totalVisits;

  const confirmation = visit.customerConfirmed ? 1 : 0;

  const duration =
    policy.targetVisitMinutes <= 0
      ? 1
      : Math.min(1, Math.max(0, visit.durationMinutes) / policy.targetVisitMinutes);

  const outcome = outcomeScore(visit.outcome);

  const interest =
    visit.interestLevel == null ? 0 : Math.min(1, Math.max(0, visit.interestLevel) / 5);

  const negotiation = visit.involvedInNegotiation ? 1 : 0;

  return (
    recency * w.recency +
    confirmation * w.customerConfirmation +
    duration * w.duration +
    outcome * w.outcome +
    interest * w.interest +
    negotiation * w.negotiation
  );
}

function outcomeScore(outcome: QualifiedVisitInput["outcome"]): number {
  switch (outcome) {
    case "NEGOTIATION_STARTED":
      return 1;
    case "INTERESTED":
      return 0.85;
    case "NEEDS_FOLLOW_UP":
      return 0.5;
    case "PRICE_MISMATCH":
    case "LOCATION_MISMATCH":
    case "PROPERTY_MISMATCH":
      return 0.25;
    case "NOT_INTERESTED":
      return 0.1;
    case "NOT_RECORDED":
    default:
      return 0.2;
  }
}

/* ------------------------------------------------------------------------ *
 * Step 5 — floors, caps and rebalancing
 * ------------------------------------------------------------------------ */

function applyFloorsAndCaps(
  distributions: readonly CommissionDistribution[],
  policy: CommissionPolicy,
  pool: Money,
  currency: CurrencyCode,
  explanation: ExplanationStep[],
  warnings: string[],
): CommissionDistribution[] {
  const floors = policy.floors ?? {};
  const caps = policy.caps ?? {};
  if (Object.keys(floors).length === 0 && Object.keys(caps).length === 0) {
    return [...distributions];
  }

  const adjusted = distributions.map((distribution) => {
    const floor = floors[distribution.role] ? fromMajor(floors[distribution.role]!, currency) : null;
    const cap = caps[distribution.role] ? fromMajor(caps[distribution.role]!, currency) : null;
    const original = money(distribution.amountMinor, currency);
    const bounded = clamp(original, floor, cap);

    if (compare(bounded, original) === 0) return distribution;

    explanation.push({
      step: "adjustment",
      detail: `${humaniseRole(distribution.role)} adjusted from ${toMajorString(original)} by policy ${
        compare(bounded, original) > 0 ? "floor" : "cap"
      }.`,
      amount: toMajorString(bounded),
    });

    return { ...distribution, amount: toMajorString(bounded), amountMinor: bounded.amountMinor };
  });

  // Floors and caps break the exact-sum invariant, so re-settle the residual
  // against the platform share, which is the only participant that can absorb
  // it without changing an agent's contractual entitlement.
  const total = sum(adjusted.map((d) => money(d.amountMinor, currency)), currency);
  const residual = subtract(pool, total);
  if (isZero(residual)) return adjusted;

  const platformIndex = adjusted.findIndex((d) => d.role === "PLATFORM");
  if (platformIndex === -1) {
    warnings.push(
      `Floors/caps left a residual of ${toMajorString(residual)} that could not be settled: this deal has no platform participant.`,
    );
    return adjusted;
  }

  const platform = adjusted[platformIndex]!;
  const settled = add(money(platform.amountMinor, currency), residual);
  explanation.push({
    step: "adjustment",
    detail: "Residual from floors/caps settled against the platform share.",
    amount: toMajorString(settled),
  });

  const result = [...adjusted];
  result[platformIndex] = {
    ...platform,
    amount: toMajorString(settled),
    amountMinor: settled.amountMinor,
  };
  return result;
}

/**
 * The engine's contract with itself. If this ever throws, a bug would have
 * created or destroyed money — so it fails loudly rather than paying out.
 */
function assertSumsToPool(
  distributions: readonly CommissionDistribution[],
  pool: Money,
  reference: string,
): void {
  const total = distributions.reduce((acc, d) => acc + d.amountMinor, 0);
  if (total !== pool.amountMinor) {
    throw new CommissionError(
      `Commission distribution for ${reference} sums to ${total} minor units but the pool is ${pool.amountMinor}. Refusing to persist an unbalanced calculation.`,
    );
  }
}

/* ------------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------------ */

function findParticipant(
  participants: readonly DealParticipantInput[],
  role: ParticipantRole,
): DealParticipantInput | undefined {
  return participants.find((p) => p.role === role);
}

export function humaniseRole(role: string): string {
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Human-readable summary, used in notifications and audit entries. */
export function summariseCommission(result: CommissionResult): string {
  const lines = [
    `Deal: ${result.dealReference}`,
    `Transaction Value: ${formatMoney(fromMajor(result.transactionValue, result.currency))}`,
    `Commission Pool: ${formatMoney(fromMajor(result.commissionPool, result.currency))}`,
    "",
  ];
  for (const distribution of result.distributions) {
    const label = distribution.tier
      ? `  ${tierLabel(distribution.tier)}`
      : humaniseRole(distribution.role);
    lines.push(
      `${label}: ${formatMoney(fromMajor(distribution.amount, result.currency))}`,
    );
  }
  return lines.join("\n");
}

/** Total payable to one agent across a calculation. */
export function totalForAgent(result: CommissionResult, agentId: string): Money {
  return result.distributions
    .filter((d) => d.agentId === agentId)
    .reduce<Money>((acc, d) => add(acc, money(d.amountMinor, result.currency)), zero(result.currency));
}
