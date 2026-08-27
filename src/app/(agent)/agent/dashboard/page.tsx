import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  IndianRupee,
  Network,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { requireAgentPage } from "@/lib/auth/session";
import { getAgentDashboard } from "@/lib/data/dashboard";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoney, money } from "@/lib/domain/money";

export default async function AgentDashboardPage() {
  const user = await requireAgentPage();
  const stats = await getAgentDashboard(user.agentId);
  const [offers, pipeline, upcoming] = await Promise.all([
    getVisitOffers(user.agentId),
    getPipeline(user.agentId),
    getUpcomingVisits(user.agentId),
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Live listings"
          value={stats.activeListings}
          hint={stats.pendingReview > 0 ? `${stats.pendingReview} in review` : undefined}
          icon={Building2}
        />
        <StatCard label="Open leads" value={stats.openLeads} icon={Users} accent="info" />
        <StatCard
          label="Upcoming visits"
          value={stats.upcomingVisits}
          hint={stats.visitOffers > 0 ? `${stats.visitOffers} offers waiting` : undefined}
          icon={CalendarClock}
          accent={stats.visitOffers > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Pending earnings"
          value={formatMoney(money(stats.pendingEarningsMinor))}
          hint={`${formatMoney(money(stats.paidEarningsMinor))} paid to date`}
          icon={IndianRupee}
          accent="success"
        />
      </section>

      {/* Visit marketplace — the time-critical queue, so it leads. */}
      {offers.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-warning-foreground" aria-hidden />
              Visit opportunities near you
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/agent/visits">
                All visits
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {offer.visits?.listings?.title ?? "Property visit"}
                  </p>
                  <p className="tabular text-xs text-muted-foreground">
                    {offer.visits?.requested_date} at {offer.visits?.requested_time?.slice(0, 5)}
                    {offer.distance_km ? ` · ${Number(offer.distance_km).toFixed(1)} km away` : ""}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/agent/visits">Review offer</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Pipeline</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/agent/leads">
                Open CRM
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pipeline.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No open leads"
                description="Leads arrive when a customer enquires about your inventory, or when you register one yourself."
              />
            ) : (
              <ul className="space-y-2">
                {pipeline.map((stage) => (
                  <li key={stage.stage} className="flex items-center justify-between gap-3">
                    <StatusBadge kind="lead" status={stage.stage} />
                    <span className="tabular text-sm font-medium">{stage.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Your next visits</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nothing scheduled"
                description="Accept a visit opportunity to fill your calendar."
              />
            ) : (
              <ul className="space-y-3">
                {upcoming.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {visit.listings?.title ?? "Property visit"}
                      </p>
                      <p className="tabular text-xs text-muted-foreground">
                        {visit.requested_date} at {visit.requested_time.slice(0, 5)}
                      </p>
                    </div>
                    <StatusBadge kind="visit" status={visit.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Add inventory to the network</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a listing against a property passport. Once verified, other agents can request
              access and bring you their customers.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="muted" size="sm">
                {stats.draftListings} drafts
              </Badge>
              <Badge variant="muted" size="sm">
                {stats.closedDeals} deals participated
              </Badge>
              {stats.shareRequests > 0 && (
                <Badge variant="warning" size="sm">
                  {stats.shareRequests} share requests waiting
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/agent/properties/new">
                <Plus aria-hidden />
                New listing
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/agent/inventory">
                <Network aria-hidden />
                Network inventory
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface OfferRow {
  id: string;
  distance_km: string | null;
  visits: {
    requested_date: string;
    requested_time: string;
    listings: { title: string } | null;
  } | null;
}

async function getVisitOffers(agentId: string): Promise<OfferRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("visit_assignments")
    .select("id, distance_km, visits ( requested_date, requested_time, listings ( title ) )")
    .eq("agent_id", agentId)
    .eq("status", "OFFERED")
    .order("offered_at", { ascending: false })
    .limit(5);
  return (data ?? []) as unknown as OfferRow[];
}

async function getPipeline(agentId: string): Promise<{ stage: string; count: number }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("stage")
    .eq("sales_agent_id", agentId)
    .not("stage", "in", "(CLOSED_WON,CLOSED_LOST)");

  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1);

  return [...counts.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);
}

interface AgentVisitRow {
  id: string;
  requested_date: string;
  requested_time: string;
  status: string;
  listings: { title: string } | null;
}

async function getUpcomingVisits(agentId: string): Promise<AgentVisitRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("id, requested_date, requested_time, status, listings ( title )")
    .eq("assigned_agent_id", agentId)
    .gte("requested_date", new Date().toISOString().slice(0, 10))
    .order("requested_date", { ascending: true })
    .limit(5);
  return (data ?? []) as unknown as AgentVisitRow[];
}
