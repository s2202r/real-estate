import "server-only";

import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  calculateCommission,
  DEFAULT_COMMISSION_POLICY,
  type CommissionInput,
  type CommissionPolicy,
  type CommissionResult,
  type DealParticipantInput,
  type ParticipantRole,
  type QualifiedVisitInput,
} from "@/lib/domain/commission";
import { CommissionPolicySchema } from "@/lib/validation/commission";
import { recordAudit } from "./audit";
import { notify } from "./notifications";
import { formatMoney, fromMajor } from "@/lib/domain/money";

/**
 * Commission service — the bridge between the database and the pure engine.
 *
 * Its whole job is to gather inputs, hand them to `calculateCommission`, and
 * persist the result. It contains NO commission arithmetic: percentages,
 * splitting and rounding all live in lib/domain/commission.ts, which is pure
 * and unit-tested.
 *
 * Persistence runs through the service-role client because writing a
 * calculation touches several tables that an agent must not be able to write
 * directly. Callers MUST have checked the `commission.calculate` capability
 * first.
 */

export class CommissionServiceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CommissionServiceError";
    this.status = status;
  }
}

/** Load the applicable commission rule for a deal, most specific first. */
export async function resolveCommissionRule(deal: {
  listing_type: string;
  city?: string | null;
  final_price?: string | null;
}) {
  const admin = createAdminClient();

  const { data: rules } = await admin
    .from("commission_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("effective_from", { ascending: false });

  if (!rules || rules.length === 0) return null;

  const now = new Date();
  const transactionValue = deal.final_price ? Number(deal.final_price) : null;

  const applicable = rules.filter((rule) => {
    if (rule.effective_from && new Date(rule.effective_from) > now) return false;
    if (rule.effective_until && new Date(rule.effective_until) < now) return false;
    if (rule.listing_type && rule.listing_type !== deal.listing_type) return false;
    if (rule.city && deal.city && rule.city !== deal.city) return false;
    if (transactionValue !== null) {
      if (rule.min_transaction_value && transactionValue < Number(rule.min_transaction_value)) return false;
      if (rule.max_transaction_value && transactionValue > Number(rule.max_transaction_value)) return false;
    }
    return true;
  });

  // Prefer the most specific rule: one scoped to a city beats a global default.
  const scored = applicable
    .map((rule) => ({
      rule,
      specificity: (rule.city ? 2 : 0) + (rule.listing_type ? 1 : 0),
    }))
    .sort((a, b) => b.specificity - a.specificity || a.rule.priority - b.rule.priority);

  return scored[0]?.rule ?? null;
}

export interface CalculateAndPersistInput {
  readonly dealId: string;
  readonly actorId: string;
  /** When false, the calculation is returned but nothing is written. */
  readonly persist?: boolean;
}

export interface CalculationOutcome {
  readonly result: CommissionResult;
  readonly calculationId: string | null;
  readonly persisted: boolean;
}

export async function calculateDealCommission(
  input: CalculateAndPersistInput,
): Promise<CalculationOutcome> {
  if (!isAdminClientAvailable()) {
    throw new CommissionServiceError("Commission calculation is unavailable in this environment.", 503);
  }

  const admin = createAdminClient();

  /* -- Gather the deal ----------------------------------------------------- */
  const { data: deal } = await admin
    .from("deals")
    .select("*, listings(city)")
    .eq("id", input.dealId)
    .maybeSingle();

  if (!deal) throw new CommissionServiceError("Deal not found.", 404);

  const transactionValue = deal.final_price ?? deal.negotiated_price ?? deal.asking_price;
  if (!transactionValue) {
    throw new CommissionServiceError(
      "This deal has no agreed price yet, so commission cannot be calculated.",
    );
  }

  /* -- Participants -------------------------------------------------------- */
  const { data: participantRows } = await admin
    .from("deal_participants")
    .select("*")
    .eq("deal_id", input.dealId);

  const participants: DealParticipantInput[] = (participantRows ?? []).map((row) => ({
    id: row.id,
    role: row.role as ParticipantRole | "VISITING_AGENT",
    agentId: row.agent_id,
    investorId: row.investor_id,
    userId: row.user_id,
    overridePercent: row.override_percent ? Number(row.override_percent) : null,
    overrideAmount: row.override_amount,
  }));

  /* -- Qualified visits ---------------------------------------------------- */
  // ONLY qualified visits reach the engine. Qualification is decided by
  // lib/domain/attribution.ts and stored on the visit; this is the point at
  // which that decision turns into money.
  const { data: visitRows } = await admin
    .from("visits")
    .select("id, assigned_agent_id, ended_at, duration_minutes, customer_confirmed_at, otp_verified_at, outcome, interest_level")
    .eq("property_id", deal.property_id)
    .eq("customer_id", deal.customer_id)
    .eq("is_qualified", true)
    .not("assigned_agent_id", "is", null)
    .order("ended_at", { ascending: false });

  const visits: QualifiedVisitInput[] = (visitRows ?? [])
    .filter((row) => row.ended_at && row.assigned_agent_id)
    .map((row) => ({
      id: row.id,
      agentId: row.assigned_agent_id!,
      endedAt: row.ended_at!,
      durationMinutes: row.duration_minutes ?? 0,
      customerConfirmed: Boolean(row.customer_confirmed_at || row.otp_verified_at),
      outcome: (row.outcome ?? "NOT_RECORDED") as QualifiedVisitInput["outcome"],
      interestLevel: row.interest_level,
      involvedInNegotiation: row.outcome === "NEGOTIATION_STARTED",
    }));

  /* -- Policy -------------------------------------------------------------- */
  const listingCity = (deal.listings as { city?: string } | null)?.city ?? null;
  const rule = await resolveCommissionRule({
    listing_type: deal.listing_type,
    city: listingCity,
    final_price: transactionValue,
  });

  const policy = parsePolicy(rule?.policy);

  const engineInput: CommissionInput = {
    deal: {
      id: deal.id,
      referenceCode: deal.reference_code,
      transactionValue,
      commissionPool: deal.commission_pool,
      currency: (deal.currency ?? "INR") as CommissionInput["deal"]["currency"],
    },
    policy,
    poolRule: rule
      ? {
          mode: rule.pool_mode,
          percent: rule.pool_percent ? Number(rule.pool_percent) : null,
          fixedAmount: rule.pool_fixed_amount,
          minAmount: rule.min_pool_amount,
          maxAmount: rule.max_pool_amount,
          ruleCode: `${rule.code} v${rule.version}`,
        }
      : undefined,
    participants,
    visits,
  };

  /* -- The pure engine ----------------------------------------------------- */
  const result = calculateCommission(engineInput);

  if (input.persist === false) {
    return { result, calculationId: null, persisted: false };
  }

  /* -- Persist ------------------------------------------------------------- */
  const { data: previous } = await admin
    .from("commission_calculations")
    .select("version")
    .eq("deal_id", deal.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (previous?.version ?? 0) + 1;

  const { data: calculation, error: calcError } = await admin
    .from("commission_calculations")
    .insert({
      deal_id: deal.id,
      rule_id: rule?.id ?? null,
      version,
      transaction_value: result.transactionValue,
      commission_pool: result.commissionPool,
      currency: result.currency,
      // Snapshotting the policy is what stops a future rule edit rewriting
      // this payout.
      policy_snapshot: result.policySnapshot as never,
      explanation: result.explanation as never,
      engine_version: result.engineVersion,
      status: "CALCULATED",
      is_current: true,
      calculated_by: input.actorId,
    })
    .select("id")
    .single();

  if (calcError || !calculation) {
    throw new CommissionServiceError(`Could not store the calculation: ${calcError?.message}`, 500);
  }

  const distributionRows = result.distributions.map((distribution) => ({
    calculation_id: calculation.id,
    deal_id: deal.id,
    participant_id: distribution.participantId ?? null,
    role: distribution.role,
    agent_id: distribution.agentId ?? null,
    investor_id: distribution.investorId ?? null,
    user_id: distribution.userId ?? null,
    visit_id: distribution.visitId ?? null,
    // numeric columns cross the wire as strings; see types/database.ts.
    share_percent: distribution.sharePercent === null || distribution.sharePercent === undefined
      ? null
      : String(distribution.sharePercent),
    amount: distribution.amount,
    amount_minor: distribution.amountMinor,
    currency: result.currency,
    tier: distribution.tier ?? null,
    contribution_score:
      distribution.contributionScore === null || distribution.contributionScore === undefined
        ? null
        : String(distribution.contributionScore),
    calculation_basis: { basis: distribution.basis } as never,
  }));

  const { data: insertedDistributions, error: distError } = await admin
    .from("commission_distributions")
    .insert(distributionRows)
    .select("id, role, agent_id, investor_id, user_id, amount, amount_minor");

  if (distError) {
    throw new CommissionServiceError(`Could not store distributions: ${distError.message}`, 500);
  }

  /* -- Ledger -------------------------------------------------------------- */
  // Superseding a previous calculation means reversing what it recorded, never
  // editing it (§23).
  if (version > 1) {
    await reversePreviousLedger(deal.id, input.actorId);
  }

  const agentUserIds = await resolveAgentUserIds(
    (insertedDistributions ?? []).map((d) => d.agent_id).filter((id): id is string => Boolean(id)),
  );

  const ledgerRows = (insertedDistributions ?? []).map((distribution) => ({
    deal_id: deal.id,
    calculation_id: calculation.id,
    distribution_id: distribution.id,
    user_id: distribution.agent_id ? (agentUserIds.get(distribution.agent_id) ?? null) : distribution.user_id,
    agent_id: distribution.agent_id,
    investor_id: distribution.investor_id,
    role: distribution.role,
    entry_type: "EARNING" as const,
    amount: distribution.amount,
    amount_minor: distribution.amount_minor,
    currency: result.currency,
    status: "CALCULATED" as const,
    calculation_rule: rule ? `${rule.code} v${rule.version}` : "default",
  }));

  if (ledgerRows.length > 0) {
    const { error: ledgerError } = await admin.from("commission_ledger").insert(ledgerRows);
    if (ledgerError) {
      throw new CommissionServiceError(`Could not write the ledger: ${ledgerError.message}`, 500);
    }
  }

  await recordAudit({
    action: version > 1 ? "commission.recalculated" : "commission.calculated",
    entityType: "DEAL",
    entityId: deal.id,
    entityCode: deal.reference_code,
    actorId: input.actorId,
    after: {
      version,
      pool: result.commissionPool,
      distributions: result.distributions.length,
      engine: result.engineVersion,
    },
  });

  /* -- Tell the participants ----------------------------------------------- */
  for (const [agentId, userId] of agentUserIds) {
    const total = (insertedDistributions ?? [])
      .filter((d) => d.agent_id === agentId)
      .reduce((acc, d) => acc + d.amount_minor, 0);
    if (total <= 0) continue;

    await notify({
      userId,
      event: "commission.generated",
      variables: {
        amount: formatMoney(fromMajor((total / 100).toFixed(2), result.currency)),
        dealCode: deal.reference_code,
      },
      actionUrl: "/agent/commissions",
      entityType: "DEAL",
      entityId: deal.id,
    });
  }

  return { result, calculationId: calculation.id, persisted: true };
}

async function reversePreviousLedger(dealId: string, actorId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("commission_ledger")
    .select("*")
    .eq("deal_id", dealId)
    .eq("entry_type", "EARNING")
    .in("status", ["CALCULATED", "APPROVED"]);

  if (!existing || existing.length === 0) return;

  const reversals = existing.map((entry) => ({
    deal_id: entry.deal_id,
    calculation_id: entry.calculation_id,
    distribution_id: entry.distribution_id,
    user_id: entry.user_id,
    agent_id: entry.agent_id,
    investor_id: entry.investor_id,
    role: entry.role,
    entry_type: "REVERSAL" as const,
    amount: entry.amount,
    amount_minor: -Math.abs(entry.amount_minor),
    currency: entry.currency,
    status: "CALCULATED" as const,
    reverses_entry_id: entry.id,
    adjustment_reason: "Superseded by a newer commission calculation.",
  }));

  await admin.from("commission_ledger").insert(reversals);
  await admin
    .from("commission_ledger")
    .update({ status: "CANCELLED" })
    .in(
      "id",
      existing.map((entry) => entry.id),
    );

  await recordAudit({
    action: "commission.reversed",
    entityType: "DEAL",
    entityId: dealId,
    actorId,
    after: { reversedEntries: existing.length },
  });
}

async function resolveAgentUserIds(agentIds: readonly string[]): Promise<Map<string, string>> {
  if (agentIds.length === 0) return new Map();
  const admin = createAdminClient();
  const { data } = await admin
    .from("agents")
    .select("id, user_id")
    .in("id", [...new Set(agentIds)]);
  return new Map((data ?? []).map((row) => [row.id, row.user_id]));
}

/** Validate a stored policy document; fall back to the platform default. */
function parsePolicy(raw: unknown): CommissionPolicy {
  const parsed = CommissionPolicySchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.error("[commission] stored policy failed validation; using the platform default.");
  return DEFAULT_COMMISSION_POLICY;
}

/** Approve every calculated entry on a deal for payout. */
export async function approveDealCommission(dealId: string, actorId: string): Promise<number> {
  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from("commission_ledger")
    .update({ status: "APPROVED", approved_by: actorId, approved_at: new Date().toISOString() })
    .eq("deal_id", dealId)
    .eq("status", "CALCULATED")
    .select("id, user_id, amount, currency");

  if (error) throw new CommissionServiceError(`Approval failed: ${error.message}`, 500);

  await admin
    .from("commission_calculations")
    .update({ status: "APPROVED", approved_by: actorId, approved_at: new Date().toISOString() })
    .eq("deal_id", dealId)
    .eq("is_current", true);

  const { data: deal } = await admin
    .from("deals")
    .select("reference_code")
    .eq("id", dealId)
    .maybeSingle();

  await recordAudit({
    action: "commission.approved",
    entityType: "DEAL",
    entityId: dealId,
    entityCode: deal?.reference_code ?? null,
    actorId,
    after: { approvedEntries: updated?.length ?? 0 },
  });

  for (const entry of updated ?? []) {
    if (!entry.user_id) continue;
    await notify({
      userId: entry.user_id,
      event: "commission.approved",
      variables: {
        amount: formatMoney(fromMajor(entry.amount, entry.currency as "INR")),
        dealCode: deal?.reference_code ?? dealId,
      },
      actionUrl: "/agent/commissions",
      entityType: "DEAL",
      entityId: dealId,
    });
  }

  return updated?.length ?? 0;
}

/** The current calculation with its distributions, for the breakdown UI. */
export async function getCurrentCalculation(dealId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("commission_calculations")
    .select("*, commission_distributions(*)")
    .eq("deal_id", dealId)
    .eq("is_current", true)
    .maybeSingle();

  return data;
}
