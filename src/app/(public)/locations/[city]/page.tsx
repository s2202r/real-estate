import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PropertyGrid } from "@/components/shared/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { getLocalities, searchListings } from "@/lib/data/listings";
import { appConfig, supportedCities } from "@/config/app";

export const revalidate = 1800;

/** Location pages are the SEO backbone, so they are generated ahead of time. */
export function generateStaticParams() {
  return supportedCities.map((city) => ({ city: city.slug }));
}

function cityFromSlug(slug: string) {
  return supportedCities.find((city) => city.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: slug } = await params;
  const city = cityFromSlug(slug);
  if (!city) return { title: "Location not found", robots: { index: false, follow: false } };

  return {
    title: `Property in ${city.name}`,
    description: `Verified properties for sale and rent in ${city.name}, ${city.state}. Every listing is reviewed by the platform before publication.`,
    alternates: { canonical: `${appConfig.url}/locations/${city.slug}` },
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = cityFromSlug(slug);
  if (!city) notFound();

  const [result, localities] = await Promise.all([
    searchListings({ city: city.name, pageSize: 9, sort: "newest" }),
    getLocalities(city.name),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/properties" className="hover:text-foreground">
              Properties
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground">{city.name}</li>
        </ol>
      </nav>

      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Property in {city.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {result.total.toLocaleString("en-IN")} verified{" "}
          {result.total === 1 ? "property" : "properties"} across {city.name}, {city.state}. Each
          one carries a permanent property passport and was reviewed before publication.
        </p>
      </header>

      {localities.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Popular localities
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {localities.slice(0, 18).map((locality) => (
              <Button key={locality} asChild variant="outline" size="sm">
                <Link
                  href={`/locations/${city.slug}/${encodeURIComponent(
                    locality.toLowerCase().replace(/\s+/g, "-"),
                  )}`}
                >
                  <MapPin aria-hidden />
                  {locality}
                </Link>
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Recently verified in {city.name}</h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/properties?city=${encodeURIComponent(city.name)}`}>
              See all
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="mt-5">
          {result.listings.length > 0 ? (
            <PropertyGrid listings={result.listings} />
          ) : (
            <EmptyState
              icon={MapPin}
              title={`No verified listings in ${city.name} yet`}
              description="Post a requirement and agents working this city will bring matching inventory to you."
              action={
                <Button asChild>
                  <Link href="/dashboard/requirements">Post a requirement</Link>
                </Button>
              }
            />
          )}
        </div>
      </section>

      <Card className="mt-12">
        <CardContent className="p-6">
          <h2 className="font-semibold">Buying in {city.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Listings in {city.state} are published only after platform review, and agents operating
            here are asked for their state RERA registration where it applies. Verification confirms
            the completeness and consistency of the information provided; it is not a legal opinion
            on title. Always obtain independent legal advice before a transaction.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
