import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PropertyGrid } from "@/components/shared/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterPanel, SortSelect } from "@/components/shared/filter-panel";
import { SearchBar } from "@/components/shared/search-bar";
import { Pagination } from "@/components/shared/pagination";
import { getLocalities, searchListings } from "@/lib/data/listings";
import { parseListingFilters } from "@/lib/data/filters";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: "Verified properties",
  description:
    "Search verified properties across India. Every listing is reviewed by the platform before it is published.",
  alternates: { canonical: `${appConfig.url}/properties` },
};

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const filters = parseListingFilters(resolved);
  const [result, localities] = await Promise.all([
    searchListings(filters),
    filters.city ? getLocalities(filters.city) : Promise.resolve([]),
  ]);

  const heading = filters.city
    ? `Property in ${filters.city}`
    : filters.query
      ? `Results for “${filters.query}”`
      : "Verified properties";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.total.toLocaleString("en-IN")} verified{" "}
          {result.total === 1 ? "property" : "properties"}
          {filters.locality ? ` in ${filters.locality}` : ""}. Every listing here has been reviewed
          by the platform before publication.
        </p>
      </header>

      <div className="mb-6">
        <SearchBar defaultValue={filters.query ?? ""} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <FilterPanel localities={localities} className="lg:sticky lg:top-24 lg:self-start" />

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 lg:hidden">
              <FilterPanel localities={localities} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filters.listingType && (
                <Badge variant="secondary">
                  {filters.listingType === "SALE" ? "For sale" : "For rent"}
                </Badge>
              )}
              {filters.exclusiveOnly && <Badge variant="warning">Exclusive only</Badge>}
              {filters.withVirtualTour && <Badge variant="info">With virtual tour</Badge>}
            </div>
            <SortSelect />
          </div>

          {result.listings.length > 0 ? (
            <>
              <PropertyGrid listings={result.listings} />
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
              />
            </>
          ) : (
            <EmptyState
              icon={Search}
              title="No properties match these filters"
              description="Try widening the budget, removing a locality, or posting a requirement so agents can bring matching inventory to you."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild variant="outline">
                    <Link href="/properties">
                      <SlidersHorizontal aria-hidden />
                      Clear filters
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/dashboard/requirements">Post a requirement</Link>
                  </Button>
                </div>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
