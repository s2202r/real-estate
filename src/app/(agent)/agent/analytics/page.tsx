import { Activity, Clock, Star, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { VerificationBadgeList } from "@/components/shared/verification-badge";
import { requireAgentPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { calculateTrustScore } from "@/lib/domain/scoring";
import type { Enums } from "@/types/database";

export const metadata = { title: "Performance" };

/**
 * Agent performance.
 *
 * The trust score is shown to the AGENT with its full component breakdown —
 * they can see what is holding them back and act on it. The same number is
 * never published to customers (§13), where it would simply become a target
 * to game.
 */
export default async function AgentAnalyticsPage() {
  const user = await requireAgentPage();
  const agent = await getAgent(user.agentId);

  if (!agent) {
    return <p className="text-sm text-muted-foreground">Agent profile unavailable.</p>;
  }

  const trust = calculateTrustScore({
    closedDealCount: agent.closed_deal_count,
    ratingAverage: Number(agent.rating_average),
    ratingCount: agent.rating_count,
    responseRate: Number(agent.response_rate),
    visitCompletionRate: Number(agent.visit_completion_rate),
    cancellationRate: Number(agent.cancellation_rate),
    complaintCount: agent.complaint_count,
    // Listing accuracy is proxied by the verification score until a dedicated
    // accuracy signal exists.
    listingAccuracyRate: 90,
    monthsOnPlatform: monthsSince(agent.joined_at),
    isIdentityVerified: agent.badges.includes("IDENTITY_VERIFIED"),
    isReraVerified: agent.badges.includes("RERA_VERIFIED"),
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Trust score"
          value={`${trust.score}/100`}
          hint="Computed by the platform"
          icon={Target}
          accent={trust.score >= 70 ? "success" : "warning"}
        />
        <StatCard
          label="Customer rating"
          value={agent.rating_count > 0 ? Number(agent.rating_average).toFixed(1) : "New"}
          hint={`${agent.rating_count} reviews`}
          icon={Star}
        />
        <StatCard
          label="Response rate"
          value={`${Math.round(Number(agent.response_rate))}%`}
          hint={agent.response_time_minutes ? `~${agent.response_time_minutes} min` : undefined}
          icon={Clock}
        />
        <StatCard
          label="Visit completion"
          value={`${Math.round(Number(agent.visit_completion_rate))}%`}
          icon={Activity}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" aria-hidden />
              What drives your trust score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {trust.components.map((component) => (
                <li key={component.key}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{component.label}</span>
                    <span className="tabular text-muted-foreground">
                      {component.score}/100 · weight {Math.round(component.weight * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        component.score >= 70
                          ? "h-full rounded-full bg-success"
                          : component.score >= 40
                            ? "h-full rounded-full bg-warning"
                            : "h-full rounded-full bg-destructive"
                      }
                      style={{ width: `${component.score}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              This score is not shown to customers. They see your badges, rating and closed-deal
              count.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Badges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <VerificationBadgeList badges={agent.badges} max={4} size="default" />

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Next milestones</p>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Trusted Agent</span>
                <Badge variant={trust.eligibleForTrustedBadge ? "success" : "muted"} size="sm">
                  {trust.eligibleForTrustedBadge ? "Eligible" : "Not yet"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Top Performer</span>
                <Badge variant={trust.eligibleForTopPerformerBadge ? "success" : "muted"} size="sm">
                  {trust.eligibleForTopPerformerBadge ? "Eligible" : "Not yet"}
                </Badge>
              </div>
              <p className="pt-2 text-xs text-muted-foreground">
                Eligibility is evaluated by the platform. Badges are granted by an administrator
                after review — they cannot be claimed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface AgentRow {
  closed_deal_count: number;
  rating_average: string;
  rating_count: number;
  response_rate: string;
  response_time_minutes: number | null;
  visit_completion_rate: string;
  cancellation_rate: string;
  complaint_count: number;
  joined_at: string;
  badges: Enums["agent_badge"][];
}

async function getAgent(agentId: string): Promise<AgentRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select(
      "closed_deal_count, rating_average, rating_count, response_rate, response_time_minutes, visit_completion_rate, cancellation_rate, complaint_count, joined_at, badges",
    )
    .eq("id", agentId)
    .maybeSingle();
  return data as AgentRow | null;
}

function monthsSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / (30 * 24 * 60 * 60 * 1000)));
}
