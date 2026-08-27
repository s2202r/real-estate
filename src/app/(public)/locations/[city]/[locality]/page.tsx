import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyGrid } from "@/components/shared/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { searchListings } from "@/lib/data/listings";
import { appConfig, supportedCities } from "@/config/app";

export const revalidate = 1800;

function cityFromSlug(slug: string) {
  return supportedCities.find((city) => city.slug === slug) ?? null;
}

/** "sector-137" -> "Sector 137". Locality slugs are generated, not stored. */
function localityFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; locality: string }>;
}): Promise<Metadata> {
  const { city: citySlug, locality: localitySlug } = await params;
  const city = cityFromSlug(citySlug);
  if (!city) return { title: "Location not found", robots: { index: false, follow: false } };

  const locality = localityFromSlug(localitySlug);
  return {
    title: `Property in ${locality}, ${city.name}`,
    description: `Verified properties for sale and rent in ${locality}, ${city.name}. Reviewed by the platform before publication.`,
    alternates: { canonical: `${appConfig.url}/locations/${citySlug}/${localitySlug}` },
  };
}

export default async function LocalityPage({
  params,
}: {
  params: Promise<{ city: string; locality: string }>;
}) {
  const { city: citySlug, locality: localitySlug } = await params;
  const city = cityFromSlug(citySlug);
  if (!city) notFound();

  const locality = localityFromSlug(localitySlug);
  const result = await searchListings({ city: city.name, locality, pageSize: 12, sort: "newest" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/properties" className="hover:text-foreground">
              Properties
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/locations/${city.slug}`} className="hover:text-foreground">
              {city.name}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground">{locality}</li>
        </ol>
      </nav>

      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Property in {locality}, {city.name}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {result.total.toLocaleString("en-IN")} verified{" "}
          {result.total === 1 ? "property" : "properties"} in this locality.
        </p>
      </header>

      <div className="mt-8">
        {result.listings.length > 0 ? (
          <PropertyGrid listings={result.listings} />
        ) : (
          <EmptyState
            icon={MapPin}
            title={`No verified listings in ${locality} yet`}
            description={`Browse the rest of ${city.name}, or post a requirement so agents can bring matching inventory to you.`}
            action={
              <Button asChild>
                <Link href={`/locations/${city.slug}`}>Browse {city.name}</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
