import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { platformLimits } from "@/config/app";
import { presentContact, type MaskedContact } from "@/lib/security/masking";
import { recordAudit } from "./audit";
import { AuthorizationError } from "@/lib/auth/permissions";

/**
 * Controlled customer-contact disclosure (§47).
 *
 * Revealing a customer's phone number is a privileged act, not a UI toggle.
 * Every reveal:
 *   1. verifies the agent owns an ACTIVE lead for that customer,
 *   2. is counted against a daily quota, so a compromised agent account cannot
 *      scrape the customer base,
 *   3. writes a `contact_access_logs` row the CUSTOMER can read,
 *   4. writes an audit entry.
 *
 * The customer can therefore see exactly who looked at their details and when —
 * which is both a DPDP-friendly property and the reason agents behave.
 */

export class ContactRevealError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "ContactRevealError";
    this.status = status;
  }
}

export interface RevealResult {
  readonly contact: MaskedContact;
  readonly revealsRemainingToday: number;
}

export async function revealCustomerContact(input: {
  leadId: string;
  agentId: string;
  actorId: string;
  reason?: string;
}): Promise<RevealResult> {
  const supabase = await createClient();

  // 1 · The agent must actually own this lead. RLS already restricts the row,
  //     but we check the ROLE explicitly: being able to see a lead is not the
  //     same as being entitled to the customer's phone number.
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, customer_id, sales_agent_id, listing_agent_id, stage, reference_code")
    .eq("id", input.leadId)
    .maybeSingle();

  if (error || !lead) {
    throw new ContactRevealError("Lead not found.", 404);
  }

  const ownsLead =
    lead.sales_agent_id === input.agentId || lead.listing_agent_id === input.agentId;
  if (!ownsLead) {
    throw new AuthorizationError("You are not assigned to this lead.");
  }

  if (lead.stage === "CLOSED_LOST") {
    throw new ContactRevealError("This lead is closed; contact details are no longer available.");
  }

  // 2 · The customer may have opted out of agent contact entirely.
  if (!isAdminClientAvailable()) {
    throw new ContactRevealError("Contact reveal is unavailable in this environment.", 503);
  }
  const admin = createAdminClient();

  const { data: customer } = await admin
    .from("customers")
    .select("id, user_id, allow_agent_contact")
    .eq("id", lead.customer_id)
    .maybeSingle();

  if (!customer) throw new ContactRevealError("Customer not found.", 404);
  if (!customer.allow_agent_contact) {
    throw new ContactRevealError(
      "This customer has not consented to direct contact. Use in-app messaging instead.",
    );
  }

  // 3 · Daily quota, counted from the log itself so it cannot be bypassed by
  //     losing an in-memory counter.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("contact_access_logs")
    .select("id", { count: "exact", head: true })
    .eq("accessed_by", input.actorId)
    .gte("created_at", since);

  const used = count ?? 0;
  if (used >= platformLimits.contactRevealDailyLimit) {
    throw new ContactRevealError(
      `Daily contact-reveal limit of ${platformLimits.contactRevealDailyLimit} reached. It resets 24 hours after your earliest reveal.`,
      429,
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, phone, phone_country, email")
    .eq("id", customer.user_id)
    .maybeSingle();

  // 4 · Log the access before returning it. If the log write fails, the reveal
  //     fails: an unlogged disclosure is worse than a failed one.
  const requestHeaders = await headers();
  const { error: logError } = await admin.from("contact_access_logs").insert({
    customer_id: customer.id,
    lead_id: lead.id,
    accessed_by: input.actorId,
    agent_id: input.agentId,
    field: "BOTH",
    reason: input.reason ?? null,
    ip_address: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
  });

  if (logError) {
    throw new ContactRevealError("Could not record the access log; contact was not revealed.", 500);
  }

  await admin
    .from("leads")
    .update({
      is_contact_unlocked: true,
      contact_unlocked_at: new Date().toISOString(),
      contact_unlocked_by: input.actorId,
    })
    .eq("id", lead.id);

  await recordAudit({
    action: "lead.contact_revealed",
    entityType: "LEAD",
    entityId: lead.id,
    entityCode: lead.reference_code,
    actorId: input.actorId,
    actorRole: "agent",
    reason: input.reason ?? null,
  });

  return {
    contact: presentContact(
      {
        name: profile?.full_name ?? null,
        phone: profile?.phone ? `${profile.phone_country ?? ""}${profile.phone}` : null,
        email: profile?.email ?? null,
      },
      true,
    ),
    revealsRemainingToday: Math.max(0, platformLimits.contactRevealDailyLimit - used - 1),
  };
}

/**
 * The audit trail a CUSTOMER sees: who accessed their contact details, when.
 * Readable by the customer under RLS.
 */
export async function listContactAccessForCustomer(customerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_access_logs")
    .select("id, created_at, field, reason, agent_id, lead_id")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(100);

  return data ?? [];
}
