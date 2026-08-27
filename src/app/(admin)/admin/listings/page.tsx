import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ModerationPanel } from "./moderation-panel";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoneyCompact, fromMajor } from "@/lib/domain/money";
import { calculateListingCompleteness } from "@/lib/domain/scoring";

export const metadata = { title: "Listing moderation" };

/**
 * Listing moderation queue.
 *
 * Each row carries a completeness score and a list of what is MISSING, so the
 * reviewer has a concrete basis for a decision and the agent gets actionable
 * feedback rather than "rejected".
 */
export default async function AdminListingsPage() {
  await requireCapability("listing.moderate");
  const [pending, recent] = await Promise.all([getPending(), getRecentlyModerated()]);

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Awaiting review ({pending.length})</TabsTrigger>
        <TabsTrigger value="recent">Recently decided</TabsTrigger>
      </TabsList>

      <TabsContent value="pending">
        {pending.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Queue is clear"
            description="Every submitted listing has been reviewed."
          />
        ) : (
          <div className="space-y-4">
            {pending.map((listing) => {
              const completeness = calculateListingCompleteness({
                hasImages: listing.cover_image_url ? 1 : 0,
                hasFloorPlan: Boolean(listing.floor_plan_url),
                hasVideoOrTour: Boolean(listing.youtube_url || listing.virtual_tour_url),
                hasDescription: Boolean(listing.description),
                hasAmenities: false,
                hasNearbyPlaces: false,
                hasCoordinates: listing.latitude != null && listing.longitude != null,
                hasReraNumber: false,
                hasDocuments: false,
                hasCarpetArea: listing.carpet_area != null,
              });

              return (
                <Card key={listing.id}>
                  <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_20rem]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge kind="listing" status={listing.status} />
                        <Badge variant="outline" size="sm">
                          {listing.listing_type}
                        </Badge>
                        <Badge
                          variant={
                            completeness.score >= 75
                              ? "success"
                              : completeness.score >= 50
                                ? "warning"
                                : "destructive"
                          }
                          size="sm"
                        >
                          {completeness.score}/100 complete
                        </Badge>
                      </div>

                      <p className="mt-2 font-medium">{listing.title}</p>
                      <p className="tabular mt-1 text-xs text-muted-foreground">
                        {listing.reference_code} · {listing.locality}, {listing.city} ·{" "}
                        {formatMoneyCompact(fromMajor(listing.price, "INR"))} ·{" "}
                        {listing.agents?.agency_name ?? "Agent"}
                      </p>

                      {listing.description && (
                        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                          {listing.description}
                        </p>
                      )}

                      {completeness.missing.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground">Missing:</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {completeness.missing.map((item) => (
                              <Badge key={item} variant="muted" size="sm">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <ModerationPanel
                      listingId={listing.id}
                      suggestedScore={completeness.score}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="recent">
        {recent.length === 0 ? (
          <EmptyState icon={ListChecks} title="Nothing decided yet" />
        ) : (
          <div className="space-y-3">
            {recent.map((listing) => (
              <Card key={listing.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{listing.title}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {listing.reference_code}
                      {listing.rejection_reason ? ` · ${listing.rejection_reason}` : ""}
                    </p>
                  </div>
                  <StatusBadge kind="listing" status={listing.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

interface ListingRow {
  id: string;
  reference_code: string;
  title: string;
  status: string;
  listing_type: string;
  price: string;
  city: string;
  locality: string;
  description: string | null;
  cover_image_url: string | null;
  floor_plan_url: string | null;
  youtube_url: string | null;
  virtual_tour_url: string | null;
  latitude: string | null;
  longitude: string | null;
  carpet_area: string | null;
  rejection_reason: string | null;
  agents: { agency_name: string | null } | null;
}

async function getPending(): Promise<ListingRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      `id, reference_code, title, status, listing_type, price, city, locality, description,
       cover_image_url, floor_plan_url, youtube_url, virtual_tour_url, latitude, longitude,
       carpet_area, rejection_reason, agents ( agency_name )`,
    )
    .in("status", ["SUBMITTED", "UNDER_REVIEW"])
    .order("submitted_at", { ascending: true })
    .limit(50);
  return (data ?? []) as unknown as ListingRow[];
}

async function getRecentlyModerated(): Promise<ListingRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      `id, reference_code, title, status, listing_type, price, city, locality, description,
       cover_image_url, floor_plan_url, youtube_url, virtual_tour_url, latitude, longitude,
       carpet_area, rejection_reason, agents ( agency_name )`,
    )
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(20);
  return (data ?? []) as unknown as ListingRow[];
}
