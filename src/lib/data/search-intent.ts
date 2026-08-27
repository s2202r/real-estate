import "server-only";

import { getAiProvider } from "@/lib/providers/ai";
import { features } from "@/config/features";
import { statesListingType } from "@/lib/domain/search";
import type { ListingSearchFilters } from "./listings";
import type { Enums } from "@/types/database";

/**
 * Turn a typed sentence into filters, server-side.
 *
 * The search box accepts natural language — the placeholder literally suggests
 * "3BHK in Noida Extension under 1.5 Cr" — but pressing Enter previously sent
 * only `?q=`, and a text match on that sentence finds nothing. The structured
 * reading was reachable only by clicking "Understand my query" first, which
 * nobody has to do to expect search to work.
 *
 * So the same parser now runs on the server for every text query. The default
 * provider is rule-based and local: no network call, no cost, no latency.
 *
 * EXPLICIT FILTERS ALWAYS WIN. A value the visitor set through the panel is a
 * decision; a value read out of their sentence is a guess, and a guess must
 * never overwrite a decision.
 */

export interface ResolvedSearch {
  readonly filters: ListingSearchFilters;
  /** "3 BHK · in Noida · up to ₹1.5 Cr", or null when nothing was inferred. */
  readonly interpretation: string | null;
  /** Which filters came from the sentence rather than from the panel. */
  readonly inferred: readonly string[];
}

export async function resolveSearchIntent(
  filters: ListingSearchFilters,
): Promise<ResolvedSearch> {
  const query = filters.query?.trim();
  if (!query || query.length < 2 || !features.ENABLE_AI_SEARCH) {
    return { filters, interpretation: null, inferred: [] };
  }

  let parsed;
  try {
    parsed = await getAiProvider().parseSearchQuery(query);
  } catch {
    // Understanding the query is an enhancement. If it fails, the text search
    // still runs — a search that returns something beats an error page.
    return { filters, interpretation: null, inferred: [] };
  }

  const next: Record<string, unknown> = { ...filters };
  const inferred: string[] = [];

  const fill = (key: keyof ListingSearchFilters, value: unknown, label: string) => {
    if (value === undefined || value === null) return;
    if (filters[key] !== undefined) return; // the panel already decided
    next[key] = value;
    inferred.push(label);
  };

  fill("city", parsed.city, "city");
  fill("locality", parsed.localities?.[0], "locality");
  fill("bedroomsMin", parsed.bedroomsMin, "bedrooms");
  fill("priceMin", parsed.priceMin, "budget");
  fill("priceMax", parsed.priceMax, "budget");

  if (parsed.propertyTypes?.length) {
    fill(
      "propertyTypes",
      parsed.propertyTypes as Enums["property_type"][],
      "property type",
    );
  }

  if (parsed.readyToMove) {
    fill("possession", ["READY_TO_MOVE"] as Enums["possession_status"][], "possession");
  }

  // Only when the sentence actually said so: the parser defaults to SALE, and
  // applying that default would hide every rental from "flats in Noida".
  if (parsed.listingType && statesListingType(query)) {
    fill("listingType", parsed.listingType, "transaction");
  }

  return {
    filters: next as ListingSearchFilters,
    interpretation: inferred.length > 0 ? parsed.interpretation : null,
    inferred,
  };
}
