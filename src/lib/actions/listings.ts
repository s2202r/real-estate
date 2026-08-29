"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { requireAgent, getSessionUser } from "@/lib/auth/session";
import {
  ListingDraftSchema,
  ShareRequestSchema,
  ShareResponseSchema,
} from "@/lib/validation/listings";
import { recordAudit, trackEvent } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { calculateListingCompleteness } from "@/lib/domain/scoring";
import { assessDuplicate, DUPLICATE_REVIEW_THRESHOLD } from "@/lib/domain/duplicates";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "./leads";
import { serviceUnavailable } from "./guards";

/**
 * Agent listing actions.
 *
 * The important design point: creating a listing may also create a PROPERTY
 * PASSPORT. The passport is the permanent identity of the physical property, so
 * before creating a new one we look for an existing passport describing the
 * same unit, and we queue likely duplicates for human review rather than
 * merging them.
 */

export async function saveListing(
  _prev: ActionResult<{ listingId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ listingId: string }>> {
  const user = await requireAgent();

  const parsed = ListingDraftSchema.safeParse({
    propertyId: formData.get("propertyId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    listingType: formData.get("listingType"),
    propertyType: formData.get("propertyType"),
    category: formData.get("category") || undefined,
    price: formData.get("price"),
    isNegotiable: formData.get("isNegotiable") !== "off",
    maintenanceCharge: formData.get("maintenanceCharge") || undefined,
    securityDeposit: formData.get("securityDeposit") || undefined,
    brokerageValue: formData.get("brokerageValue") || undefined,
    bedrooms: formData.get("bedrooms") || undefined,
    bathrooms: formData.get("bathrooms") || undefined,
    balconies: formData.get("balconies") || undefined,
    builtUpArea: formData.get("builtUpArea"),
    carpetArea: formData.get("carpetArea") || undefined,
    floor: formData.get("floor") || undefined,
    totalFloors: formData.get("totalFloors") || undefined,
    facing: formData.get("facing") || undefined,
    furnishing: formData.get("furnishing") || undefined,
    ageYears: formData.get("ageYears") || undefined,
    possessionStatus: formData.get("possessionStatus") || undefined,
    availableFrom: formData.get("availableFrom") || undefined,
    coveredParking: formData.get("coveredParking") || undefined,
    openParking: formData.get("openParking") || undefined,
    city: formData.get("city"),
    locality: formData.get("locality"),
    state: formData.get("state"),
    pincode: formData.get("pincode") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    coverImageUrl: formData.get("coverImageUrl") || undefined,
    youtubeUrl: formData.get("youtubeUrl") || undefined,
    instagramReelUrl: formData.get("instagramReelUrl") || undefined,
    virtualTourUrl: formData.get("virtualTourUrl") || undefined,
    tower: formData.get("tower") || undefined,
    unitNumber: formData.get("unitNumber") || undefined,
    reraNumber: formData.get("reraNumber") || undefined,
    amenities: formData.getAll("amenities").map(String),
    highlights: formData
      .getAll("highlights")
      .map(String)
      .filter((item) => item.trim().length > 0),
    isShareable: formData.get("isShareable") !== "off",
    submit: formData.get("submit") === "true",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const input = parsed.data;
  const supabase = await createClient();

  /* -- Resolve or create the Property Passport ---------------------------- */
  let propertyId = input.propertyId ?? null;

  if (!propertyId) {
    const regionCity = input.city;
    const { data: passport, error: passportError } = await supabase
      .from("property_passports")
      .insert({
        region_code: regionFor(regionCity),
        property_type: input.propertyType,
        category: input.category,
        tower: input.tower ?? null,
        unit_number: input.unitNumber ?? null,
        floor: input.floor ?? null,
        total_floors: input.totalFloors ?? null,
        built_up_area: String(input.builtUpArea),
        carpet_area: input.carpetArea ? String(input.carpetArea) : null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        balconies: input.balconies ?? null,
        facing: input.facing ?? null,
        age_years: input.ageYears ?? null,
        rera_number: input.reraNumber ?? null,
        status: "PENDING_VERIFICATION",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (passportError || !passport) {
      return { ok: false, message: "Could not create the property record. Please try again." };
    }

    propertyId = passport.id;

    await supabase.from("property_addresses").insert({
      property_id: propertyId,
      address_line1: input.addressLine1 ?? null,
      locality: input.locality,
      city: input.city,
      state: input.state,
      pincode: input.pincode || null,
      latitude: input.latitude != null ? String(input.latitude) : null,
      longitude: input.longitude != null ? String(input.longitude) : null,
    });

    if (input.amenities.length > 0) {
      await supabase.from("property_amenities").insert(
        input.amenities.map((key) => ({ property_id: propertyId!, amenity_key: key })),
      );
    }

    await recordAudit({
      action: "property.created",
      entityType: "PROPERTY",
      entityId: propertyId,
      actorId: user.id,
      actorRole: "agent",
    });

    // Queue likely duplicates for a human. The platform never auto-merges.
    await queueDuplicateCandidates(propertyId, {
      city: input.city,
      locality: input.locality,
      tower: input.tower ?? null,
      unitNumber: input.unitNumber ?? null,
      bedrooms: input.bedrooms ?? null,
      builtUpArea: input.builtUpArea,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      price: Number(input.price),
    });
  }

  /* -- The listing --------------------------------------------------------- */
  const completeness = calculateListingCompleteness({
    hasImages: input.coverImageUrl ? 1 : 0,
    hasFloorPlan: false,
    hasVideoOrTour: Boolean(
      input.youtubeUrl || input.instagramReelUrl || input.virtualTourUrl,
    ),
    hasDescription: Boolean(input.description),
    hasAmenities: input.amenities.length > 0,
    hasNearbyPlaces: false,
    hasCoordinates: input.latitude != null && input.longitude != null,
    hasReraNumber: Boolean(input.reraNumber),
    hasDocuments: false,
    hasCarpetArea: input.carpetArea != null,
  });

  const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      property_id: propertyId,
      agent_id: user.agentId,
      title: input.title,
      slug,
      description: input.description ?? null,
      highlights: input.highlights,
      listing_type: input.listingType,
      // An agent can create a DRAFT or SUBMIT for review. They can never
      // create a VERIFIED listing; a trigger enforces this independently.
      status: input.submit ? "SUBMITTED" : "DRAFT",
      price: input.price,
      is_negotiable: input.isNegotiable,
      maintenance_charge: input.maintenanceCharge ?? null,
      security_deposit: input.securityDeposit ?? null,
      brokerage_type: input.brokerageType,
      brokerage_value: String(input.brokerageValue),
      property_type: input.propertyType,
      category: input.category,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      balconies: input.balconies ?? null,
      built_up_area: String(input.builtUpArea),
      carpet_area: input.carpetArea ? String(input.carpetArea) : null,
      floor: input.floor ?? null,
      total_floors: input.totalFloors ?? null,
      facing: input.facing ?? null,
      furnishing: input.furnishing,
      age_years: input.ageYears ?? null,
      possession_status: input.possessionStatus,
      available_from: input.availableFrom || null,
      covered_parking: input.coveredParking,
      open_parking: input.openParking,
      city: input.city,
      locality: input.locality,
      state: input.state,
      pincode: input.pincode || null,
      latitude: input.latitude != null ? String(input.latitude) : null,
      longitude: input.longitude != null ? String(input.longitude) : null,
      cover_image_url: input.coverImageUrl || null,
      youtube_url: input.youtubeUrl || null,
      instagram_reel_url: input.instagramReelUrl || null,
      virtual_tour_url: input.virtualTourUrl || null,
      is_shareable: input.isShareable,
    })
    .select("id, reference_code")
    .single();

  if (error || !listing) {
    return { ok: false, message: `Could not save the listing: ${error?.message ?? "unknown error"}` };
  }

  await recordAudit({
    action: input.submit ? "listing.submitted" : "listing.updated",
    entityType: "LISTING",
    entityId: listing.id,
    entityCode: listing.reference_code,
    actorId: user.id,
    actorRole: "agent",
    after: { status: input.submit ? "SUBMITTED" : "DRAFT", completeness: completeness.score },
  });

  await trackEvent("listing_created", { submitted: input.submit }, {
    userId: user.id,
    entityType: "LISTING",
    entityId: listing.id,
    city: input.city,
  });

  revalidatePath("/agent/properties");
  redirect(`/agent/properties?created=${listing.reference_code}`);
}

/** Submit an existing draft for moderation. */
export async function submitListingForReview(listingId: string): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const user = await requireAgent();
  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({ status: "SUBMITTED", submitted_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("agent_id", user.agentId)
    .in("status", ["DRAFT", "REJECTED", "EXPIRED"]);

  if (error) {
    return { ok: false, message: "Could not submit this listing for review." };
  }

  await recordAudit({
    action: "listing.submitted",
    entityType: "LISTING",
    entityId: listingId,
    actorId: user.id,
    actorRole: "agent",
  });

  revalidatePath("/agent/properties");
  return { ok: true, message: "Submitted for review. Moderation usually completes within a day." };
}

/* ------------------------------------------------------------------------ *
 * Agent-to-agent inventory sharing (§14)
 * ------------------------------------------------------------------------ */

export async function requestInventoryAccess(
  listingId: string,
  message?: string,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const user = await requireAgent();

  const parsed = ShareRequestSchema.safeParse({ listingId, message });
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, agent_id, is_shareable, agents ( user_id )")
    .eq("id", listingId)
    .eq("status", "VERIFIED")
    .maybeSingle();

  if (!listing) return { ok: false, message: "Listing not found." };
  if (listing.agent_id === user.agentId) {
    return { ok: false, message: "This is already your listing." };
  }
  if (!listing.is_shareable) {
    return { ok: false, message: "This agent has not opened this listing to the network." };
  }

  const { error } = await supabase.from("listing_shares").insert({
    listing_id: listingId,
    owner_agent_id: listing.agent_id,
    requester_agent_id: user.agentId,
    status: "REQUESTED",
    request_message: parsed.data.message ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "You have already requested access to this listing." };
    }
    return { ok: false, message: "Could not send the request." };
  }

  const ownerUserId = (listing.agents as { user_id?: string } | null)?.user_id;
  if (ownerUserId) {
    await notify({
      userId: ownerUserId,
      event: "share.requested",
      variables: { agentName: user.fullName, listingTitle: listing.title },
      actionUrl: "/agent/inventory",
      entityType: "LISTING",
      entityId: listingId,
    });
  }

  await recordAudit({
    action: "listing.shared",
    entityType: "LISTING",
    entityId: listingId,
    actorId: user.id,
    actorRole: "agent",
  });

  revalidatePath("/agent/inventory");
  return { ok: true, message: "Access requested. The owning agent will review it." };
}

export async function respondToShareRequest(
  shareId: string,
  decision: "APPROVED" | "REJECTED",
  options: { message?: string; agreedSharePercent?: number } = {},
): Promise<ActionResult> {
  const user = await requireAgent();

  const parsed = ShareResponseSchema.safeParse({ shareId, decision, ...options });
  if (!parsed.success) return { ok: false, message: "Invalid response." };

  const supabase = await createClient();

  // RLS plus a database trigger both prevent the REQUESTER approving their own
  // request; the .eq() here makes the intent explicit at the call site too.
  const { data: share, error } = await supabase
    .from("listing_shares")
    .update({
      status: decision,
      response_message: parsed.data.message ?? null,
      agreed_share_percent:
        parsed.data.agreedSharePercent != null ? String(parsed.data.agreedSharePercent) : null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", shareId)
    .eq("owner_agent_id", user.agentId)
    .eq("status", "REQUESTED")
    .select("id, listing_id, requester_agent_id, listings ( title )")
    .maybeSingle();

  if (error || !share) {
    return { ok: false, message: "Could not update this request." };
  }

  if (decision === "APPROVED" && isAdminClientAvailable()) {
    const admin = createAdminClient();
    const { data: requester } = await admin
      .from("agents")
      .select("user_id")
      .eq("id", share.requester_agent_id)
      .maybeSingle();

    if (requester?.user_id) {
      await notify({
        userId: requester.user_id,
        event: "share.approved",
        variables: {
          listingTitle: (share.listings as { title?: string } | null)?.title ?? "the listing",
        },
        actionUrl: "/agent/inventory",
        entityType: "LISTING",
        entityId: share.listing_id,
      });
    }
  }

  await recordAudit({
    action: decision === "APPROVED" ? "listing.share_approved" : "listing.share_rejected",
    entityType: "LISTING",
    entityId: share.listing_id,
    actorId: user.id,
    actorRole: "agent",
  });

  revalidatePath("/agent/inventory");
  return {
    ok: true,
    message: decision === "APPROVED" ? "Access granted." : "Request declined.",
  };
}

/* ------------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------------ */

const REGION_BY_CITY: Record<string, string> = {
  Noida: "NCR",
  "Greater Noida": "NCR",
  Ghaziabad: "NCR",
  Gurgaon: "NCR",
  Delhi: "NCR",
  Faridabad: "NCR",
  Mumbai: "MUM",
  Thane: "MUM",
  "Navi Mumbai": "MUM",
  Bengaluru: "BLR",
  Lucknow: "LKO",
  Pune: "PNQ",
  Hyderabad: "HYD",
  Chennai: "CHN",
};

function regionFor(city: string): string {
  return REGION_BY_CITY[city] ?? "NCR";
}

/**
 * Compare a new passport against nearby existing ones and queue anything that
 * looks like the same unit for admin adjudication.
 *
 * Runs through the service role because it must see passports the creating
 * agent cannot. Failures are swallowed: duplicate detection is a quality
 * feature, and it must never block an agent from listing.
 */
async function queueDuplicateCandidates(
  propertyId: string,
  candidate: {
    city: string;
    locality: string;
    tower: string | null;
    unitNumber: string | null;
    bedrooms: number | null;
    builtUpArea: number;
    latitude: number | null;
    longitude: number | null;
    price: number;
  },
): Promise<void> {
  if (!isAdminClientAvailable()) return;

  try {
    const admin = createAdminClient();

    const { data: nearby } = await admin
      .from("property_passports")
      .select(
        `id, project_id, tower, unit_number, floor, built_up_area, bedrooms,
         property_addresses ( latitude, longitude, city, locality )`,
      )
      .eq("bedrooms", candidate.bedrooms ?? 0)
      .neq("id", propertyId)
      .limit(50);

    const assessments = (nearby ?? [])
      .map((row) => {
        const address = Array.isArray(row.property_addresses)
          ? row.property_addresses[0]
          : row.property_addresses;

        if (!address || address.city !== candidate.city || address.locality !== candidate.locality) {
          return null;
        }

        const assessment = assessDuplicate(
          {
            id: propertyId,
            tower: candidate.tower,
            unitNumber: candidate.unitNumber,
            builtUpArea: candidate.builtUpArea,
            bedrooms: candidate.bedrooms,
            price: candidate.price,
            coordinates:
              candidate.latitude != null && candidate.longitude != null
                ? { latitude: candidate.latitude, longitude: candidate.longitude }
                : null,
          },
          {
            id: row.id,
            projectId: row.project_id,
            tower: row.tower,
            unitNumber: row.unit_number,
            floor: row.floor,
            builtUpArea: row.built_up_area ? Number(row.built_up_area) : null,
            bedrooms: row.bedrooms,
            coordinates:
              address.latitude != null && address.longitude != null
                ? { latitude: Number(address.latitude), longitude: Number(address.longitude) }
                : null,
          },
        );

        return assessment.confidence >= DUPLICATE_REVIEW_THRESHOLD
          ? { candidateId: row.id, assessment }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (assessments.length === 0) return;

    await admin.from("property_duplicate_candidates").insert(
      assessments.map((item) => ({
        property_id: propertyId,
        candidate_id: item.candidateId,
        confidence: String(item.assessment.confidence),
        signals: { signals: item.assessment.signals } as never,
        status: "PENDING" as const,
      })),
    );
  } catch (error) {
    console.error("[duplicates] detection failed", error);
  }
}

/** Used by the network-inventory page to check access before showing details. */
export async function hasInventoryAccess(listingId: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user?.agentId) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_shares")
    .select("id")
    .eq("listing_id", listingId)
    .eq("requester_agent_id", user.agentId)
    .eq("status", "APPROVED")
    .maybeSingle();

  return Boolean(data);
}
