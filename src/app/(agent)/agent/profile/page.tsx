import { BadgeCheck, FileText, Link2 as LinkIcon, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { VerificationBadgeList } from "@/components/shared/verification-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { requireAgentPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import type { Enums } from "@/types/database";
import { SocialLinksForm } from "./social-links-form";
import { normaliseSocialUrl, type SocialPlatform } from "@/lib/domain/social";

export const metadata = { title: "Profile and verification" };

export default async function AgentProfilePage() {
  const user = await requireAgentPage();
  const [agent, verifications, rera] = await Promise.all([
    getAgent(user.agentId),
    getVerifications(user.agentId),
    getRera(user.agentId),
  ]);

  if (!agent) return <p className="text-sm text-muted-foreground">Profile unavailable.</p>;

  const socialLinks = {
    ...pick("website", agent.website_url),
    ...pick("instagram", agent.instagram_url),
    ...pick("youtube", agent.youtube_url),
    ...pick("linkedin", agent.linkedin_url),
    ...pick("facebook", agent.facebook_url),
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public profile</CardTitle>
          <CardDescription>What customers see at /agent/{agent.slug}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Agency</dt>
              <dd className="mt-1 font-medium">{agent.agency_name ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Experience</dt>
              <dd className="mt-1 font-medium">{agent.experience_years} years</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Service cities</dt>
              <dd className="mt-1 font-medium">
                {agent.service_cities.length > 0 ? agent.service_cities.join(", ") : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Languages</dt>
              <dd className="mt-1 font-medium">{agent.languages.join(", ")}</dd>
            </div>
          </dl>

          <Separator />

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visit marketplace
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={agent.accepts_visit_requests ? "success" : "muted"}>
                {agent.accepts_visit_requests ? "Accepting visit offers" : "Not accepting visits"}
              </Badge>
              <Badge variant="muted">
                Up to {Number(agent.max_visit_distance_km)} km
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" aria-hidden />
            Verification standing
          </CardTitle>
          <CardDescription>
            Badges are granted by the platform after review. They cannot be self-assigned — the
            database rejects the write.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VerificationBadgeList badges={agent.badges} max={4} size="default" />

          <Separator />

          <div className="space-y-2">
            {verifications.length === 0 ? (
              <EmptyState
                icon={BadgeCheck}
                title="No verification submitted"
                description="Submit identity and business verification to unlock listing and visit features."
              />
            ) : (
              verifications.map((verification) => (
                <div
                  key={verification.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{humanise(verification.level)}</p>
                    {verification.review_notes && (
                      <p className="truncate text-xs text-muted-foreground">
                        {verification.review_notes}
                      </p>
                    )}
                    {verification.rejection_reason && (
                      <p className="text-xs text-destructive">{verification.rejection_reason}</p>
                    )}
                  </div>
                  <StatusBadge kind="verification" status={verification.status} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" aria-hidden />
            RERA registration
          </CardTitle>
          <CardDescription>
            Required in most states before facilitating a transaction in a registered project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rera.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No RERA registration on file"
              description="Add your state RERA agent registration to earn the RERA Verified badge."
            />
          ) : (
            <div className="space-y-2">
              {rera.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="tabular text-sm font-medium">{record.rera_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.state}
                      {record.valid_until
                        ? ` · valid to ${new Date(record.valid_until).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge kind="verification" status={record.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="size-4" aria-hidden />
            Your links
          </CardTitle>
          <CardDescription>
            Where customers can see your work. These are shown as your own links, and they are
            separate from verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SocialLinksForm current={socialLinks} />
        </CardContent>
      </Card>
    </div>
  );
}

interface AgentProfileRow {
  slug: string;
  agency_name: string | null;
  experience_years: number;
  service_cities: string[];
  languages: string[];
  badges: Enums["agent_badge"][];
  accepts_visit_requests: boolean;
  max_visit_distance_km: string;
  website_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
}

function pick(platform: SocialPlatform, raw: string | null) {
  const url = normaliseSocialUrl(platform, raw);
  return url ? { [platform]: url } : {};
}

async function getAgent(agentId: string): Promise<AgentProfileRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select(
      "slug, agency_name, experience_years, service_cities, languages, badges, accepts_visit_requests, max_visit_distance_km, website_url, instagram_url, youtube_url, linkedin_url, facebook_url",
    )
    .eq("id", agentId)
    .maybeSingle();
  return data as AgentProfileRow | null;
}

interface VerificationRow {
  id: string;
  level: string;
  status: string;
  review_notes: string | null;
  rejection_reason: string | null;
}

async function getVerifications(agentId: string): Promise<VerificationRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_verifications")
    .select("id, level, status, review_notes, rejection_reason")
    .eq("agent_id", agentId)
    .order("submitted_at", { ascending: false });
  return (data ?? []) as VerificationRow[];
}

interface ReraRow {
  id: string;
  rera_number: string;
  state: string;
  status: string;
  valid_until: string | null;
}

async function getRera(agentId: string): Promise<ReraRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_rera_records")
    .select("id, rera_number, state, status, valid_until")
    .eq("agent_id", agentId);
  return (data ?? []) as ReraRow[];
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
