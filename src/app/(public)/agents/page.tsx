import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { VerificationBadgeList } from "@/components/shared/verification-badge";
import { AgentFilterPanel } from "@/components/shared/agent-filter-panel";
import { Pagination } from "@/components/shared/pagination";
import { searchAgents } from "@/lib/data/agents";
import { parseAgentFilters } from "@/lib/data/filters";
import { getLocationScope } from "@/lib/location/server";
import { appConfig } from "@/config/app";
import { initialsOf } from "@/lib/utils";

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
  const scope = await getLocationScope();
  const parsed = parseAgentFilters(params);
  // A locality or project narrows the city it belongs to; the agent directory
  // works at city level, so only the city carries over.
  const filters = parsed.city ? parsed : { ...parsed, ...(scope.city ? { city: scope.city } : {}) };
  const result = await searchAgents({ ...filters, pageSize: 24 });

  const heading = filters.city ? `Verified agents in ${filters.city}` : "Verified agents";

  return (
    // Bottom padding on small screens keeps the last card, and the empty-state
    // actions, clear of the fixed Filters button.
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-6 lg:px-8 lg:pb-14">
      <header className="max-w-3xl">
        <Badge variant="success" size="lg">
          <ShieldCheck aria-hidden />
          Platform-granted badges
        </Badge>
        <h1 className="text-balance mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Every agent completes identity verification before they can list. RERA registration and
          trust badges are granted by the platform after review — they cannot be bought or
          self-claimed.
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <AgentFilterPanel className="lg:sticky lg:top-24 lg:self-start" />

        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {result.total.toLocaleString("en-IN")} {result.total === 1 ? "agent" : "agents"}
            {filters.city ? ` serving ${filters.city}` : ""}
            {filters.language ? `, speaking ${filters.language}` : ""}
          </p>

          {result.agents.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={Users}
              title="No agents match these filters"
              description={
                filters.city
                  ? `No verified agents are serving ${filters.city} with these criteria yet.`
                  : "Verified agents appear here once they complete onboarding."
              }
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild variant="outline">
                    <Link href="/agents">Clear filters</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register?role=agent">Join as an agent</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
}: {
  agent: Awaited<ReturnType<typeof searchAgents>>["agents"][number];
}) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <CardContent className="flex h-full flex-col p-5">
        {/* The whole card is the link target; the overlay keeps the markup a
            single anchor rather than wrapping interactive children. */}
        <Link href={`/agent/${agent.slug}`} className="absolute inset-0 z-10">
          <span className="sr-only">{agent.agencyName ?? agent.fullName}</span>
        </Link>

        <div className="flex items-start gap-4">
          <Avatar className="size-14 ring-2 ring-primary/10">
            {agent.avatarUrl && <AvatarImage src={agent.avatarUrl} alt="" />}
            <AvatarFallback className="text-base">{initialsOf(agent.fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold group-hover:text-primary">
              {agent.agencyName ?? agent.fullName}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {agent.headline ?? `${agent.experienceYears} years in the market`}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <VerificationBadgeList badges={agent.badges} max={2} />
        </div>

        <dl className="mt-4 grid grid-cols-3 divide-x rounded-lg border bg-muted/40 py-3 text-center">
          <Stat
            label="Rating"
            value={agent.ratingCount > 0 ? agent.ratingAverage.toFixed(1) : "New"}
          />
          <Stat label="Deals" value={String(agent.closedDealCount)} />
          <Stat label="Experience" value={`${agent.experienceYears}y`} />
        </dl>

        {agent.serviceLocalities.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <MapPin className="size-3 text-muted-foreground" aria-hidden />
            {agent.serviceLocalities.slice(0, 3).map((locality) => (
              <Badge key={locality} variant="muted" size="sm">
                {locality}
              </Badge>
            ))}
          </div>
        )}

        <p className="mt-auto pt-4 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          View profile
          <ArrowRight className="ml-1 inline size-4" aria-hidden />
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular text-sm font-semibold">{value}</dd>
    </div>
  );
}
