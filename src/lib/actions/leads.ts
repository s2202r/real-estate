"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { EnquirySchema, RequirementSchema } from "@/lib/validation/leads";
import { notify } from "@/lib/services/notifications";
import { recordAudit, trackEvent } from "@/lib/services/audit";
import { getRateLimiter, rateLimitKey, clientIpFrom } from "@/lib/security/rate-limit";
import { serviceUnavailable } from "./guards";

/**
 * Customer-facing lead actions.
 *
 * Every action re-validates its input server-side and re-derives anything that
 * matters (which agent owns the listing, which customer is acting) from the
 * database rather than from the form. A client can post whatever it likes; it
 * cannot post itself into someone else's lead.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

export async function submitEnquiry(
  _prev: ActionResult<{ leadId: string; reference: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ leadId: string; reference: string }>> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Please sign in to contact an agent." };
  }
  if (!user.customerId) {
    return { ok: false, message: "Only customer accounts can send enquiries." };
  }

  const parsed = EnquirySchema.safeParse({
    listingId: formData.get("listingId"),
    message: formData.get("message") || undefined,
    requestCallback: formData.get("requestCallback") === "on",
    source: formData.get("source") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Enquiry spam is cheap to send and expensive for agents to triage.
  const requestHeaders = await headers();
  const limit = await getRateLimiter().consume(
    rateLimitKey("enquiry", { userId: user.id, ip: clientIpFrom(requestHeaders) }),
    10,
    3600,
  );
  if (!limit.allowed) {
    return {
      ok: false,
      message: `You have sent a lot of enquiries in the last hour. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, property_id, agent_id, city, status, agents ( user_id )")
    .eq("id", parsed.data.listingId)
    .eq("status", "VERIFIED")
    .maybeSingle();

  if (!listing) {
    return { ok: false, message: "This listing is no longer available." };
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      customer_id: user.customerId,
      property_id: listing.property_id,
      listing_id: listing.id,
      listing_agent_id: listing.agent_id,
      sales_agent_id: listing.agent_id,
      source: parsed.data.source,
      source_detail: parsed.data.requestCallback ? "Callback requested" : null,
      stage: "NEW",
      message: parsed.data.message ?? null,
    })
    .select("id, reference_code")
    .single();

  if (error) {
    // The partial unique index means a duplicate open lead is expected, not an
    // error worth surfacing as a failure.
    if (error.code === "23505") {
      return { ok: true, message: "You have already enquired about this property.", data: undefined };
    }
    return { ok: false, message: "Could not send your enquiry. Please try again." };
  }

  const agentUserId = (listing.agents as { user_id?: string } | null)?.user_id;
  if (agentUserId) {
    await notify({
      userId: agentUserId,
      event: "lead.received",
      variables: { propertyTitle: listing.title, city: listing.city },
      actionUrl: "/agent/leads",
      entityType: "LEAD",
      entityId: lead.id,
    });
  }

  await recordAudit({
    action: "lead.created",
    entityType: "LEAD",
    entityId: lead.id,
    entityCode: lead.reference_code,
    actorId: user.id,
    actorRole: "customer",
  });

  await trackEvent("lead_created", { source: parsed.data.source }, {
    userId: user.id,
    entityType: "LISTING",
    entityId: listing.id,
    city: listing.city,
  });

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: "Enquiry sent. The agent will get in touch shortly.",
    data: { leadId: lead.id, reference: lead.reference_code },
  };
}

export async function toggleFavourite(
  listingId: string,
  propertyId: string,
): Promise<ActionResult<{ favourited: boolean }>> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const user = await getSessionUser();
  if (!user?.customerId) {
    return { ok: false, message: "Sign in to save properties." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("customer_id", user.customerId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id);
    revalidatePath("/dashboard/favorites");
    return { ok: true, message: "Removed from saved properties.", data: { favourited: false } };
  }

  const { error } = await supabase.from("favorites").insert({
    customer_id: user.customerId,
    listing_id: listingId,
    property_id: propertyId,
  });

  if (error) return { ok: false, message: "Could not save this property." };

  await trackEvent("property_saved", {}, {
    userId: user.id,
    entityType: "LISTING",
    entityId: listingId,
  });

  revalidatePath("/dashboard/favorites");
  return { ok: true, message: "Saved to your shortlist.", data: { favourited: true } };
}

export async function createRequirement(
  _prev: ActionResult<{ id: string; reference: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; reference: string }>> {
  const user = await getSessionUser();
  if (!user?.customerId) {
    return { ok: false, message: "Sign in as a customer to post a requirement." };
  }

  const parsed = RequirementSchema.safeParse({
    title: formData.get("title") || undefined,
    listingType: formData.get("listingType"),
    propertyTypes: formData.getAll("propertyTypes").map(String),
    city: formData.get("city"),
    localities: String(formData.get("localities") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    budgetMin: formData.get("budgetMin") || undefined,
    budgetMax: formData.get("budgetMax"),
    minArea: formData.get("minArea") || undefined,
    bedroomsMin: formData.get("bedroomsMin") || undefined,
    bedroomsMax: formData.get("bedroomsMax") || undefined,
    requiredBy: formData.get("requiredBy") || undefined,
    preferences: formData.get("preferences") || undefined,
    amenities: formData.getAll("amenities").map(String),
    isDiscoverable: formData.get("isDiscoverable") !== "off",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const input = parsed.data;

  const { data, error } = await supabase
    .from("customer_requirements")
    .insert({
      customer_id: user.customerId,
      title: input.title ?? null,
      listing_type: input.listingType,
      property_type: input.propertyTypes as never,
      city: input.city,
      localities: input.localities,
      budget_min: input.budgetMin ? String(input.budgetMin) : null,
      budget_max: String(input.budgetMax),
      min_area: input.minArea ? String(input.minArea) : null,
      bedrooms_min: input.bedroomsMin ?? null,
      bedrooms_max: input.bedroomsMax ?? null,
      required_by: input.requiredBy || null,
      preferences: input.preferences ?? null,
      amenities: input.amenities,
      is_discoverable: input.isDiscoverable,
    })
    .select("id, reference_code")
    .single();

  if (error) {
    return { ok: false, message: "Could not save your requirement. Please try again." };
  }

  await trackEvent("requirement_created", { city: input.city }, {
    userId: user.id,
    entityType: "REQUIREMENT",
    entityId: data.id,
    city: input.city,
  });

  revalidatePath("/dashboard/requirements");
  return {
    ok: true,
    message: "Requirement posted. Matching agents can now bring you properties.",
    data: { id: data.id, reference: data.reference_code },
  };
}

/**
 * Reveal a customer's contact details to the agent working their lead.
 * Delegates to the service, which enforces ownership, quota and logging.
 */
export async function revealContact(leadId: string): Promise<ActionResult<{ phone: string; email: string }>> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const user = await getSessionUser();
  if (!user?.agentId) return { ok: false, message: "Only agents can reveal contact details." };
  if (!isAdminClientAvailable()) {
    return { ok: false, message: "Contact reveal is unavailable in this environment." };
  }

  const { revealCustomerContact } = await import("@/lib/services/contact-access");

  try {
    const result = await revealCustomerContact({
      leadId,
      agentId: user.agentId,
      actorId: user.id,
    });
    revalidatePath("/agent/leads");
    return {
      ok: true,
      message: `Contact revealed. ${result.revealsRemainingToday} reveals remaining today.`,
      data: { phone: result.contact.phone, email: result.contact.email },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reveal contact details.",
    };
  }
}

/** Mark a notification read. Kept here so the bell works without a route. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  revalidatePath("/dashboard");
}

/** Used by admin tooling that must read across tenants. */
export async function adminClientAvailable(): Promise<boolean> {
  return isAdminClientAvailable() && Boolean(createAdminClient);
}
