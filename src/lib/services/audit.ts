import "server-only";

import { headers } from "next/headers";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { redactSensitive } from "@/lib/security/masking";
import type { Json } from "@/types/database";

/**
 * Audit logging.
 *
 * Written through the SERVICE-ROLE client on purpose: a user must not be able
 * to suppress, forge or edit the record of what they did. `audit_logs` has no
 * UPDATE or DELETE grant for application roles, so the trail is append-only in
 * the database as well as in intent.
 *
 * Audit writes must never break the operation they describe. A failure here is
 * logged and swallowed — losing an audit row is bad, but rolling back a
 * completed verification because logging failed is worse. Financial operations
 * that require a guaranteed trail write their audit row inside the same
 * transaction instead (see lib/services/commission.ts).
 */

export type AuditAction =
  | "listing.submitted" | "listing.approved" | "listing.rejected" | "listing.suspended"
  | "listing.reinstated" | "listing.edited_by_admin"
  | "listing.updated" | "listing.shared" | "listing.share_approved" | "listing.share_rejected"
  | "property.created" | "property.verified" | "property.rejected" | "property.merged"
  | "agent.verification_submitted" | "agent.verified" | "agent.verification_rejected"
  | "agent.badge_granted" | "agent.suspended" | "agent.reinstated"
  | "investor.verified" | "investor.rejected" | "investor.suspended" | "investor.reinstated"
  | "lead.created" | "lead.assigned" | "lead.stage_changed" | "lead.contact_revealed"
  | "visit.requested" | "visit.offered" | "visit.accepted" | "visit.checked_in"
  | "visit.checked_out" | "visit.qualified" | "visit.disqualified" | "visit.cancelled"
  | "deal.created" | "deal.status_changed" | "deal.closed"
  | "commission.calculated" | "commission.recalculated" | "commission.approved"
  | "commission.reversed" | "payment.recorded"
  | "agreement.created" | "agreement.legal_reviewed" | "agreement.activated"
  | "dispute.raised" | "dispute.resolved"
  | "review.moderated"
  | "admin.setting_changed" | "admin.feature_toggled" | "admin.role_granted";

export interface AuditEntry {
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly entityCode?: string | null;
  readonly actorId?: string | null;
  readonly actorRole?: string | null;
  readonly before?: Record<string, unknown> | null;
  readonly after?: Record<string, unknown> | null;
  readonly reason?: string | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  if (!isAdminClientAvailable()) return;

  try {
    const requestHeaders = await headers();
    const supabase = createAdminClient();

    await supabase.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      entity_code: entry.entityCode ?? null,
      before_state: entry.before ? asJson(redactSensitive(entry.before)) : null,
      after_state: entry.after ? asJson(redactSensitive(entry.after)) : null,
      diff: entry.before && entry.after ? asJson(diffOf(entry.before, entry.after)) : null,
      reason: entry.reason ?? null,
      ip_address: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: requestHeaders.get("user-agent"),
      request_id: requestHeaders.get("x-request-id"),
    });
  } catch (error) {
    console.error("[audit] failed to record entry", entry.action, error);
  }
}

/**
 * Audit snapshots are arbitrary row shapes destined for a `jsonb` column. They
 * are structurally JSON (they came from the database), but `unknown` values
 * cannot be proven so to the compiler, so the cast is made once, here, rather
 * than scattered through every call site.
 */
function asJson(value: Record<string, unknown>): Json {
  return value as Json;
}

/** Only the fields that actually changed, so an audit row stays readable. */
function diffOf(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diff[key] = { from, to };
    }
  }

  const redacted = redactSensitive(diff as Record<string, unknown>);
  return redacted as Record<string, { from: unknown; to: unknown }>;
}

/** Analytics events (§56). Best-effort; never blocks a user action. */
export async function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
  context: { userId?: string | null; entityType?: string; entityId?: string; city?: string } = {},
): Promise<void> {
  if (!isAdminClientAvailable()) return;

  try {
    const supabase = createAdminClient();
    await supabase.from("analytics_events").insert({
      event_name: eventName,
      user_id: context.userId ?? null,
      entity_type: context.entityType ?? null,
      entity_id: context.entityId ?? null,
      city: context.city ?? null,
      properties: asJson(redactSensitive(properties)),
    });
  } catch (error) {
    console.error("[analytics] failed to record event", eventName, error);
  }
}
