import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Building2, MapPin, Maximize, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PriceDisplay, RentDisplay } from "./price-display";
import { VerifiedListingBadge } from "./verification-badge";
import { cn } from "@/lib/utils";
import { listingPath } from "@/lib/domain/references";
import type { ListingSummary } from "@/lib/data/listings";

/**
 * The property card.
 *
 * Design intent (§49): large imagery, restrained typography, trust signals
 * before decoration. The verification chip and the property-passport reference
 * are the two things this product has that a generic portal does not, so both
 * appear on every card.
 */
export function PropertyCard({
  listing,
  priority = false,
  className,
  matchScore,
}: {
  listing: ListingSummary;
  /** Set for above-the-fold cards so the LCP image is not lazy-loaded. */
  priority?: boolean;
  className?: string;
  matchScore?: number;
}) {
  const href = listingPath({
    locality: listing.locality,
    slug: listing.slug,
    reference: listing.referenceCode,
  });

  const isRental = listing.listingType === "RENT" || listing.listingType === "LEASE";

  return (
    <Card
      className={cn(
        "lift group relative overflow-hidden hover:border-primary/25 focus-within:shadow-e3",
        className,
      )}
    >
      <Link href={href} className="block focus:outline-none">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {listing.coverImageUrl ? (
            <Image
              src={listing.coverImageUrl}
              alt={listing.title}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 24rem, (min-width: 768px) 33vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Building2 className="size-10 text-muted-foreground/40" aria-hidden />
            </div>
          )}

          {/* A short scrim under the top chips so a white facade behind them does
              not swallow the verification badge. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/25 to-transparent opacity-70"
            aria-hidden
          />

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <VerifiedListingBadge score={listing.verificationScore} />
            {listing.isExclusive && (
              <Badge variant="warning" className="backdrop-blur">
                🔥 Platform Exclusive
              </Badge>
            )}
          </div>

          {typeof matchScore === "number" && (
            <div className="absolute right-3 top-3">
              <Badge variant="success" className="backdrop-blur">
                {matchScore}% match
              </Badge>
            </div>
          )}

          {listing.hasVirtualTour && (
            <div className="absolute bottom-3 right-3">
              <Badge variant="secondary" className="backdrop-blur">
                <Video aria-hidden />
                Virtual tour
              </Badge>
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            {isRental ? (
              <RentDisplay amount={listing.price} />
            ) : (
              <PriceDisplay amount={listing.price} areaSqft={listing.builtUpArea} />
            )}
            <Badge variant="outline" size="sm" className="shrink-0">
              {listing.listingType === "SALE" ? "Sale" : "Rent"}
            </Badge>
          </div>

          <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
            {listing.title}
          </h3>

          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {listing.locality}, {listing.city}
            </span>
          </p>

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            {listing.bedrooms != null && (
              <div className="flex items-center gap-1.5">
                <BedDouble className="size-3.5" aria-hidden />
                <dt className="sr-only">Bedrooms</dt>
                <dd>{listing.bedrooms} BHK</dd>
              </div>
            )}
            {listing.bathrooms != null && (
              <div className="flex items-center gap-1.5">
                <Bath className="size-3.5" aria-hidden />
                <dt className="sr-only">Bathrooms</dt>
                <dd>{listing.bathrooms}</dd>
              </div>
            )}
            {listing.builtUpArea != null && (
              <div className="flex items-center gap-1.5">
                <Maximize className="size-3.5" aria-hidden />
                <dt className="sr-only">Built-up area</dt>
                <dd className="tabular">{listing.builtUpArea.toLocaleString("en-IN")} sq ft</dd>
              </div>
            )}
          </dl>

          {listing.propertyReference && (
            <p className="tabular text-[0.6875rem] text-muted-foreground/70">
              Passport {listing.propertyReference}
            </p>
          )}
        </div>
      </Link>
    </Card>
  );
}

export function PropertyGrid({
  listings,
  className,
  matchScores,
}: {
  listings: readonly ListingSummary[];
  className?: string;
  matchScores?: Record<string, number>;
}) {
  return (
    <div
      className={cn(
        "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {listings.map((listing, index) => (
        <PropertyCard
          key={listing.id}
          listing={listing}
          priority={index < 3}
          matchScore={matchScores?.[listing.id]}
        />
      ))}
    </div>
  );
}

export function PropertyCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-6 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  );
}
