"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { VisitRequestSchema } from "@/lib/validation/leads";
import { notify, notifyMany } from "@/lib/services/notifications";
import { recordAudit, trackEvent } from "@/lib/services/audit";
import { qualifyVisit, DEFAULT_QUALIFICATION_RULES } from "@/lib/domain/attribution";
import { distanceKm } from "@/lib/domain/geo";
import { platformLimits } from "@/config/app";
import type { ActionResult } from "./leads";

/**
 * Visit marketplace.
 *
 * The flow the brief describes (§16–§18): a customer requests a visit; the
 * listing agent is offered it first; if they decline or go quiet, nearby
 * available agents are offered it in ranked order; whoever accepts becomes the
 * VISITING AGENT and is recorded as such for attribution.
 *
 * Qualification is computed by the pure predicate in lib/domain/attribution and
 * written through the service-role client, because a database trigger forbids
 * an agent from setting `is_qualified` on their own visit.
 */

export async function requestVisit(
  _prev: ActionResult<{ visitId: string; reference: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ visitId: string; reference: string }>> {
  const user = await getSessionUser();
  if (!user?.customerId) {
    return { ok: false, message: "Sign in as a customer to book a site visit." };
  }

  const parsed = VisitRequestSchema.safeParse({
    listingId: formData.get("listingId"),
    visitType: formData.get("visitType") || undefined,
    requestedDate: formData.get("requestedDate"),
    requestedTime: formData.get("requestedTime"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the date and time.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, property_id, agent_id, city, locality, latitude, longitude, agents ( user_id )")
    .eq("id", parsed.data.listingId)
    .eq("status", "VERIFIED")
    .maybeSingle();

  if (!listing) return { ok: false, message: "This listing is no longer available." };

  // Reuse the open lead if there is one, so a visit and its enquiry stay on the
  // same attribution thread.
  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("customer_id", user.customerId)
    .eq("listing_id", listing.id)
    .not("stage", "in", "(CLOSED_WON,CLOSED_LOST)")
    .maybeSingle();

  let leadId = existingLead?.id ?? null;

  if (!leadId) {
    const { data: created } = await supabase
      .from("leads")
      .insert({
        customer_id: user.customerId,
        property_id: listing.property_id,
        listing_id: listing.id,
        listing_agent_id: listing.agent_id,
        sales_agent_id: listing.agent_id,
        source: "CUSTOMER_SEARCH",
        stage: "VISIT_REQUESTED",
        message: parsed.data.notes ?? null,
      })
      .select("id")
      .maybeSingle();
    leadId = created?.id ?? null;
  } else {
    await supabase.from("leads").update({ stage: "VISIT_REQUESTED" }).eq("id", leadId);
  }

  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      customer_id: user.customerId,
      property_id: listing.property_id,
      listing_id: listing.id,
      lead_id: leadId,
      visit_type: parsed.data.visitType,
      status: "REQUESTED",
      requested_date: parsed.data.requestedDate,
      requested_time: parsed.data.requestedTime,
      preferred_agent_id: listing.agent_id,
      listing_agent_id: listing.agent_id,
      customer_notes: parsed.data.notes ?? null,
    })
    .select("id, reference_code")
    .single();

  if (error) {
    return { ok: false, message: "Could not book the visit. Please try another slot." };
  }

  // Offer it to the listing agent first, then to the marketplace.
  await offerVisitToAgents(visit.id, {
    listingAgentId: listing.agent_id,
    city: listing.city,
    latitude: listing.latitude ? Number(listing.latitude) : null,
    longitude: listing.longitude ? Number(listing.longitude) : null,
    visitDate: parsed.data.requestedDate,
    visitTime: parsed.data.requestedTime,
    propertyTitle: listing.title,
  });

  await recordAudit({
    action: "visit.requested",
    entityType: "VISIT",
    entityId: visit.id,
    entityCode: visit.reference_code,
    actorId: user.id,
    actorRole: "customer",
  });

  await trackEvent("visit_requested", { visitType: parsed.data.visitType }, {
    userId: user.id,
    entityType: "VISIT",
    entityId: visit.id,
    city: listing.city,
  });

  revalidatePath("/dashboard/visits");
  return {
    ok: true,
    message: "Visit requested. We are confirming an agent for your slot.",
    data: { visitId: visit.id, reference: visit.reference_code },
  };
}

/**
 * Rank and offer a visit to eligible agents.
 *
 * Ranking is deliberate: the listing agent is always rank 1 (it is their
 * inventory), then nearby agents ordered by distance and platform standing.
 * Every offer is recorded, so "who was asked, and when" is never in dispute.
 */
async function offerVisitToAgents(
  visitId: string,
  context: {
    listingAgentId: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    visitDate: string;
    visitTime: string;
    propertyTitle: string;
  },
): Promise<void> {
  if (!isAdminClientAvailable()) return;
  const admin = createAdminClient();

  const { data: candidates } = await admin
    .from("agents")
    .select("id, user_id, base_latitude, base_longitude, trust_score, max_visit_distance_km, service_cities")
    .eq("status", "ACTIVE")
    .eq("accepts_visit_requests", true)
    .contains("service_cities", [context.city])
    .limit(50);

  const ranked = (candidates ?? [])
    .map((agent) => {
      const hasGeo =
        context.latitude != null &&
        context.longitude != null &&
        agent.base_latitude != null &&
        agent.base_longitude != null;

      const distance = hasGeo
        ? distanceKm(
            { latitude: context.latitude!, longitude: context.longitude! },
            { latitude: Number(agent.base_latitude), longitude: Number(agent.base_longitude) },
          )
        : null;

      return { agent, distance, trust: Number(agent.trust_score ?? 0) };
    })
    // Respect each agent's own maximum travel distance: offering beyond it
    // wastes the offer and trains agents to ignore notifications.
    .filter(
      (item) =>
        item.distance === null || item.distance <= Number(item.agent.max_visit_distance_km ?? 15),
    )
    .sort((a, b) => {
      if (a.agent.id === context.listingAgentId) return -1;
      if (b.agent.id === context.listingAgentId) return 1;
      const distanceDelta = (a.distance ?? 999) - (b.distance ?? 999);
      if (Math.abs(distanceDelta) > 0.5) return distanceDelta;
      return b.trust - a.trust;
    })
    .slice(0, 5);

  if (ranked.length === 0) return;

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await admin.from("visit_assignments").insert(
    ranked.map((item, index) => ({
      visit_id: visitId,
      agent_id: item.agent.id,
      status: "OFFERED" as const,
      offer_rank: index + 1,
      distance_km: item.distance === null ? null : String(Math.round(item.distance * 100) / 100),
      match_score: String(Math.round(item.trust)),
      expires_at: expiresAt,
    })),
  );

  await admin.from("visits").update({ status: "OFFERED" }).eq("id", visitId);

  await notifyMany(
    ranked.map((item) => item.agent.user_id),
    {
      event: "visit.opportunity",
      variables: {
        distanceKm: ranked[0]?.distance ? ranked[0].distance.toFixed(1) : "nearby",
        visitDate: context.visitDate,
        visitTime: context.visitTime,
      },
      actionUrl: "/agent/visits",
      entityType: "VISIT",
      entityId: visitId,
    },
  );
}

/** An agent accepts an offered visit and becomes the visiting agent. */
export async function acceptVisit(visitId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user?.agentId) return { ok: false, message: "Only agents can accept visits." };
  if (!isAdminClientAvailable()) {
    return { ok: false, message: "Visit assignment is unavailable in this environment." };
  }

  const admin = createAdminClient();

  const { data: offer } = await admin
    .from("visit_assignments")
    .select("id, status, expires_at")
    .eq("visit_id", visitId)
    .eq("agent_id", user.agentId)
    .maybeSingle();

  if (!offer) return { ok: false, message: "This visit was not offered to you." };
  if (offer.status !== "OFFERED") {
    return { ok: false, message: "This offer is no longer open." };
  }
  if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
    return { ok: false, message: "This offer has expired." };
  }

  const { data: visit } = await admin
    .from("visits")
    .select("id, reference_code, status, customer_id, listing_id, requested_date, requested_time, customers ( user_id ), listings ( title )")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit) return { ok: false, message: "Visit not found." };
  if (visit.status !== "OFFERED" && visit.status !== "REQUESTED") {
    return { ok: false, message: "This visit has already been assigned." };
  }

  await admin
    .from("visits")
    .update({
      assigned_agent_id: user.agentId,
      assigned_at: new Date().toISOString(),
      status: "ASSIGNED",
      scheduled_at: `${visit.requested_date}T${visit.requested_time}`,
    })
    .eq("id", visitId);

  await admin
    .from("visit_assignments")
    .update({ status: "ACCEPTED", responded_at: new Date().toISOString() })
    .eq("id", offer.id);

  // Everyone else's offer is withdrawn: an open offer on a taken visit is a
  // notification that wastes an agent's time.
  await admin
    .from("visit_assignments")
    .update({ status: "WITHDRAWN", responded_at: new Date().toISOString() })
    .eq("visit_id", visitId)
    .eq("status", "OFFERED");

  const customerUserId = (visit.customers as { user_id?: string } | null)?.user_id;
  if (customerUserId) {
    await notify({
      userId: customerUserId,
      event: "visit.accepted",
      variables: {
        agentName: user.fullName,
        propertyTitle: (visit.listings as { title?: string } | null)?.title ?? "the property",
        visitDate: visit.requested_date,
        visitTime: visit.requested_time,
      },
      actionUrl: "/dashboard/visits",
      entityType: "VISIT",
      entityId: visitId,
    });
  }

  await recordAudit({
    action: "visit.accepted",
    entityType: "VISIT",
    entityId: visitId,
    entityCode: visit.reference_code,
    actorId: user.id,
    actorRole: "agent",
  });

  revalidatePath("/agent/visits");
  return { ok: true, message: "Visit accepted. You are now the visiting agent." };
}

export async function declineVisit(visitId: string, reason?: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user?.agentId) return { ok: false, message: "Only agents can decline visits." };
  if (!isAdminClientAvailable()) {
    return { ok: false, message: "Unavailable in this environment." };
  }

  const admin = createAdminClient();
  await admin
    .from("visit_assignments")
    .update({
      status: "DECLINED",
      responded_at: new Date().toISOString(),
      decline_reason: reason ?? null,
    })
    .eq("visit_id", visitId)
    .eq("agent_id", user.agentId);

  revalidatePath("/agent/visits");
  return { ok: true, message: "Offer declined." };
}

/** Agent or customer check-in, with the GPS fix that feeds qualification. */
export async function checkInToVisit(input: {
  visitId: string;
  actor: "AGENT" | "CUSTOMER";
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sign in to check in." };
  if (!isAdminClientAvailable()) {
    return { ok: false, message: "Unavailable in this environment." };
  }

  const admin = createAdminClient();

  const { data: visit } = await admin
    .from("visits")
    .select("id, reference_code, status, assigned_agent_id, customer_id, property_id, started_at")
    .eq("id", input.visitId)
    .maybeSingle();

  if (!visit) return { ok: false, message: "Visit not found." };

  const isAssignedAgent = user.agentId != null && visit.assigned_agent_id === user.agentId;
  const isCustomer = user.customerId != null && visit.customer_id === user.customerId;
  if (!isAssignedAgent && !isCustomer) {
    return { ok: false, message: "You are not part of this visit." };
  }

  const { data: address } = await admin
    .from("property_addresses")
    .select("latitude, longitude")
    .eq("property_id", visit.property_id)
    .maybeSingle();

  let withinGeofence: boolean | null = null;
  let distanceMeters: number | null = null;

  if (
    input.latitude != null &&
    input.longitude != null &&
    address?.latitude != null &&
    address?.longitude != null
  ) {
    const { isWithinGeofence } = await import("@/lib/domain/geo");
    const evaluation = isWithinGeofence(
      { latitude: input.latitude, longitude: input.longitude },
      { latitude: Number(address.latitude), longitude: Number(address.longitude) },
      platformLimits.visitGeofenceRadiusMeters,
      input.accuracyMeters ?? 0,
    );
    withinGeofence = evaluation.within;
    distanceMeters = evaluation.distanceMeters;
  }

  await admin.from("visit_checkins").insert({
    visit_id: visit.id,
    actor: input.actor,
    actor_id: user.id,
    action: "CHECK_IN",
    latitude: input.latitude == null ? null : String(input.latitude),
    longitude: input.longitude == null ? null : String(input.longitude),
    accuracy_m: input.accuracyMeters == null ? null : String(input.accuracyMeters),
    distance_from_property_m: distanceMeters == null ? null : String(distanceMeters),
    within_geofence: withinGeofence,
  });

  // Only the agent's check-in changes visit state: a customer arriving early
  // must not start the clock that the duration check runs against.
  if (input.actor === "AGENT") {
    const now = new Date().toISOString();
    await admin
      .from("visits")
      .update({
        agent_confirmed_at: now,
        started_at: visit.started_at ?? now,
        status: "IN_PROGRESS",
        ...(withinGeofence !== null
          ? {
              geofence_passed: withinGeofence,
              geofence_distance_m: distanceMeters == null ? null : String(distanceMeters),
            }
          : {}),
      })
      .eq("id", visit.id);
  }

  await recordAudit({
    action: "visit.checked_in",
    entityType: "VISIT",
    entityId: visit.id,
    entityCode: visit.reference_code,
    actorId: user.id,
    after: { actor: input.actor, withinGeofence, distanceMeters },
  });

  revalidatePath("/agent/visits");
  revalidatePath("/dashboard/visits");
  return { ok: true, message: "Checked in." };
}

/**
 * End a visit and evaluate qualification.
 *
 * The decision is made by the pure predicate; this function only gathers the
 * evidence and stores the verdict with its reasons.
 */
export async function completeVisit(input: {
  visitId: string;
  outcome: string;
  interestLevel?: number;
  notes?: string;
}): Promise<ActionResult<{ qualified: boolean; reason: string | null }>> {
  const user = await getSessionUser();
  if (!user?.agentId) return { ok: false, message: "Only the visiting agent can complete a visit." };
  if (!isAdminClientAvailable()) {
    return { ok: false, message: "Unavailable in this environment." };
  }

  const admin = createAdminClient();

  const { data: visit } = await admin
    .from("visits")
    .select("*")
    .eq("id", input.visitId)
    .eq("assigned_agent_id", user.agentId)
    .maybeSingle();

  if (!visit) return { ok: false, message: "Visit not found or not assigned to you." };

  const endedAt = new Date().toISOString();

  const { data: address } = await admin
    .from("property_addresses")
    .select("latitude, longitude")
    .eq("property_id", visit.property_id)
    .maybeSingle();

  const { data: checkin } = await admin
    .from("visit_checkins")
    .select("latitude, longitude, accuracy_m")
    .eq("visit_id", visit.id)
    .eq("actor", "AGENT")
    .eq("action", "CHECK_IN")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const qualification = qualifyVisit(
    {
      visitId: visit.id,
      visitType: visit.visit_type,
      startedAt: visit.started_at,
      endedAt,
      agentCheckedInAt: visit.agent_confirmed_at,
      customerConfirmedAt: visit.customer_confirmed_at,
      otpVerifiedAt: visit.otp_verified_at,
      agentLocation:
        checkin?.latitude != null && checkin?.longitude != null
          ? {
              latitude: Number(checkin.latitude),
              longitude: Number(checkin.longitude),
              accuracyMeters: checkin.accuracy_m == null ? 0 : Number(checkin.accuracy_m),
            }
          : null,
      propertyLocation:
        address?.latitude != null && address?.longitude != null
          ? { latitude: Number(address.latitude), longitude: Number(address.longitude) }
          : null,
      outcomeRecorded: Boolean(input.outcome && input.outcome !== "NOT_RECORDED"),
    },
    {
      ...DEFAULT_QUALIFICATION_RULES,
      minDurationMinutes: platformLimits.visitMinDurationMinutes,
      geofenceRadiusMeters: platformLimits.visitGeofenceRadiusMeters,
    },
  );

  await admin
    .from("visits")
    .update({
      ended_at: endedAt,
      status: qualification.qualified ? "QUALIFIED" : "COMPLETED",
      outcome: input.outcome as never,
      interest_level: input.interestLevel ?? null,
      agent_notes: input.notes ?? null,
      is_qualified: qualification.qualified,
      qualified_at: qualification.qualified ? endedAt : null,
      qualification_reasons: Object.fromEntries(
        qualification.checks.map((check) => [check.key, check.passed]),
      ) as never,
      disqualification_reason: qualification.disqualificationReason,
      geofence_passed: qualification.geofencePassed,
      geofence_distance_m:
        qualification.geofenceDistanceMeters == null
          ? null
          : String(qualification.geofenceDistanceMeters),
    })
    .eq("id", visit.id);

  await admin.from("visit_checkins").insert({
    visit_id: visit.id,
    actor: "AGENT",
    actor_id: user.id,
    action: "CHECK_OUT",
  });

  await recordAudit({
    action: qualification.qualified ? "visit.qualified" : "visit.disqualified",
    entityType: "VISIT",
    entityId: visit.id,
    entityCode: visit.reference_code,
    actorId: user.id,
    after: {
      qualified: qualification.qualified,
      reason: qualification.disqualificationReason,
      durationMinutes: qualification.durationMinutes,
    },
  });

  const { data: customer } = await admin
    .from("customers")
    .select("user_id")
    .eq("id", visit.customer_id)
    .maybeSingle();

  if (customer?.user_id) {
    await notify({
      userId: customer.user_id,
      event: "visit.completed",
      variables: { propertyTitle: "your recent visit" },
      actionUrl: "/dashboard/visits",
      entityType: "VISIT",
      entityId: visit.id,
    });
  }

  revalidatePath("/agent/visits");
  return {
    ok: true,
    message: qualification.qualified
      ? "Visit completed and qualified for commission attribution."
      : `Visit completed but not qualified: ${qualification.disqualificationReason}`,
    data: { qualified: qualification.qualified, reason: qualification.disqualificationReason },
  };
}

/** The customer's independent confirmation — the anti-collusion signal. */
export async function confirmVisitAsCustomer(
  visitId: string,
  didHappen: boolean,
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user?.customerId) return { ok: false, message: "Sign in as a customer to confirm." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("visits")
    .update({ customer_confirmed_at: didHappen ? new Date().toISOString() : null })
    .eq("id", visitId)
    .eq("customer_id", user.customerId);

  if (error) return { ok: false, message: "Could not record your confirmation." };

  revalidatePath("/dashboard/visits");
  return {
    ok: true,
    message: didHappen ? "Thanks — visit confirmed." : "Recorded. We will look into it.",
  };
}
