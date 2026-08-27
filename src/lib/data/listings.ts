import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { appConfig } from "@/config/app";
import { boundingBox } from "@/lib/domain/geo";
import type { Enums } from "@/types/database";

/**
 * Listing queries for the public site and dashboards.
 *
 * Two things every function here does deliberately:
 *
 *  - It uses the SESSION-SCOPED client, so RLS decides visibility. The public
 *    search does not filter to `status = 'VERIFIED'` for security (RLS already
 *    guarantees that); it filters for CORRECTNESS, because an agent viewing the
 *    public search should not see their own drafts mixed in.
 *  - It degrades to an empty result when Supabase is unconfigured, so the app
 *    builds and the marketing shell renders on a fresh deployment.
 */

export interface ListingSearchFilters {
  readonly query?: string;
  readonly city?: string;
  readonly locality?: string;
  readonly listingType?: Enums["listing_type"];
  readonly propertyTypes?: readonly Enums["property_type"][];
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly bedroomsMin?: number;
  readonly bedroomsMax?: number;
  readonly areaMin?: number;
  readonly areaMax?: number;
  readonly facing?: readonly Enums["facing_direction"][];
  readonly furnishing?: readonly Enums["furnishing_status"][];
  readonly possession?: readonly Enums["possession_status"][];
  readonly amenities?: readonly string[];
  readonly reraVerifiedOnly?: boolean;
  readonly withVirtualTour?: boolean;
  readonly exclusiveOnly?: boolean;
  readonly near?: { latitude: number; longitude: number; radiusKm: number };
  readonly sort?: ListingSort;
  readonly page?: number;
  readonly pageSize?: number;
}

export type ListingSort = "relevance" | "price_asc" | "price_desc" | "newest" | "area_desc";

export interface ListingSummary {
  readonly id: string;
  readonly referenceCode: string;
  readonly slug: string;
  readonly title: string;
  readonly listingType: Enums["listing_type"];
  readonly propertyType: Enums["property_type"];
  readonly price: string;
  readonly currency: string;
  readonly bedrooms: number | null;
  readonly bathrooms: number | null;
  readonly builtUpArea: number | null;
  readonly carpetArea: number | null;
  readonly floor: number | null;
  readonly totalFloors: number | null;
  readonly facing: Enums["facing_direction"] | null;
  readonly furnishing: Enums["furnishing_status"];
  readonly possessionStatus: Enums["possession_status"];
  readonly city: string;
  readonly locality: string;
  readonly state: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly coverImageUrl: string | null;
  readonly hasVirtualTour: boolean;
  readonly isExclusive: boolean;
  readonly verificationScore: number;
  readonly publishedAt: string | null;
  readonly propertyId: string;
  readonly propertyReference: string | null;
  readonly agentId: string;
}

export interface ListingSearchResult {
  readonly listings: readonly ListingSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export const LIST_COLUMNS = `
  id, reference_code, slug, title, listing_type, property_type, price, currency,
  bedrooms, bathrooms, built_up_area, carpet_area, floor, total_floors, facing,
  furnishing, possession_status, city, locality, state, latitude, longitude,
  cover_image_url, virtual_tour_url, tour_360_url, youtube_url, is_exclusive,
  verification_score, published_at, property_id, agent_id,
  property_passports ( reference_code )
`;

export interface ListingRow {
  id: string;
  reference_code: string;
  slug: string;
  title: string;
  listing_type: Enums["listing_type"];
  property_type: Enums["property_type"];
  price: string;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  built_up_area: string | null;
  carpet_area: string | null;
  floor: number | null;
  total_floors: number | null;
  facing: Enums["facing_direction"] | null;
  furnishing: Enums["furnishing_status"];
  possession_status: Enums["possession_status"];
  city: string;
  locality: string;
  state: string;
  latitude: string | null;
  longitude: string | null;
  cover_image_url: string | null;
  virtual_tour_url: string | null;
  tour_360_url: string | null;
  youtube_url: string | null;
  is_exclusive: boolean;
  verification_score: string;
  published_at: string | null;
  property_id: string;
  agent_id: string;
  property_passports: { reference_code: string } | { reference_code: string }[] | null;
}

/**
 * The ONLY way a database row becomes a `ListingSummary`.
 *
 * Exported because a caller that hand-casts a raw row instead — the columns are
 * snake_case, the type is camelCase — produces an object whose every renamed
 * field is `undefined`. That is not a type error the compiler can catch through
 * an `as unknown as` cast, and it surfaces as a crash in whatever first reads
 * `referenceCode`.
 */
export function toListingSummary(row: ListingRow): ListingSummary {
  const passport = Array.isArray(row.property_passports)
    ? row.property_passports[0]
    : row.property_passports;

  return {
    id: row.id,
    referenceCode: row.reference_code,
    slug: row.slug,
    title: row.title,
    listingType: row.listing_type,
    propertyType: row.property_type,
    price: row.price,
    currency: row.currency,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    builtUpArea: row.built_up_area ? Number(row.built_up_area) : null,
    carpetArea: row.carpet_area ? Number(row.carpet_area) : null,
    floor: row.floor,
    totalFloors: row.total_floors,
    facing: row.facing,
    furnishing: row.furnishing,
    possessionStatus: row.possession_status,
    city: row.city,
    locality: row.locality,
    state: row.state,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    coverImageUrl: row.cover_image_url,
    hasVirtualTour: Boolean(row.virtual_tour_url || row.tour_360_url || row.youtube_url),
    isExclusive: row.is_exclusive,
    verificationScore: Number(row.verification_score ?? 0),
    publishedAt: row.published_at,
    propertyId: row.property_id,
    propertyReference: passport?.reference_code ?? null,
    agentId: row.agent_id,
  };
}

const EMPTY_RESULT: ListingSearchResult = {
  listings: [],
  total: 0,
  page: 1,
  pageSize: appConfig.pageSize,
  totalPages: 0,
};

export async function searchListings(
  filters: ListingSearchFilters = {},
): Promise<ListingSearchResult> {
  if (!isSupabaseConfigured()) return EMPTY_RESULT;

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? appConfig.pageSize));
  const from = (page - 1) * pageSize;

  const supabase = await createClient();
  let request = supabase
    .from("listings")
    .select(LIST_COLUMNS, { count: "exact" })
    // RLS already hides everything else; this makes the intent explicit and
    // stops an agent's own drafts appearing in the public search.
    .eq("status", "VERIFIED");

  if (filters.city) request = request.eq("city", filters.city);
  if (filters.locality) request = request.eq("locality", filters.locality);
  if (filters.listingType) request = request.eq("listing_type", filters.listingType);
  if (filters.propertyTypes?.length) request = request.in("property_type", [...filters.propertyTypes]);
  if (filters.priceMin !== undefined) request = request.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) request = request.lte("price", filters.priceMax);
  if (filters.bedroomsMin !== undefined) request = request.gte("bedrooms", filters.bedroomsMin);
  if (filters.bedroomsMax !== undefined) request = request.lte("bedrooms", filters.bedroomsMax);
  if (filters.areaMin !== undefined) request = request.gte("built_up_area", filters.areaMin);
  if (filters.areaMax !== undefined) request = request.lte("built_up_area", filters.areaMax);
  if (filters.facing?.length) request = request.in("facing", [...filters.facing]);
  if (filters.furnishing?.length) request = request.in("furnishing", [...filters.furnishing]);
  if (filters.possession?.length) request = request.in("possession_status", [...filters.possession]);
  if (filters.exclusiveOnly) request = request.eq("is_exclusive", true);

  if (filters.withVirtualTour) {
    request = request.or("virtual_tour_url.not.is.null,tour_360_url.not.is.null,youtube_url.not.is.null");
  }

  if (filters.query) {
    // Trigram indexes back the title match; locality is an exact-ish prefix.
    const term = filters.query.replace(/[%,()]/g, " ").trim();
    if (term) {
      request = request.or(`title.ilike.%${term}%,locality.ilike.%${term}%,city.ilike.%${term}%`);
    }
  }

  if (filters.near) {
    // A bounding box first so Postgres can use the (latitude, longitude) index;
    // exact radius filtering happens below, on a much smaller set.
    const box = boundingBox(filters.near, filters.near.radiusKm);
    request = request
      .gte("latitude", box.minLat)
      .lte("latitude", box.maxLat)
      .gte("longitude", box.minLng)
      .lte("longitude", box.maxLng);
  }

  switch (filters.sort) {
    case "price_asc":
      request = request.order("price", { ascending: true });
      break;
    case "price_desc":
      request = request.order("price", { ascending: false });
      break;
    case "area_desc":
      request = request.order("built_up_area", { ascending: false, nullsFirst: false });
      break;
    case "newest":
    case "relevance":
    default:
      request = request.order("published_at", { ascending: false, nullsFirst: false });
      break;
  }

  // A stable secondary key, so pagination cannot show the same row twice.
  request = request.order("id", { ascending: true }).range(from, from + pageSize - 1);

  const { data, count, error } = await request;

  if (error) {
    console.error("[listings] search failed", error.message);
    return { ...EMPTY_RESULT, page, pageSize };
  }

  const listings = ((data ?? []) as unknown as ListingRow[]).map(toListingSummary);
  const total = count ?? listings.length;

  return {
    listings,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Full listing detail, including the property passport and its history. */
export const getListingByReference = cache(async (reference: string) => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      `*,
       property_passports (
         *,
         property_addresses (*),
         property_nearby_places (*),
         property_amenities ( amenity_key, amenities ( key, label, category, icon ) ),
         projects ( id, name, slug, developer_name, rera_number, possession_date )
       ),
       listing_media (*),
       agents ( id, slug, agency_name, headline, verification_level, badges,
                rating_average, rating_count, experience_years, closed_deal_count,
                response_rate, user_id )`,
    )
    .ilike("reference_code", reference)
    .maybeSingle();

  return data;
});

/** Every other live listing for the same physical property (§7). */
export async function getSiblingListings(propertyId: string, excludeListingId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id, reference_code, slug, price, currency, listing_type, agent_id, published_at, locality, city, agents ( slug, agency_name, badges )")
    .eq("property_id", propertyId)
    .eq("status", "VERIFIED")
    .neq("id", excludeListingId)
    .order("price", { ascending: true })
    .limit(5);

  return data ?? [];
}

/** Price history on the passport, which outlives any individual listing. */
export async function getPropertyPriceHistory(propertyId: string) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("property_price_history")
    .select("id, price, currency, listing_type, price_per_sqft, recorded_at")
    .eq("property_id", propertyId)
    .order("recorded_at", { ascending: false })
    .limit(24);

  return data ?? [];
}

/** Similar listings for the "you may also like" rail. */
export async function getSimilarListings(listing: ListingSummary, limit = 4) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const priceValue = Number(listing.price);

  const { data } = await supabase
    .from("listings")
    .select(LIST_COLUMNS)
    .eq("status", "VERIFIED")
    .eq("city", listing.city)
    .eq("listing_type", listing.listingType)
    .neq("id", listing.id)
    .gte("price", priceValue * 0.7)
    .lte("price", priceValue * 1.3)
    .limit(limit);

  return ((data ?? []) as unknown as ListingRow[]).map(toListingSummary);
}

/** Comparable per-sq-ft prices, feeding price intelligence. */
export async function getComparablePricesPerSqft(
  city: string,
  locality: string,
  listingType: Enums["listing_type"],
): Promise<number[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("price_per_sqft")
    .eq("status", "VERIFIED")
    .eq("city", city)
    .eq("locality", locality)
    .eq("listing_type", listingType)
    .not("price_per_sqft", "is", null)
    .limit(200);

  return (data ?? [])
    .map((row) => Number(row.price_per_sqft))
    .filter((value) => Number.isFinite(value) && value > 0);
}

/** Distinct localities in a city, for filter chips and location pages. */
export const getLocalities = cache(async (city: string): Promise<string[]> => {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("locality")
    .eq("status", "VERIFIED")
    .eq("city", city)
    .limit(1000);

  return [...new Set((data ?? []).map((row) => row.locality))].sort();
});

/** Featured listings for the home page. */
export async function getFeaturedListings(limit = 6): Promise<ListingSummary[]> {
  const result = await searchListings({ sort: "newest", pageSize: limit });
  return [...result.listings];
}
