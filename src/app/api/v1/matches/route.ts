import { z } from "zod";
import { withApi, ApiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { searchListings } from "@/lib/data/listings";
import { calculateMatch, type ListingCandidate, type RequirementInput } from "@/lib/domain/matching";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/matches?requirementId=...
 *
 * Scores verified listings against a customer requirement.
 *
 * The `agentQuality` dimension is STRIPPED from customer-facing responses
 * (§13): internal agent standing informs ranking but is never published, since
 * it would immediately become a target to game.
 */
const QuerySchema = z.object({
  requirementId: z.string().uuid(),
  minimumScore: z.coerce.number().min(0).max(100).default(50),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApi(
  {
    auth: true,
    querySchema: QuerySchema,
    rateLimit: { scope: "api:matches", limit: 60, windowSeconds: 60 },
  },
  async ({ query, user }) => {
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, "not_configured", "Database is not configured.");
    }

    const supabase = await createClient();

    // RLS restricts this read to the requirement's owner (or an admin), so a
    // caller cannot score someone else's requirement by guessing an id.
    const { data: requirement } = await supabase
      .from("customer_requirements")
      .select("*")
      .eq("id", query.requirementId)
      .maybeSingle();

    if (!requirement) {
      throw new ApiError(404, "not_found", "Requirement not found.");
    }

    const candidates = await searchListings({
      city: requirement.city,
      listingType: requirement.listing_type,
      pageSize: 50,
    });

    const isCustomerView = !user?.adminRole;

    const matches = candidates.listings
      .map((listing) =>
        calculateMatch(toRequirement(requirement), toCandidate(listing)),
      )
      .filter((match) => match.disqualifiers.length === 0 && match.score >= query.minimumScore)
      .sort((a, b) => b.score - a.score || (a.listingId < b.listingId ? -1 : 1))
      .slice(0, query.limit)
      .map((match) => ({
        ...match,
        breakdown: isCustomerView
          ? match.breakdown.filter((dimension) => dimension.dimension !== "agentQuality")
          : match.breakdown,
      }));

    return {
      data: matches,
      meta: { requirementId: query.requirementId, evaluated: candidates.listings.length },
    };
  },
);

interface RequirementRow {
  id: string;
  listing_type: "SALE" | "RENT" | "LEASE";
  property_type: string[];
  city: string;
  localities: string[];
  budget_min: string | null;
  budget_max: string;
  min_area: string | null;
  max_area: string | null;
  bedrooms_min: number | null;
  bedrooms_max: number | null;
  amenities: string[];
}

function toRequirement(row: RequirementRow): RequirementInput {
  return {
    id: row.id,
    listingType: row.listing_type,
    propertyTypes: row.property_type ?? [],
    city: row.city,
    localities: row.localities ?? [],
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    minArea: row.min_area ? Number(row.min_area) : null,
    maxArea: row.max_area ? Number(row.max_area) : null,
    bedroomsMin: row.bedrooms_min,
    bedroomsMax: row.bedrooms_max,
    amenities: row.amenities ?? [],
  };
}

function toCandidate(listing: {
  id: string;
  listingType: string;
  propertyType: string;
  city: string;
  locality: string;
  price: string;
  builtUpArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  facing: string | null;
  furnishing: string;
  possessionStatus: string;
  latitude: number | null;
  longitude: number | null;
  verificationScore: number;
}): ListingCandidate {
  return {
    id: listing.id,
    listingType: listing.listingType as ListingCandidate["listingType"],
    propertyType: listing.propertyType,
    city: listing.city,
    locality: listing.locality,
    price: listing.price,
    builtUpArea: listing.builtUpArea,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    facing: listing.facing as ListingCandidate["facing"],
    furnishing: listing.furnishing as ListingCandidate["furnishing"],
    possessionStatus: listing.possessionStatus as ListingCandidate["possessionStatus"],
    coordinates:
      listing.latitude != null && listing.longitude != null
        ? { latitude: listing.latitude, longitude: listing.longitude }
        : null,
    verificationScore: listing.verificationScore,
    isVerified: true,
  };
}
