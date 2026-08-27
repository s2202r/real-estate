import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyGrid } from "@/components/shared/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { requireCustomer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import type { ListingSummary } from "@/lib/data/listings";

export const metadata = { title: "Saved properties" };

export default async function FavoritesPage() {
  const user = await requireCustomer();
  const listings = await getFavourites(user.customerId);

  return (
    <div>
      <p className="mb-5 text-sm text-muted-foreground">
        {listings.length} saved {listings.length === 1 ? "property" : "properties"}. Compare them
        side by side, then book visits for your shortlist.
      </p>

      {listings.length > 0 ? (
        <PropertyGrid listings={listings} />
      ) : (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on any property to keep it here while you decide."
          action={
            <Button asChild>
              <Link href="/properties">Browse properties</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

async function getFavourites(customerId: string): Promise<ListingSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select(
      `listings (
         id, reference_code, slug, title, listing_type, property_type, price, currency,
         bedrooms, bathrooms, built_up_area, carpet_area, floor, total_floors, facing,
         furnishing, possession_status, city, locality, state, latitude, longitude,
         cover_image_url, virtual_tour_url, tour_360_url, youtube_url, is_exclusive,
         verification_score, published_at, property_id, agent_id,
         property_passports ( reference_code )
       )`,
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  return (data ?? [])
    .map((row) => row.listings)
    .filter(Boolean)
    .map((listing) => normalise(listing as Record<string, unknown>));
}

/**
 * Map a raw listing row onto the card's view model. Numeric columns arrive as
 * strings from PostgREST, so they are converted here rather than in the card.
 */
function normalise(row: Record<string, unknown>): ListingSummary {
  const passport = row.property_passports as { reference_code?: string } | null;
  const num = (value: unknown) => (value == null ? null : Number(value));

  return {
    id: String(row.id),
    referenceCode: String(row.reference_code),
    slug: String(row.slug),
    title: String(row.title),
    listingType: row.listing_type as ListingSummary["listingType"],
    propertyType: row.property_type as ListingSummary["propertyType"],
    price: String(row.price),
    currency: String(row.currency),
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    builtUpArea: num(row.built_up_area),
    carpetArea: num(row.carpet_area),
    floor: num(row.floor),
    totalFloors: num(row.total_floors),
    facing: (row.facing ?? null) as ListingSummary["facing"],
    furnishing: row.furnishing as ListingSummary["furnishing"],
    possessionStatus: row.possession_status as ListingSummary["possessionStatus"],
    city: String(row.city),
    locality: String(row.locality),
    state: String(row.state),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    coverImageUrl: (row.cover_image_url ?? null) as string | null,
    hasVirtualTour: Boolean(row.virtual_tour_url || row.tour_360_url || row.youtube_url),
    isExclusive: Boolean(row.is_exclusive),
    verificationScore: Number(row.verification_score ?? 0),
    publishedAt: (row.published_at ?? null) as string | null,
    propertyId: String(row.property_id),
    propertyReference: passport?.reference_code ?? null,
    agentId: String(row.agent_id),
  };
}
