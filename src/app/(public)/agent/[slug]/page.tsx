import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, CalendarDays, Languages, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { VerificationBadgeList } from "@/components/shared/verification-badge";
import { PropertyGrid } from "@/components/shared/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { getAgentBySlug, getAgentListings, getAgentReviews } from "@/lib/data/agents";
import { appConfig } from "@/config/app";
import { initialsOf } from "@/lib/utils";
import type { ListingSummary } from "@/lib/data/listings";

export const revalidate = 900;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);

  if (!agent) return { title: "Agent not found", robots: { index: false, follow: false } };

  const name = agent.agencyName ?? agent.fullName;
  return {
    title: `${name} — verified agent`,
    description:
      agent.bio?.slice(0, 160) ??
      `${name} is a verified agent on ${appConfig.name} with ${agent.experienceYears} years of experience in ${agent.serviceCities.join(", ")}.`,
    alternates: { canonical: `${appConfig.url}/agent/${slug}` },
  };
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);

  if (!agent) notFound();

  const [listings, reviews] = await Promise.all([
    getAgentListings(agent.id, 9),
    getAgentReviews(agent.id, 6),
  ]);

  const name = agent.agencyName ?? agent.fullName;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateAgent",
            name,
            description: agent.bio ?? undefined,
            url: `${appConfig.url}/agent/${agent.slug}`,
            image: agent.avatarUrl ?? undefined,
            areaServed: agent.serviceCities,
            aggregateRating:
              agent.ratingCount > 0
                ? {
                    "@type": "AggregateRating",
                    ratingValue: agent.ratingAverage,
                    reviewCount: agent.ratingCount,
                  }
                : undefined,
          }),
        }}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-8">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Avatar className="size-20">
              {agent.avatarUrl && <AvatarImage src={agent.avatarUrl} alt="" />}
              <AvatarFallback className="text-lg">{initialsOf(agent.fullName)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
              {agent.headline && <p className="mt-1 text-muted-foreground">{agent.headline}</p>}
              <div className="mt-3">
                <VerificationBadgeList badges={agent.badges} max={4} size="default" />
              </div>
            </div>
          </header>

          {agent.bio && (
            <section>
              <h2 className="text-lg font-semibold">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {agent.bio}
              </p>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold">
              Live inventory ({listings.length})
            </h2>
            <div className="mt-4">
              {listings.length > 0 ? (
                <PropertyGrid listings={listings as unknown as ListingSummary[]} />
              ) : (
                <EmptyState
                  icon={Building2}
                  title="No live listings"
                  description={`${name} has no verified listings published right now.`}
                />
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Customer reviews</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Reviews are tied to a real interaction and moderated before publication.
            </p>
            <div className="mt-4 space-y-4">
              {reviews.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title="No reviews yet"
                  description="Reviews appear here once customers complete a visit or a transaction."
                />
              ) : (
                reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2">
                        <span className="flex" aria-label={`${review.rating} out of 5`}>
                          {Array.from({ length: 5 }, (_, index) => (
                            <Star
                              key={index}
                              className={
                                index < review.rating
                                  ? "size-4 fill-warning text-warning"
                                  : "size-4 text-muted-foreground/30"
                              }
                              aria-hidden
                            />
                          ))}
                        </span>
                        {review.is_verified_interaction && (
                          <Badge variant="success" size="sm">
                            Verified visit
                          </Badge>
                        )}
                      </div>
                      {review.title && <p className="mt-2 font-medium">{review.title}</p>}
                      {review.body && (
                        <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
                      )}
                      {review.agent_response && (
                        <>
                          <Separator className="my-3" />
                          <p className="text-xs font-medium">Response from {name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {review.agent_response}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">Rating</dt>
                  <dd className="tabular text-lg font-semibold">
                    {agent.ratingCount > 0 ? agent.ratingAverage.toFixed(1) : "New"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Reviews</dt>
                  <dd className="tabular text-lg font-semibold">{agent.ratingCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Deals</dt>
                  <dd className="tabular text-lg font-semibold">{agent.closedDealCount}</dd>
                </div>
              </dl>

              <Separator />

              <div className="space-y-3 text-sm">
                <p className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {agent.experienceYears} years in real estate
                </p>
                {agent.serviceCities.length > 0 && (
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {agent.serviceCities.join(", ")}
                  </p>
                )}
                {agent.languages.length > 0 && (
                  <p className="flex items-start gap-2">
                    <Languages className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {agent.languages.join(", ")}
                  </p>
                )}
              </div>

              {agent.serviceLocalities.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Focus areas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.serviceLocalities.map((locality) => (
                        <Badge key={locality} variant="muted" size="sm">
                          {locality}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button asChild className="w-full">
                <Link href="/dashboard/requirements">Post a requirement</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Agents respond to requirements through the platform. Direct contact details are
                exchanged only once you engage.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
