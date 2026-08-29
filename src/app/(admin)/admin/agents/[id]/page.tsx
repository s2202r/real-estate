import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { VerificationBadgeList } from "@/components/shared/verification-badge";
import { SocialLinks } from "@/components/shared/social-links";
import { EmptyState } from "@/components/shared/empty-state";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { normaliseSocialUrl, type SocialPlatform } from "@/lib/domain/social";
import { RecomputeStandingButton } from "../recompute-button";
import { AccountStatusControl } from "../account-status";
import type { Enums } from "@/types/database";

export const metadata = { title: "Agent" };

/**
 * One agent, as an administrator sees them.
 *
 * The internal metrics the public profile deliberately hides (§13) — trust
 * score, response and conversion rates, complaints, risk — are the reason this
 * page exists: a suspension decision made without them is a guess.
 */
export default async function AdminAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("user.manage");
  const { id } = await params;

  const agent = await getAgent(id);
  if (!agent) notFound();

  const name = agent.agency_name ?? agent.profiles?.full_name ?? agent.slug;
  const socialLinks = {
    ...pick("website", agent.website_url),
    ...pick("instagram", agent.instagram_url),
    ...pick("youtube", agent.youtube_url),
    ...pick("linkedin", agent.linkedin_url),
    ...pick("facebook", agent.facebook_url),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/agents">
            <ArrowLeft aria-hidden />
            All agents
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/agent/${agent.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Public profile
            </Link>
          </Button>
          <RecomputeStandingButton agentId={agent.id} />
          <AccountStatusControl kind="agent" id={agent.id} status={agent.status} name={name} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription>
                {agent.profiles?.email ?? "No email on file"} · joined{" "}
                {new Date(agent.joined_at).toLocaleDateString("en-IN", {
                  month: "short",
                  year: "numeric",
                })}
              </CardDescription>
            </div>
            <Badge variant={agent.status === "ACTIVE" ? "success" : "muted"}>{agent.status}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <VerificationBadgeList badges={agent.badges} max={5} size="default" />

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Experience" value={`${agent.experience_years} years`} />
            <Detail
              label="Service cities"
              value={agent.service_cities.length > 0 ? agent.service_cities.join(", ") : "Not set"}
            />
            <Detail label="Languages" value={agent.languages.join(", ")} />
            <Detail label="Verification level" value={humanise(agent.verification_level)} />
          </dl>

          {agent.bio && (
            <>
              <Separator />
              <p className="text-sm leading-relaxed text-muted-foreground">{agent.bio}</p>
            </>
          )}

          {Object.keys(socialLinks).length > 0 && (
            <>
              <Separator />
              <SocialLinks links={socialLinks} />
            </>
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Internal standing
          <span className="ml-2 font-normal text-muted-foreground">
            — never shown on the public profile
          </span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Trust score" value={Number(agent.trust_score).toFixed(1)} />
          <StatCard label="Response rate" value={`${Number(agent.response_rate).toFixed(0)}%`} />
          <StatCard
            label="Conversion"
            value={`${Number(agent.conversion_rate).toFixed(0)}%`}
          />
          <StatCard
            label="Complaints"
            value={agent.complaint_count}
            accent={agent.complaint_count > 0 ? "warning" : "default"}
          />
          <StatCard label="Rating" value={`${Number(agent.rating_average).toFixed(1)} / 5`} />
          <StatCard label="Reviews" value={agent.rating_count} />
          <StatCard label="Closed deals" value={agent.closed_deal_count} />
          <StatCard
            label="Risk score"
            value={Number(agent.risk_score).toFixed(1)}
            accent={Number(agent.risk_score) > 50 ? "warning" : "default"}
          />
        </div>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live listings</CardTitle>
        </CardHeader>
        <CardContent>
          {agent.listings.length === 0 ? (
            <EmptyState icon={ExternalLink} title="No listings" />
          ) : (
            <ul className="space-y-2">
              {agent.listings.map((listing) => (
                <li
                  key={listing.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{listing.title}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {listing.reference_code}
                    </p>
                  </div>
                  <StatusBadge kind="listing" status={listing.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function pick(platform: SocialPlatform, raw: string | null) {
  const url = normaliseSocialUrl(platform, raw);
  return url ? { [platform]: url } : {};
}

function humanise(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

interface AdminAgentRow {
  id: string;
  slug: string;
  agency_name: string | null;
  bio: string | null;
  experience_years: number;
  languages: string[];
  service_cities: string[];
  badges: Enums["agent_badge"][];
  verification_level: string;
  trust_score: string;
  rating_average: string;
  rating_count: number;
  response_rate: string;
  conversion_rate: string;
  complaint_count: number;
  closed_deal_count: number;
  risk_score: string;
  status: string;
  joined_at: string;
  website_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  profiles: { full_name: string; email: string | null } | null;
  listings: { id: string; title: string; reference_code: string; status: string }[];
}

async function getAgent(id: string): Promise<AdminAgentRow | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select(
      `id, slug, agency_name, bio, experience_years, languages, service_cities, badges,
       verification_level, trust_score, rating_average, rating_count, response_rate,
       conversion_rate, complaint_count, closed_deal_count, risk_score, status, joined_at,
       website_url, instagram_url, youtube_url, linkedin_url, facebook_url,
       profiles ( full_name, email ),
       listings ( id, title, reference_code, status )`,
    )
    .eq("id", id)
    .maybeSingle();

  return (data ?? null) as unknown as AdminAgentRow | null;
}
