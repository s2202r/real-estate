import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  Fingerprint,
  MapPin,
  Network,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PropertyGrid } from "@/components/shared/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { TrustStrip } from "@/components/shared/trust-strip";
import { getFeaturedListings } from "@/lib/data/listings";
import { appConfig, supportedCities } from "@/config/app";

export const revalidate = 300;

const DIFFERENTIATORS = [
  {
    icon: Fingerprint,
    title: "Property Passport",
    body: "One physical property, one permanent identity. Price history, visit history and verification stay with the property — not with whichever advertisement happens to be live today.",
  },
  {
    icon: Network,
    title: "A network, not a wall",
    body: "Agents share inventory with each other under recorded terms. A customer sees the right property even when their agent does not own it.",
  },
  {
    icon: Users,
    title: "Visit marketplace",
    body: "If the listing agent is unavailable, a nearby verified agent takes the visit. Customers stop waiting three days for a viewing.",
  },
  {
    icon: Calculator,
    title: "Transparent commission",
    body: "Every contributor is tracked and paid by a deterministic engine. Agents see the arithmetic behind every rupee, before they are paid.",
  },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Search verified inventory",
    body: "Every listing is reviewed by the platform before it appears. No expired ads, no bait pricing.",
  },
  {
    step: "02",
    title: "Book a site visit",
    body: "Pick a slot. If your agent is busy, the network finds a verified agent nearby who is not.",
  },
  {
    step: "03",
    title: "Close with a record",
    body: "Offers, visits and paperwork are tracked against one deal, so nobody argues about who did what.",
  },
] as const;

export default async function HomePage() {
  const featured = await getFeaturedListings(6);

  return (
    <>
      {/* Hero */}
      <section className="surface-gradient border-b">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <Badge variant="success" size="lg">
              <BadgeCheck aria-hidden />
              Verified inventory network
            </Badge>

            <h1 className="text-balance mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Property, without the guesswork.
            </h1>

            <p className="text-balance mt-5 max-w-2xl text-lg text-muted-foreground">
              {appConfig.name} is a verified inventory network. Agents collaborate on shared
              property passports, customers see only reviewed listings, and every contribution to a
              transaction is recorded and paid transparently.
            </p>

            <form
              action="/properties"
              className="mt-9 flex w-full max-w-xl flex-col gap-2 sm:flex-row"
              role="search"
            >
              <label htmlFor="hero-search" className="sr-only">
                Search by city, locality or project
              </label>
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  id="hero-search"
                  name="q"
                  type="search"
                  placeholder="Try “3BHK in Noida Extension under 1.5 Cr”"
                  className="h-12 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button type="submit" size="lg" className="h-12">
                Search
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Popular:</span>
              {supportedCities.slice(0, 5).map((city) => (
                <Button key={city.slug} asChild variant="outline" size="sm">
                  <Link href={`/locations/${city.slug}`}>
                    <MapPin aria-hidden />
                    {city.name}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The four promises, immediately below the hero. */}
      <TrustStrip />

      {/* What makes it different */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">Built as infrastructure, not a noticeboard</h2>
          <p className="mt-3 text-muted-foreground">
            Most portals sell the same lead to five agents and leave the customer to sort it out.
            This platform models what actually happens in a transaction.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFERENTIATORS.map((item) => (
            <Card key={item.title}>
              <CardContent className="p-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured listings */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Recently verified</h2>
              <p className="mt-2 text-muted-foreground">
                Reviewed by the platform before publication.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/properties">
                View all properties
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="mt-8">
            {featured.length > 0 ? (
              <PropertyGrid listings={featured} />
            ) : (
              <EmptyState
                icon={Search}
                title="No listings published yet"
                description="Once agents publish and the platform verifies their inventory, it appears here."
                action={
                  <Button asChild>
                    <Link href="/register?role=agent">Join as an agent</Link>
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((item) => (
            <div key={item.step}>
              <span className="tabular text-sm font-semibold text-primary">{item.step}</span>
              <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agent CTA */}
      <section className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Card className="surface-gradient overflow-hidden">
            <CardContent className="flex flex-col items-start gap-6 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  For agents: stop competing over the same five leads
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Publish inventory once, share it with the network on your terms, take visits in
                  your area, and get paid for every contribution — with the calculation shown to
                  you in full.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/register?role=agent">Join as an agent</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Agent sign in</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
