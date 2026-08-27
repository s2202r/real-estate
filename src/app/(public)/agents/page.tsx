import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { VerificationBadgeList } from "@/components/shared/verification-badge";
import { searchAgents } from "@/lib/data/agents";
import { appConfig, supportedCities } from "@/config/app";
import { initialsOf } from "@/lib/utils";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Verified agents",
  description:
    "Find verified real-estate agents by city, locality and specialisation. Every badge is granted by the platform, never self-claimed.",
  alternates: { canonical: `${appConfig.url}/agents` },
};

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const city = typeof params.city === "string" ? params.city : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { agents, total } = await searchAgents({ city, page, pageSize: 24 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">Verified agents</h1>
        <p className="mt-3 text-muted-foreground">
          Every agent on the network completes identity verification before they can list. RERA
          registration and trust badges are granted by the platform after review — they cannot be
          bought or self-claimed.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant={city ? "outline" : "default"} size="sm">
          <Link href="/agents">All cities</Link>
        </Button>
        {supportedCities.map((option) => (
          <Button
            key={option.slug}
            asChild
            variant={city === option.name ? "default" : "outline"}
            size="sm"
          >
            <Link href={`/agents?city=${encodeURIComponent(option.name)}`}>{option.name}</Link>
          </Button>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {total.toLocaleString("en-IN")} {total === 1 ? "agent" : "agents"}
        {city ? ` serving ${city}` : ""}
      </p>

      {agents.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={Users}
          title="No agents listed yet"
          description={
            city
              ? `No verified agents are serving ${city} yet.`
              : "Verified agents will appear here once they complete onboarding."
          }
          action={
            <Button asChild>
              <Link href="/register?role=agent">Join as an agent</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <Link href={`/agent/${agent.slug}`} className="flex items-start gap-4">
                  <Avatar className="size-12">
                    {agent.avatarUrl && <AvatarImage src={agent.avatarUrl} alt="" />}
                    <AvatarFallback>{initialsOf(agent.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{agent.agencyName ?? agent.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {agent.headline ?? `${agent.experienceYears} years experience`}
                    </p>
                  </div>
                </Link>

                <div className="mt-4">
                  <VerificationBadgeList badges={agent.badges} max={2} />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                  <div>
                    <dt className="text-xs text-muted-foreground">Rating</dt>
                    <dd className="tabular text-sm font-semibold">
                      {agent.ratingCount > 0 ? agent.ratingAverage.toFixed(1) : "New"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Deals</dt>
                    <dd className="tabular text-sm font-semibold">{agent.closedDealCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Experience</dt>
                    <dd className="tabular text-sm font-semibold">{agent.experienceYears}y</dd>
                  </div>
                </dl>

                {agent.serviceLocalities.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {agent.serviceLocalities.slice(0, 3).map((locality) => (
                      <Badge key={locality} variant="muted" size="sm">
                        {locality}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {page > 1 && (
        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline">
            <Link href={`/agents?${city ? `city=${encodeURIComponent(city)}&` : ""}page=${page - 1}`}>
              Previous page
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
