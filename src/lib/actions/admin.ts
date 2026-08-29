"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { requireUserOrThrow } from "@/lib/auth/session";
import { assertCan, type Capability } from "@/lib/auth/permissions";
import { AdminListingEditSchema, ModerationSchema } from "@/lib/validation/listings";
import { recordAudit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import {
  approveDealCommission,
  calculateDealCommission,
} from "@/lib/services/commission";
import { calculateTrustScore } from "@/lib/domain/scoring";
import type { ActionResult } from "./leads";
import type { Enums } from "@/types/database";
import { serviceUnavailable } from "./guards";

/**
 * Admin actions.
 *
 * Every one of these begins with an explicit capability check. That is not
 * belt-and-braces decoration: these actions run through the SERVICE-ROLE
 * client, which bypasses RLS, so this check IS the authorisation boundary for
 * them. Getting it wrong here is not caught by the database.
 */

async function requireCapability(capability: Capability) {
  const user = await requireUserOrThrow();
  assertCan(user, capability);
  if (!isAdminClientAvailable()) {
    throw new Error("Administrative operations are unavailable in this environment.");
  }
  return user;
}

/* ------------------------------------------------------------------------ *
 * Listing moderation (§9)
 * ------------------------------------------------------------------------ */

export async function moderateListing(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("listing.moderate");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const parsed = ModerationSchema.safeParse({
    listingId: formData.get("listingId"),
    decision: formData.get("decision"),
    notes: formData.get("notes") || undefined,
    rejectionReason: formData.get("rejectionReason") || undefined,
    verificationScore: formData.get("verificationScore") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please complete the moderation form.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const admin = createAdminClient();
  const { decision, listingId, notes, rejectionReason, verificationScore } = parsed.data;

  const { data: before } = await admin
    .from("listings")
    .select("id, reference_code, title, status, agent_id, property_id, agents ( user_id )")
    .eq("id", listingId)
    .maybeSingle();

  if (!before) return { ok: false, message: "Listing not found." };

  const nextStatus: Enums["listing_status"] =
    decision === "APPROVE" || decision === "REINSTATE"
      ? "VERIFIED"
      : decision === "REJECT"
        ? "REJECTED"
        : "SUSPENDED";

  const { error } = await admin
    .from("listings")
    .update({
      status: nextStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      verification_notes: notes ?? null,
      rejection_reason: decision === "REJECT" ? (rejectionReason ?? null) : null,
      verification_score: verificationScore != null ? String(verificationScore) : undefined,
      // Reinstating keeps the original publication date: the listing was live
      // before, and resetting it would reorder the whole "newest" feed.
      published_at: decision === "APPROVE" ? new Date().toISOString() : undefined,
    })
    .eq("id", listingId);

  if (error) return { ok: false, message: `Could not update the listing: ${error.message}` };

  // Approving a listing also brings its property passport live.
  if (decision === "APPROVE") {
    await admin
      .from("property_passports")
      .update({
        status: "ACTIVE",
        verification_status: "APPROVED",
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", before.property_id);
  }

  await recordAudit({
    action:
      decision === "APPROVE"
        ? "listing.approved"
        : decision === "REJECT"
          ? "listing.rejected"
          : decision === "REINSTATE"
            ? "listing.reinstated"
            : "listing.suspended",
    entityType: "LISTING",
    entityId: listingId,
    entityCode: before.reference_code,
    actorId: user.id,
    actorRole: "admin",
    before: { status: before.status },
    after: { status: nextStatus },
    reason: rejectionReason ?? notes ?? null,
  });

  const agentUserId = (before.agents as { user_id?: string } | null)?.user_id;
  if (agentUserId) {
    await notify({
      userId: agentUserId,
      event:
        decision === "APPROVE" || decision === "REINSTATE"
          ? "listing.approved"
          : "listing.rejected",
      variables: {
        listingTitle: before.title,
        reason: rejectionReason ?? notes ?? "See the moderation notes.",
      },
      actionUrl: "/agent/properties",
      entityType: "LISTING",
      entityId: listingId,
    });
  }

  revalidatePath("/admin/listings");
  return {
    ok: true,
    message:
      decision === "APPROVE"
        ? "Listing approved and published."
        : decision === "REINSTATE"
          ? "Listing reinstated and live again."
          : decision === "REJECT"
            ? "Listing rejected. The agent has been told why."
            : "Listing suspended.",
  };
}

/* ------------------------------------------------------------------------ *
 * Agent verification (§10)
 * ------------------------------------------------------------------------ */

export async function decideAgentVerification(
  verificationId: string,
  decision: "APPROVED" | "REJECTED",
  options: { notes?: string; rejectionReason?: string } = {},
): Promise<ActionResult> {
  let user;
  try {
    user = await requireCapability("agent.verify");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const admin = createAdminClient();

  const { data: verification } = await admin
    .from("agent_verifications")
    .select("id, agent_id, level, status, agents ( user_id, badges, verification_level )")
    .eq("id", verificationId)
    .maybeSingle();

  if (!verification) return { ok: false, message: "Verification not found." };

  await admin
    .from("agent_verifications")
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: options.notes ?? null,
      rejection_reason: decision === "REJECTED" ? (options.rejectionReason ?? null) : null,
    })
    .eq("id", verificationId);

  if (decision === "APPROVED") {
    const agent = verification.agents as {
      user_id: string;
      badges: Enums["agent_badge"][];
      verification_level: Enums["verification_level"];
    } | null;

    // Badges are additive and granted here, by an admin, through the service
    // role. An agent writing this column directly is blocked by a trigger.
    const badge = badgeForLevel(verification.level as Enums["verification_level"]);
    const badges = new Set(agent?.badges ?? []);
    if (badge) badges.add(badge);

    await admin
      .from("agents")
      .update({
        verification_level: verification.level as Enums["verification_level"],
        badges: [...badges],
        status: "ACTIVE",
      })
      .eq("id", verification.agent_id);

    if (agent?.user_id) {
      await notify({
        userId: agent.user_id,
        event: "agent.verified",
        variables: { level: humanise(verification.level) },
        actionUrl: "/agent/profile",
        entityType: "AGENT",
        entityId: verification.agent_id,
      });
    }
  }

  await recordAudit({
    action: decision === "APPROVED" ? "agent.verified" : "agent.verification_rejected",
    entityType: "AGENT",
    entityId: verification.agent_id,
    actorId: user.id,
    actorRole: "admin",
    after: { level: verification.level, decision },
    reason: options.rejectionReason ?? options.notes ?? null,
  });

  revalidatePath("/admin/verifications");
  return { ok: true, message: `Verification ${decision.toLowerCase()}.` };
}

/** Recompute an agent's trust score and award any badge they have earned. */
export async function recomputeAgentStanding(agentId: string): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("agent.verify");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const admin = createAdminClient();
  const { data: agent } = await admin.from("agents").select("*").eq("id", agentId).maybeSingle();
  if (!agent) return { ok: false, message: "Agent not found." };

  const trust = calculateTrustScore({
    closedDealCount: agent.closed_deal_count,
    ratingAverage: Number(agent.rating_average),
    ratingCount: agent.rating_count,
    responseRate: Number(agent.response_rate),
    visitCompletionRate: Number(agent.visit_completion_rate),
    cancellationRate: Number(agent.cancellation_rate),
    complaintCount: agent.complaint_count,
    listingAccuracyRate: 90,
    monthsOnPlatform: Math.max(
      0,
      Math.floor((Date.now() - new Date(agent.joined_at).getTime()) / (30 * 24 * 60 * 60 * 1000)),
    ),
    isIdentityVerified: agent.badges.includes("IDENTITY_VERIFIED"),
    isReraVerified: agent.badges.includes("RERA_VERIFIED"),
  });

  const badges = new Set(agent.badges);
  if (trust.eligibleForTrustedBadge) badges.add("TRUSTED_AGENT");
  else badges.delete("TRUSTED_AGENT");
  if (trust.eligibleForTopPerformerBadge) badges.add("TOP_PERFORMER");
  else badges.delete("TOP_PERFORMER");

  await admin
    .from("agents")
    .update({ trust_score: String(trust.score), badges: [...badges] })
    .eq("id", agentId);

  await recordAudit({
    action: "agent.badge_granted",
    entityType: "AGENT",
    entityId: agentId,
    actorId: user.id,
    actorRole: "admin",
    after: { trustScore: trust.score, badges: [...badges] },
  });

  revalidatePath("/admin/agents");
  return { ok: true, message: `Trust score recomputed: ${trust.score}/100.` };
}

/* ------------------------------------------------------------------------ *
 * Duplicate adjudication (§33)
 * ------------------------------------------------------------------------ */

export async function resolveDuplicate(
  candidateId: string,
  decision: "CONFIRMED_DUPLICATE" | "NOT_DUPLICATE",
  notes?: string,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("duplicate.review");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const admin = createAdminClient();
  const { data: candidate } = await admin
    .from("property_duplicate_candidates")
    .select("id, property_id, candidate_id")
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate) return { ok: false, message: "Candidate not found." };

  await admin
    .from("property_duplicate_candidates")
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      resolution_notes: notes ?? null,
    })
    .eq("id", candidateId);

  // A confirmed duplicate is LINKED, not merged: the history of both passports
  // is preserved and the relationship is recorded for a human to act on.
  if (decision === "CONFIRMED_DUPLICATE") {
    await admin
      .from("property_passports")
      .update({ duplicate_of: candidate.candidate_id })
      .eq("id", candidate.property_id);
  }

  await recordAudit({
    action: "property.merged",
    entityType: "PROPERTY",
    entityId: candidate.property_id,
    actorId: user.id,
    actorRole: "admin",
    after: { decision, linkedTo: candidate.candidate_id },
    reason: notes ?? null,
  });

  revalidatePath("/admin/properties");
  return { ok: true, message: `Marked as ${humanise(decision).toLowerCase()}.` };
}

/* ------------------------------------------------------------------------ *
 * Commission (§22–§23)
 * ------------------------------------------------------------------------ */

export async function runCommissionCalculation(dealId: string): Promise<ActionResult<{ pool: string }>> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("commission.calculate");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  try {
    const outcome = await calculateDealCommission({ dealId, actorId: user.id });
    revalidatePath("/admin/commissions");
    revalidatePath(`/admin/deals`);
    return {
      ok: true,
      message: `Commission calculated. Pool ${outcome.result.commissionPool}, ${outcome.result.distributions.length} distributions.`,
      data: { pool: outcome.result.commissionPool },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Commission calculation failed.",
    };
  }
}

export async function approveCommission(dealId: string): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("commission.approve");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  try {
    const count = await approveDealCommission(dealId, user.id);
    revalidatePath("/admin/commissions");
    return { ok: true, message: `${count} ledger entries approved for payout.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Approval failed." };
  }
}

/* ------------------------------------------------------------------------ *
 * Reviews and disputes
 * ------------------------------------------------------------------------ */

export async function moderateReview(
  reviewId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("review.moderate");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const admin = createAdminClient();
  await admin
    .from("reviews")
    .update({
      moderation_status: decision,
      moderated_by: user.id,
      moderated_at: new Date().toISOString(),
      rejection_reason: decision === "REJECTED" ? (reason ?? null) : null,
    })
    .eq("id", reviewId);

  await recordAudit({
    action: "review.moderated",
    entityType: "REVIEW",
    entityId: reviewId,
    actorId: user.id,
    actorRole: "admin",
    after: { decision },
    reason: reason ?? null,
  });

  revalidatePath("/admin/disputes");
  return { ok: true, message: `Review ${decision.toLowerCase()}.` };
}

export async function resolveDispute(
  disputeId: string,
  decision: "RESOLVED" | "REJECTED" | "ESCALATED",
  resolution: string,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("dispute.manage");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const admin = createAdminClient();

  const { data: dispute } = await admin
    .from("disputes")
    .select("id, reference_code, status, raised_by")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute) return { ok: false, message: "Dispute not found." };

  await admin
    .from("disputes")
    .update({
      status: decision,
      admin_decision: resolution,
      resolution,
      resolved_by: decision === "ESCALATED" ? null : user.id,
      resolved_at: decision === "ESCALATED" ? null : new Date().toISOString(),
      escalated_at: decision === "ESCALATED" ? new Date().toISOString() : null,
    })
    .eq("id", disputeId);

  await admin.from("dispute_events").insert({
    dispute_id: disputeId,
    event_type: "dispute.decided",
    from_status: dispute.status,
    to_status: decision,
    actor_id: user.id,
    notes: resolution,
  });

  await notify({
    userId: dispute.raised_by,
    event: "dispute.updated",
    variables: { disputeCode: dispute.reference_code, status: decision },
    actionUrl: "/agent/dashboard",
    entityType: "DISPUTE",
    entityId: disputeId,
  });

  await recordAudit({
    action: "dispute.resolved",
    entityType: "DISPUTE",
    entityId: disputeId,
    entityCode: dispute.reference_code,
    actorId: user.id,
    actorRole: "admin",
    after: { decision },
    reason: resolution,
  });

  revalidatePath("/admin/disputes");
  return { ok: true, message: `Dispute ${decision.toLowerCase()}.` };
}

/* ------------------------------------------------------------------------ *
 * Settings and flags
 * ------------------------------------------------------------------------ */

export async function toggleFeatureFlag(key: string, enabled: boolean): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("feature.toggle");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  // The environment is a ceiling the database cannot raise. A flag that is off
  // in the deployment stays off however this switch is set — which is what
  // keeps the legally gated investor module from being enabled by accident.
  const { features } = await import("@/config/features");
  if (enabled && key in features && !features[key as keyof typeof features]) {
    return {
      ok: false,
      message: `${key} is disabled for this deployment by environment configuration and cannot be enabled from here.`,
    };
  }

  const admin = createAdminClient();
  await admin
    .from("feature_flags")
    .update({ enabled, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("key", key);

  await recordAudit({
    action: "admin.feature_toggled",
    entityType: "FEATURE_FLAG",
    entityCode: key,
    actorId: user.id,
    actorRole: "admin",
    after: { key, enabled },
  });

  revalidatePath("/admin/settings");
  return { ok: true, message: `${key} ${enabled ? "enabled" : "disabled"}.` };
}

/* ------------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------------ */

function badgeForLevel(level: Enums["verification_level"]): Enums["agent_badge"] | null {
  switch (level) {
    case "IDENTITY_VERIFIED":
      return "IDENTITY_VERIFIED";
    case "RERA_VERIFIED":
      return "RERA_VERIFIED";
    case "PLATFORM_TRUSTED":
      return "TRUSTED_AGENT";
    default:
      return null;
  }
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/** Read-only helper used by admin pages that need cross-tenant reads. */
/* ------------------------------------------------------------------------ *
 * Correcting a listing (§9)
 * ------------------------------------------------------------------------ */

/**
 * Edit an agent's listing as an administrator.
 *
 * This exists because moderation is not always binary: a listing can be sound
 * except for a price that contradicts the paperwork, and rejecting it costs
 * the agent a re-submission and the customer a day.
 *
 * Three constraints make it safe to have at all:
 *
 *  - The editable set is NARROW. Ownership, agent, passport, verification
 *    score and status are not here — changing those is a moderation decision
 *    or a transfer, and each has its own trail.
 *  - A reason is REQUIRED, and the previous values are written to the audit
 *    log beside the new ones. "Who changed this and why" must be answerable.
 *  - The agent is TOLD. Someone else editing your listing without notice is
 *    how a marketplace loses its sellers.
 */
export async function updateListingAsAdmin(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("listing.moderate");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const parsed = AdminListingEditSchema.safeParse({
    listingId: formData.get("listingId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    isNegotiable: formData.get("isNegotiable") === "on",
    bedrooms: formData.get("bedrooms") || undefined,
    bathrooms: formData.get("bathrooms") || undefined,
    builtUpArea: formData.get("builtUpArea") || undefined,
    locality: formData.get("locality"),
    city: formData.get("city"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the fields below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const input = parsed.data;
  const admin = await adminSupabase();

  const { data: before } = await admin
    .from("listings")
    .select(
      "id, reference_code, title, description, price, bedrooms, bathrooms, built_up_area, locality, city, agents ( user_id )",
    )
    .eq("id", input.listingId)
    .maybeSingle();

  if (!before) return { ok: false, message: "Listing not found." };

  const { error } = await admin
    .from("listings")
    .update({
      title: input.title,
      description: input.description || null,
      price: String(input.price),
      is_negotiable: input.isNegotiable ?? false,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      built_up_area: input.builtUpArea != null ? String(input.builtUpArea) : null,
      locality: input.locality,
      city: input.city,
    })
    .eq("id", input.listingId);

  if (error) return { ok: false, message: `Could not save the changes: ${error.message}` };

  await recordAudit({
    action: "listing.edited_by_admin",
    entityType: "LISTING",
    entityId: input.listingId,
    entityCode: before.reference_code,
    actorId: user.id,
    actorRole: "admin",
    before: {
      title: before.title,
      price: before.price,
      bedrooms: before.bedrooms,
      bathrooms: before.bathrooms,
      built_up_area: before.built_up_area,
      locality: before.locality,
      city: before.city,
    },
    after: {
      title: input.title,
      price: String(input.price),
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      built_up_area: input.builtUpArea ?? null,
      locality: input.locality,
      city: input.city,
    },
    reason: input.reason,
  });

  const agentUserId = (before.agents as { user_id?: string } | null)?.user_id;
  if (agentUserId) {
    await notify({
      userId: agentUserId,
      event: "listing.updated",
      variables: { listingTitle: input.title, reason: input.reason },
      actionUrl: "/agent/properties",
      entityType: "LISTING",
      entityId: input.listingId,
    });
  }

  revalidatePath("/admin/listings");
  revalidatePath("/agent/properties");
  return { ok: true, message: "Listing updated. The agent has been notified." };
}

/* ------------------------------------------------------------------------ *
 * Account standing: agents and investors
 * ------------------------------------------------------------------------ */

/**
 * Suspend or reinstate an agent's account.
 *
 * Separate from verification. A verification decision answers "are they who
 * they say they are"; this answers "may they operate here right now", and the
 * two move independently — a verified agent can still be suspended for
 * conduct, and reinstating them must not silently re-grant a badge.
 *
 * A suspended agent disappears from the public directory, because the view is
 * scoped to ACTIVE. Their listings are NOT touched: taking down inventory is
 * a separate decision with its own consequences for customers mid-enquiry.
 */
export async function setAgentStatus(
  agentId: string,
  status: Enums["account_status"],
  reason: string,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("user.manage");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  if (reason.trim().length < 5) {
    return { ok: false, message: "Give a reason — it goes on the record." };
  }

  const admin = await adminSupabase();
  const { data: before } = await admin
    .from("agents")
    .select("id, slug, status, user_id")
    .eq("id", agentId)
    .maybeSingle();

  if (!before) return { ok: false, message: "Agent not found." };

  const { error } = await admin.from("agents").update({ status }).eq("id", agentId);
  if (error) return { ok: false, message: `Could not update the agent: ${error.message}` };

  await recordAudit({
    action: status === "SUSPENDED" ? "agent.suspended" : "agent.reinstated",
    entityType: "AGENT",
    entityId: agentId,
    entityCode: before.slug,
    actorId: user.id,
    actorRole: "admin",
    before: { status: before.status },
    after: { status },
    reason,
  });

  await notify({
    userId: before.user_id,
    event: status === "SUSPENDED" ? "agent.suspended" : "agent.reinstated",
    variables: { reason },
    actionUrl: "/agent/profile",
    entityType: "AGENT",
    entityId: agentId,
  });

  revalidatePath("/admin/agents");
  revalidatePath("/agents");
  return {
    ok: true,
    message: status === "SUSPENDED" ? "Agent suspended." : "Agent reinstated.",
  };
}

/**
 * Approve, reject or suspend an investor.
 *
 * The investor module is legally gated (docs/LEGAL_REVIEW.md L1) and ships
 * disabled, so this is the control that exists for the day it is switched on —
 * not a path around that gate. Approving an investor grants them nothing on
 * its own; it records that their identity and standing were reviewed.
 */
export async function setInvestorStanding(
  investorId: string,
  decision: "APPROVE" | "REJECT" | "SUSPEND" | "REINSTATE",
  reason: string,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireCapability("investor.verify");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  if (reason.trim().length < 5) {
    return { ok: false, message: "Give a reason — it goes on the record." };
  }

  const admin = await adminSupabase();
  const { data: before } = await admin
    .from("investors")
    .select("id, entity_name, status, verification_status, user_id")
    .eq("id", investorId)
    .maybeSingle();

  if (!before) return { ok: false, message: "Investor not found." };

  const patch =
    decision === "APPROVE"
      ? { verification_status: "APPROVED" as const, status: "ACTIVE" as const }
      : decision === "REJECT"
        ? { verification_status: "REJECTED" as const }
        : decision === "SUSPEND"
          ? { status: "SUSPENDED" as const }
          : { status: "ACTIVE" as const };

  const { error } = await admin.from("investors").update(patch).eq("id", investorId);
  if (error) return { ok: false, message: `Could not update the investor: ${error.message}` };

  await recordAudit({
    action:
      decision === "APPROVE"
        ? "investor.verified"
        : decision === "REJECT"
          ? "investor.rejected"
          : decision === "SUSPEND"
            ? "investor.suspended"
            : "investor.reinstated",
    entityType: "INVESTOR",
    entityId: investorId,
    entityCode: before.entity_name ?? investorId,
    actorId: user.id,
    actorRole: "admin",
    before: { status: before.status, verification_status: before.verification_status },
    after: patch,
    reason,
  });

  revalidatePath("/admin/investors");
  return { ok: true, message: `Investor ${decision.toLowerCase()}d.` };
}

export async function adminSupabase() {
  await requireUserOrThrow();
  return createClient();
}
