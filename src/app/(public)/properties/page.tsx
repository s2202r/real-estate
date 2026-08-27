import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PropertyGrid } from "@/components/shared/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterPanel, SortSelect } from "@/components/shared/filter-panel";
import { SearchBar } from "@/components/shared/search-bar";
import { TrustChips } from "@/components/shared/trust-strip";
import { Pagination } from "@/components/shared/pagination";
import { getLocalities, searchListings } from "@/lib/data/listings";
import { parseListingFilters } from "@/lib/data/filters";
import { resolveSearchIntent } from "@/lib/data/search-intent";
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
  // A typed sentence becomes filters here, not only when someone clicks
  // "Understand my query" — pressing Enter has to work.
  const parsedFilters = parseListingFilters(resolved);
  // `exact=1` is the escape hatch the interpretation line offers: match the
  // words as typed and infer nothing.
  const { filters, interpretation } =
    resolved.exact === "1"
      ? { filters: parsedFilters, interpretation: null }
      : await resolveSearchIntent(parsedFilters);
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
    // Bottom padding on small screens keeps the last row of results, and the
    // empty-state actions, clear of the fixed Filters button.
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-6 lg:px-8 lg:pb-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.total.toLocaleString("en-IN")} verified{" "}
          {result.total === 1 ? "property" : "properties"}
          {filters.locality ? ` in ${filters.locality}` : ""}. Every listing here has been reviewed
          by the platform before publication.
        </p>
        <TrustChips className="mt-4" />
      </header>

      <div className="mb-6 space-y-3">
        <SearchBar defaultValue={filters.query ?? ""} />

        {/* Say what the sentence was taken to mean, and offer a way out of it:
            a guess the visitor cannot see or undo is worse than no guess. */}
        {interpretation && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <span>
              Searching for <span className="font-medium text-foreground">{interpretation}</span>
            </span>
            <Link
              href={`/properties?q=${encodeURIComponent(filters.query ?? "")}&exact=1`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Search the exact words instead
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <FilterPanel localities={localities} className="lg:sticky lg:top-24 lg:self-start" />

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            {/*
              The mobile filter trigger is a fixed floating button rendered by
              FilterPanel itself (once, from the sidebar slot above), so there is
              no inline trigger here - a second instance would stack two FABs.
            */}
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
