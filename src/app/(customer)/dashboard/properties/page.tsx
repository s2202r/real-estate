import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PropertyGrid } from "@/components/shared/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { requireCustomerPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { searchListings } from "@/lib/data/listings";
import { calculateMatch, type ListingCandidate, type RequirementInput } from "@/lib/domain/matching";

export const metadata = { title: "Recommended properties" };

/**
 * Recommendations.
 *
 * Matches are computed by the deterministic engine against the customer's own
 * requirements, and the per-dimension breakdown is shown — so a customer who
 * disagrees with a match can see which dimension is wrong and fix the
 * requirement, rather than losing trust in the recommendations.
 */
export default async function RecommendedPage() {
  const user = await requireCustomerPage();
  const requirements = await getActiveRequirements(user.customerId);

  if (requirements.length === 0) {
    const fallback = await searchListings({ pageSize: 6, sort: "newest" });
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Tell us what you are looking for</p>
              <p className="text-sm text-muted-foreground">
                Post a requirement and we will score every verified listing against it.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/requirements">Post a requirement</Link>
            </Button>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-4 text-lg font-semibold">Recently verified</h2>
          {fallback.listings.length > 0 ? (
            <PropertyGrid listings={fallback.listings} />
          ) : (
            <EmptyState icon={Search} title="No listings published yet" />
          )}
        </div>
      </div>
    );
  }

  const requirement = requirements[0]!;
  const candidates = await searchListings({
    city: requirement.city,
    listingType: requirement.listing_type as "SALE" | "RENT" | "LEASE",
    pageSize: 24,
  });

  const scored = candidates.listings
    .map((listing) => ({
      listing,
      match: calculateMatch(toRequirementInput(requirement), toCandidate(listing)),
    }))
    .filter((entry) => entry.match.disqualifiers.length === 0)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 12);

  const matchScores = Object.fromEntries(scored.map((entry) => [entry.listing.id, entry.match.score]));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">
              <Sparkles aria-hidden />
              Matching against
            </Badge>
            <p className="text-sm font-medium">
              {requirement.title ?? `${requirement.listing_type} in ${requirement.city}`}
            </p>
          </div>
          {scored[0] && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Why the top match scores {scored[0].match.score}%
              </p>
              <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {scored[0].match.breakdown.slice(0, 6).map((dimension) => (
                  <div key={dimension.dimension} className="flex items-baseline justify-between gap-2 text-sm">
                    <dt className="capitalize text-muted-foreground">{dimension.dimension}</dt>
                    <dd className="tabular font-medium">{dimension.score}%</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {scored.length > 0 ? (
        <PropertyGrid listings={scored.map((entry) => entry.listing)} matchScores={matchScores} />
      ) : (
        <EmptyState
          icon={Search}
          title="No matches yet"
          description="Nothing on the network matches this requirement right now. Agents can see it and may bring you inventory soon."
        />
      )}
    </div>
  );
}

interface RequirementRow {
  id: string;
  title: string | null;
  listing_type: string;
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

async function getActiveRequirements(customerId: string): Promise<RequirementRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_requirements")
    .select(
      "id, title, listing_type, property_type, city, localities, budget_min, budget_max, min_area, max_area, bedrooms_min, bedrooms_max, amenities",
    )
    .eq("customer_id", customerId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1);
  return (data ?? []) as RequirementRow[];
}

function toRequirementInput(row: RequirementRow): RequirementInput {
  return {
    id: row.id,
    listingType: row.listing_type as RequirementInput["listingType"],
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
