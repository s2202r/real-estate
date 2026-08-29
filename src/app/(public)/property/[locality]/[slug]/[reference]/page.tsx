import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Compass,
  Fingerprint,
  History,
  Info,
  Layers,
  MapPin,
  Sofa,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PropertyGallery, type GalleryItem } from "@/components/shared/property-gallery";
import { PriceDisplay, RentDisplay } from "@/components/shared/price-display";
import { LocationScoreCard } from "@/components/shared/location-score";
import { EnquiryPanel, StickyEnquiryBar } from "@/components/shared/enquiry-panel";
import { VerificationBadgeList, VerifiedListingBadge } from "@/components/shared/verification-badge";
import { PropertyGrid } from "@/components/shared/property-card";
import {
  getComparablePricesPerSqft,
  getListingByReference,
  getPropertyPriceHistory,
  getSiblingListings,
  getSimilarListings,
  type ListingSummary,
} from "@/lib/data/listings";
import { calculateLocationScore, calculatePriceIntelligence, type NearbyPlace } from "@/lib/domain/scoring";
import { formatMoney, fromMajor } from "@/lib/domain/money";
import { getSessionUser } from "@/lib/auth/session";
import { appConfig } from "@/config/app";
import { listingPath } from "@/lib/domain/references";
import type { Enums } from "@/types/database";

export const revalidate = 600;

type PageProps = {
  params: Promise<{ locality: string; slug: string; reference: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reference, locality, slug } = await params;
  const listing = await getListingByReference(reference);

  if (!listing) {
    return { title: "Property not found", robots: { index: false, follow: false } };
  }

  const canonical = `${appConfig.url}${listingPath({ locality, slug, reference })}`;
  const price = formatMoney(fromMajor(listing.price, "INR"));
  const description =
    listing.seo_description ??
    `${listing.title} at ${price}. Verified listing with a permanent property passport on ${appConfig.name}.`;

  return {
    title: listing.title,
    description: description.slice(0, 160),
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: listing.title,
      description: description.slice(0, 200),
      images: listing.cover_image_url ? [{ url: listing.cover_image_url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: listing.title,
      description: description.slice(0, 200),
      images: listing.cover_image_url ? [listing.cover_image_url] : undefined,
    },
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { reference, locality, slug } = await params;
  const [listing, user] = await Promise.all([getListingByReference(reference), getSessionUser()]);

  if (!listing) notFound();

  const passport = listing.property_passports as PassportShape | null;
  const address = firstOf(passport?.property_addresses);
  const agent = listing.agents as AgentShape | null;
  const project = firstOf(passport?.projects);

  const [siblings, priceHistory, comparables] = await Promise.all([
    getSiblingListings(listing.property_id, listing.id),
    getPropertyPriceHistory(listing.property_id),
    getComparablePricesPerSqft(listing.city, listing.locality, listing.listing_type),
  ]);

  const nearbyPlaces: NearbyPlace[] = (passport?.property_nearby_places ?? []).map((place) => ({
    placeType: place.place_type as NearbyPlace["placeType"],
    name: place.name,
    distanceKm: Number(place.distance_km),
  }));

  const locationScore = calculateLocationScore(nearbyPlaces);
  const priceIntelligence = calculatePriceIntelligence(
    listing.price,
    listing.built_up_area ? Number(listing.built_up_area) : null,
    comparables,
  );

  const gallery = buildGallery(listing);
  const isRental = listing.listing_type === "RENT" || listing.listing_type === "LEASE";
  const canonical = `${appConfig.url}${listingPath({ locality, slug, reference })}`;

  const similar = await getSimilarListings(
    {
      id: listing.id,
      city: listing.city,
      listingType: listing.listing_type,
      price: listing.price,
    } as ListingSummary,
    3,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-16">
      <script
        type="application/ld+json"
        // Built from a typed object, not string concatenation, so the payload
        // cannot be used to inject markup.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildJsonLd(listing, address, canonical)),
        }}
      />

      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/properties" className="hover:text-foreground">
              Properties
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/properties?city=${encodeURIComponent(listing.city)}`} className="hover:text-foreground">
              {listing.city}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground">{listing.locality}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          <PropertyGallery items={gallery} title={listing.title} />

          {/* Headline */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <VerifiedListingBadge score={Number(listing.verification_score ?? 0)} />
              {listing.is_exclusive && <Badge variant="warning">🔥 Platform Exclusive</Badge>}
              <Badge variant="outline">
                {listing.listing_type === "SALE" ? "For sale" : "For rent"}
              </Badge>
              {passport?.rera_number && <Badge variant="info">RERA {passport.rera_number}</Badge>}
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{listing.title}</h1>

            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {address?.address_line1 ? `${address.address_line1}, ` : ""}
              {listing.locality}, {listing.city}, {listing.state}
              {address?.pincode ? ` ${address.pincode}` : ""}
            </p>

            <div className="mt-5 flex flex-wrap items-end gap-6">
              {isRental ? (
                <RentDisplay amount={listing.price} />
              ) : (
                <PriceDisplay
                  amount={listing.price}
                  areaSqft={listing.built_up_area ? Number(listing.built_up_area) : null}
                  size="xl"
                  compact={false}
                />
              )}
              {listing.is_negotiable && <Badge variant="secondary">Negotiable</Badge>}
            </div>
          </div>

          {/* Key facts */}
          <Card>
            <CardContent className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
              <Fact icon={Building2} label="Type" value={humanise(listing.property_type)} />
              <Fact
                icon={Layers}
                label="Configuration"
                value={listing.bedrooms ? `${listing.bedrooms} BHK` : "—"}
              />
              <Fact
                icon={Sofa}
                label="Furnishing"
                value={humanise(listing.furnishing)}
              />
              <Fact
                icon={Compass}
                label="Facing"
                value={listing.facing ? humanise(listing.facing) : "—"}
              />
              <Fact
                icon={Layers}
                label="Built-up area"
                value={listing.built_up_area ? `${Number(listing.built_up_area).toLocaleString("en-IN")} sq ft` : "—"}
              />
              <Fact
                icon={Layers}
                label="Carpet area"
                value={listing.carpet_area ? `${Number(listing.carpet_area).toLocaleString("en-IN")} sq ft` : "—"}
              />
              <Fact
                icon={Building2}
                label="Floor"
                value={
                  listing.floor != null
                    ? `${listing.floor}${listing.total_floors ? ` of ${listing.total_floors}` : ""}`
                    : "—"
                }
              />
              <Fact
                icon={CalendarDays}
                label="Possession"
                value={humanise(listing.possession_status)}
              />
            </CardContent>
          </Card>

          {/* Description */}
          {listing.description && (
            <section>
              <h2 className="text-lg font-semibold">About this property</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {listing.description}
              </p>
              {listing.highlights && listing.highlights.length > 0 && (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {listing.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2 text-sm">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Amenities */}
          {(passport?.property_amenities?.length ?? 0) > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Amenities</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {passport!.property_amenities!.map((entry) => (
                  <Badge key={entry.amenity_key} variant="secondary" size="lg">
                    {firstOf(entry.amenities)?.label ?? humanise(entry.amenity_key)}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Property Passport — the differentiator */}
          <section>
            <div className="flex items-center gap-2">
              <Fingerprint className="size-5 text-primary" aria-hidden />
              <h2 className="text-lg font-semibold">Property Passport</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This physical property has one permanent identity on the network. Its history follows
              the property, not the advertisement — so it survives this listing expiring.
            </p>

            <Card className="mt-4">
              <CardContent className="grid gap-5 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Passport ID</p>
                  <p className="tabular mt-1 font-mono text-sm font-semibold">
                    {passport?.reference_code ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Verification score
                  </p>
                  <p className="tabular mt-1 text-sm font-semibold">
                    {Math.round(Number(passport?.verification_score ?? 0))}/100
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Last verified
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {passport?.last_verified_at
                      ? new Date(passport.last_verified_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>

                {project && (
                  <div className="sm:col-span-3">
                    <Separator className="mb-4" />
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                    <p className="mt-1 text-sm font-semibold">{project.name}</p>
                    {project.developer_name && (
                      <p className="text-xs text-muted-foreground">by {project.developer_name}</p>
                    )}
                  </div>
                )}

                <dl className="grid gap-4 sm:col-span-3 sm:grid-cols-4">
                  <Stat label="Listings" value={passport?.listing_count ?? 0} />
                  <Stat label="Visits" value={passport?.visit_count ?? 0} />
                  <Stat label="Enquiries" value={passport?.enquiry_count ?? 0} />
                  <Stat label="Saved by" value={passport?.favourite_count ?? 0} />
                </dl>
              </CardContent>
            </Card>

            {/* Other agents on the same property */}
            {siblings.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4" aria-hidden />
                    Also offered by {siblings.length} other{" "}
                    {siblings.length === 1 ? "agent" : "agents"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Several agents in the network hold this property. Prices may differ; the
                    property is the same.
                  </p>
                  {siblings.map((sibling) => (
                    <div
                      key={sibling.id}
                      className="flex items-center justify-between gap-4 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {firstOf(sibling.agents as AgentShape | AgentShape[] | null)?.agency_name ??
                            "Network agent"}
                        </p>
                        <p className="tabular text-xs text-muted-foreground">
                          {sibling.reference_code}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <PriceDisplay amount={sibling.price} size="sm" />
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={listingPath({
                              locality: sibling.locality,
                              slug: sibling.slug,
                              reference: sibling.reference_code,
                            })}
                          >
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Price history */}
            {priceHistory.length > 1 && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="size-4" aria-hidden />
                    Price history
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {priceHistory.slice(0, 6).map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
                      >
                        <span className="text-muted-foreground">
                          {new Date(entry.recorded_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="tabular font-medium">
                          {formatMoney(fromMajor(entry.price, "INR"))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Nearby */}
          {nearbyPlaces.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">What is nearby</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {nearbyPlaces.slice(0, 8).map((place) => (
                  <div
                    key={`${place.placeType}-${place.name}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">{humanise(place.placeType)}: </span>
                      {place.name}
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {place.distanceKm} km
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <EnquiryPanel
            listingId={listing.id}
            propertyId={listing.property_id}
            agentName={agent?.agency_name ?? "The listing agent"}
            isAuthenticated={Boolean(user)}
          />

          {agent && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Listed by</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{agent.agency_name ?? "Network agent"}</p>
                  {agent.headline && (
                    <p className="text-xs text-muted-foreground">{agent.headline}</p>
                  )}
                </div>

                <VerificationBadgeList badges={agent.badges ?? []} />

                <dl className="grid grid-cols-3 gap-3 border-t pt-3 text-center">
                  <div>
                    <dt className="text-xs text-muted-foreground">Rating</dt>
                    <dd className="tabular text-sm font-semibold">
                      {Number(agent.rating_average ?? 0).toFixed(1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Deals</dt>
                    <dd className="tabular text-sm font-semibold">{agent.closed_deal_count ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Experience</dt>
                    <dd className="tabular text-sm font-semibold">
                      {agent.experience_years ?? 0}y
                    </dd>
                  </div>
                </dl>

                <Button asChild variant="outline" className="w-full">
                  <Link href={`/agent/${agent.slug}`}>
                    View profile
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <LocationScoreCard score={locationScore} />

          {/* Price intelligence, always with its disclaimer (L7) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4" aria-hidden />
                Price check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {priceIntelligence.verdict === "INSUFFICIENT_DATA" ? (
                <p className="text-sm text-muted-foreground">
                  Not enough comparable listings in {listing.locality} yet to offer a comparison.
                </p>
              ) : (
                <>
                  <Badge
                    variant={
                      priceIntelligence.verdict === "BELOW_MARKET"
                        ? "success"
                        : priceIntelligence.verdict === "ABOVE_MARKET"
                          ? "warning"
                          : "info"
                    }
                    size="lg"
                  >
                    {priceIntelligence.label}
                  </Badge>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">This property</dt>
                      <dd className="tabular font-medium">
                        ₹{priceIntelligence.pricePerSqft?.toLocaleString("en-IN")}/sq ft
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Locality median ({priceIntelligence.sampleSize} listings)
                      </dt>
                      <dd className="tabular font-medium">
                        ₹{priceIntelligence.medianPricePerSqft?.toLocaleString("en-IN")}/sq ft
                      </dd>
                    </div>
                  </dl>
                </>
              )}
              <p className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {priceIntelligence.disclaimer}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-semibold">Similar properties in {listing.city}</h2>
          <div className="mt-5">
            <PropertyGrid listings={similar} />
          </div>
        </section>
      )}

      <StickyEnquiryBar listingId={listing.id} isAuthenticated={Boolean(user)} />
    </div>
  );
}

/* ------------------------------------------------------------------------ *
 * Shapes and helpers
 * ------------------------------------------------------------------------ */

interface PassportShape {
  reference_code: string;
  verification_score: string | null;
  last_verified_at: string | null;
  listing_count: number;
  visit_count: number;
  enquiry_count: number;
  favourite_count: number;
  rera_number: string | null;
  property_addresses?: AddressShape | AddressShape[] | null;
  property_nearby_places?: { place_type: string; name: string; distance_km: string }[] | null;
  property_amenities?: { amenity_key: string; amenities?: AmenityShape | AmenityShape[] | null }[] | null;
  projects?: ProjectShape | ProjectShape[] | null;
}

interface AddressShape {
  address_line1: string | null;
  pincode: string | null;
  latitude: string | null;
  longitude: string | null;
}

interface AmenityShape {
  key: string;
  label: string;
}

interface ProjectShape {
  name: string;
  developer_name: string | null;
}

interface AgentShape {
  slug: string;
  agency_name: string | null;
  headline: string | null;
  badges: Enums["agent_badge"][] | null;
  rating_average: string | null;
  closed_deal_count: number | null;
  experience_years: number | null;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface ListingMediaShape {
  id: string;
  media_type: string;
  external_url: string | null;
  storage_path: string | null;
  caption: string | null;
  alt_text: string | null;
  sort_order: number;
}

function buildGallery(listing: {
  listing_media?: ListingMediaShape[] | null;
  cover_image_url: string | null;
  youtube_url: string | null;
  instagram_reel_url: string | null;
  virtual_tour_url: string | null;
  tour_360_url: string | null;
  floor_plan_url: string | null;
  title: string;
}): GalleryItem[] {
  const items: GalleryItem[] = [];

  for (const media of (listing.listing_media ?? []).sort((a, b) => a.sort_order - b.sort_order)) {
    const url = media.external_url;
    if (!url) continue;
    items.push({
      id: media.id,
      type: (media.media_type as GalleryItem["type"]) ?? "IMAGE",
      url,
      caption: media.caption,
      alt: media.alt_text,
    });
  }

  if (items.length === 0 && listing.cover_image_url) {
    items.push({ id: "cover", type: "IMAGE", url: listing.cover_image_url, alt: listing.title });
  }

  if (listing.youtube_url) {
    items.push({
      id: "youtube",
      type: "YOUTUBE",
      url: listing.youtube_url,
      // A Short and a full video both live in this column; the gallery reads
      // the URL to decide which frame to use.
      caption: /\/shorts\//.test(listing.youtube_url) ? "Short" : "Property video",
    });
  }
  if (listing.instagram_reel_url) {
    items.push({
      id: "reel",
      type: "INSTAGRAM_REEL",
      url: listing.instagram_reel_url,
      caption: "Reel",
    });
  }
  if (listing.tour_360_url) {
    items.push({ id: "tour360", type: "TOUR_360", url: listing.tour_360_url, caption: "360° tour" });
  }
  if (listing.virtual_tour_url) {
    items.push({
      id: "virtual",
      type: "VIRTUAL_TOUR",
      url: listing.virtual_tour_url,
      caption: "Virtual tour",
    });
  }
  if (listing.floor_plan_url) {
    items.push({
      id: "floorplan",
      type: "FLOOR_PLAN",
      url: listing.floor_plan_url,
      caption: "Floor plan",
    });
  }

  return items;
}

/**
 * JSON-LD for rich results.
 *
 * Deliberately omits the exact street address and coordinates: publishing a
 * precise location for every unit is a privacy and safety issue for occupants,
 * and locality-level data is enough for search engines.
 */
function buildJsonLd(
  listing: {
    title: string;
    description: string | null;
    price: string;
    currency: string;
    listing_type: string;
    bedrooms: number | null;
    bathrooms: number | null;
    built_up_area: string | null;
    cover_image_url: string | null;
    locality: string;
    city: string;
    state: string;
  },
  address: AddressShape | null,
  canonical: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description ?? undefined,
    url: canonical,
    image: listing.cover_image_url ?? undefined,
    datePosted: undefined,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: listing.currency,
      availability: "https://schema.org/InStock",
      businessFunction:
        listing.listing_type === "SALE"
          ? "http://purl.org/goodrelations/v1#Sell"
          : "http://purl.org/goodrelations/v1#LeaseOut",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.locality,
      addressRegion: listing.state,
      postalCode: address?.pincode ?? undefined,
      addressCountry: "IN",
    },
    numberOfRooms: listing.bedrooms ?? undefined,
    numberOfBathroomsTotal: listing.bathrooms ?? undefined,
    floorSize: listing.built_up_area
      ? { "@type": "QuantitativeValue", value: Number(listing.built_up_area), unitCode: "FTK" }
      : undefined,
  };
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular text-lg font-semibold">{value}</dd>
    </div>
  );
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
