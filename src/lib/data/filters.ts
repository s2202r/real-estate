import { z } from "zod";
import type { ListingSearchFilters, ListingSort } from "./listings";
import type { AgentSearchFilters } from "./agents";
import type { Enums } from "@/types/database";
import { supportedCities } from "@/config/app";

/**
 * Parse URL search params into typed listing filters.
 *
 * Search parameters are user input arriving over the wire, so they are
 * validated rather than trusted: a malformed `priceMin=abc` is dropped, not
 * passed to the database, and multi-value params are capped so a crafted URL
 * cannot build an enormous `IN (...)` clause.
 */

const listingTypes = ["SALE", "RENT", "LEASE"] as const;
const sorts = ["relevance", "price_asc", "price_desc", "newest", "area_desc"] as const;

const numberParam = z.coerce.number().finite().nonnegative().optional().catch(undefined);

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function multi<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  max = 12,
): T[] | undefined {
  const raw = first(value);
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is T => (allowed as readonly string[]).includes(item))
    .slice(0, max);
  return values.length > 0 ? values : undefined;
}

const PROPERTY_TYPES = [
  "APARTMENT", "INDEPENDENT_HOUSE", "VILLA", "BUILDER_FLOOR", "PENTHOUSE", "STUDIO",
  "PLOT", "FARMHOUSE", "OFFICE", "SHOP", "SHOWROOM", "WAREHOUSE", "INDUSTRIAL",
  "CO_WORKING", "SERVICED_APARTMENT", "OTHER",
] as const satisfies readonly Enums["property_type"][];

const FACINGS = [
  "NORTH", "SOUTH", "EAST", "WEST", "NORTH_EAST", "NORTH_WEST", "SOUTH_EAST", "SOUTH_WEST",
] as const satisfies readonly Enums["facing_direction"][];

const FURNISHINGS = [
  "UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED",
] as const satisfies readonly Enums["furnishing_status"][];

const POSSESSIONS = [
  "READY_TO_MOVE", "UNDER_CONSTRUCTION", "NEW_LAUNCH", "RESALE",
] as const satisfies readonly Enums["possession_status"][];

const SUPPORTED_CITY_NAMES: readonly string[] = supportedCities.map((city) => city.name);

export function parseListingFilters(
  params: Record<string, string | string[] | undefined>,
): ListingSearchFilters {
  const bedrooms = multi(params.bedrooms, ["1", "2", "3", "4", "5"] as const)?.map(Number);
  const listingType = multi(params.listingType, listingTypes, 1)?.[0];
  const sortRaw = first(params.sort);
  const sort = (sorts as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as ListingSort)
    : "newest";

  return {
    query: first(params.q)?.slice(0, 120) || undefined,
    city: first(params.city)?.slice(0, 80) || undefined,
    locality: first(params.locality)?.slice(0, 80) || undefined,
    listingType,
    propertyTypes: multi(params.type, PROPERTY_TYPES),
    priceMin: numberParam.parse(first(params.priceMin)),
    priceMax: numberParam.parse(first(params.priceMax)),
    // Bedroom chips are a set, but the query is a range; use its bounds.
    bedroomsMin: bedrooms?.length ? Math.min(...bedrooms) : undefined,
    bedroomsMax: bedrooms?.length ? Math.max(...bedrooms) : undefined,
    areaMin: numberParam.parse(first(params.areaMin)),
    areaMax: numberParam.parse(first(params.areaMax)),
    facing: multi(params.facing, FACINGS),
    furnishing: multi(params.furnishing, FURNISHINGS),
    possession: multi(params.possession, POSSESSIONS),
    reraVerifiedOnly: first(params.rera) === "1",
    withVirtualTour: first(params.tour) === "1",
    exclusiveOnly: first(params.exclusive) === "1",
    sort,
    page: Math.max(1, Number(first(params.page) ?? 1) || 1),
  };
}

/**
 * Parse URL search params into typed agent-directory filters.
 *
 * Same discipline as the listing parser: a value the query cannot honour is
 * dropped rather than passed through, so a crafted URL cannot reach the
 * database with anything the panel could not have produced.
 */
export function parseAgentFilters(
  params: Record<string, string | string[] | undefined>,
): AgentSearchFilters {
  const city = first(params.city)?.slice(0, 80) || undefined;

  return {
    // Only cities the platform is actually live in are accepted.
    city: SUPPORTED_CITY_NAMES.includes(city ?? "") ? city : undefined,
    locality: first(params.locality)?.slice(0, 80) || undefined,
    language: first(params.language)?.slice(0, 40) || undefined,
    propertyType: multi(params.specialisation, PROPERTY_TYPES, 1)?.[0],
    verifiedOnly: first(params.rera) === "1",
    page: Math.max(1, Number(first(params.page) ?? 1) || 1),
  };
}
