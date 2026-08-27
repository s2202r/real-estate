import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Heart,
  ListChecks,
  MessageSquare,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PropertyGrid } from "@/components/shared/property-card";
import { requireUser } from "@/lib/auth/session";
import { getCustomerDashboard } from "@/lib/data/dashboard";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { searchListings } from "@/lib/data/listings";

export default async function CustomerDashboardPage() {
  const user = await requireUser("/dashboard");

  if (!user.customerId) {
    return (
      <EmptyState
        icon={Search}
        title="No customer profile on this account"
        description="This account is registered with a different role. Switch to your agent or investor dashboard from the menu."
      />
    );
  }

  const stats = await getCustomerDashboard(user.customerId);
  const [upcomingVisits, recentLeads, recommended] = await Promise.all([
    getUpcomingVisits(user.customerId),
    getRecentLeads(user.customerId),
    getRecommended(user.city),
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Saved properties" value={stats.savedCount} icon={Heart} />
        <StatCard label="Active requirements" value={stats.requirementCount} icon={ListChecks} />
        <StatCard label="Enquiries" value={stats.enquiryCount} icon={MessageSquare} />
        <StatCard
          label="Upcoming visits"
          value={stats.upcomingVisitCount}
          icon={CalendarClock}
          accent={stats.upcomingVisitCount > 0 ? "success" : "default"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Upcoming visits</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/visits">
                All visits
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingVisits.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No visits booked"
                description="Find a property you like and book a site visit — an agent will be assigned even if the listing agent is busy."
                action={
                  <Button asChild size="sm">
                    <Link href="/properties">Browse properties</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {upcomingVisits.map((visit) => (
                  <li key={visit.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {visit.listings?.title ?? "Property visit"}
                      </p>
                      <p className="tabular text-xs text-muted-foreground">
                        {new Date(visit.requested_date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        at {visit.requested_time.slice(0, 5)}
                      </p>
                    </div>
                    <StatusBadge kind="visit" status={visit.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent enquiries</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No enquiries yet"
                description="When you contact an agent about a property, the conversation appears here."
              />
            ) : (
              <ul className="space-y-3">
                {recentLeads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {lead.listings?.title ?? "Property enquiry"}
                      </p>
                      <p className="tabular text-xs text-muted-foreground">
                        {lead.reference_code}
                      </p>
                    </div>
                    <StatusBadge kind="lead" status={lead.stage} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recommended for you</h2>
            <p className="text-sm text-muted-foreground">
              {user.city ? `Recently verified in ${user.city}.` : "Recently verified on the network."}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/properties">
              Browse all
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="mt-4">
          {recommended.length > 0 ? (
            <PropertyGrid listings={recommended} />
          ) : (
            <EmptyState
              icon={Search}
              title="Nothing to recommend yet"
              description="Post a requirement and agents on the network can bring matching inventory to you."
              action={
                <Button asChild size="sm">
                  <Link href="/dashboard/requirements">Post a requirement</Link>
                </Button>
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

interface VisitRow {
  id: string;
  requested_date: string;
  requested_time: string;
  status: string;
  listings: { title: string } | null;
}

async function getUpcomingVisits(customerId: string): Promise<VisitRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("id, requested_date, requested_time, status, listings ( title )")
    .eq("customer_id", customerId)
    .gte("requested_date", new Date().toISOString().slice(0, 10))
    .not("status", "in", "(CANCELLED,EXPIRED,REJECTED)")
    .order("requested_date", { ascending: true })
    .limit(5);
  return (data ?? []) as unknown as VisitRow[];
}

interface LeadRow {
  id: string;
  reference_code: string;
  stage: string;
  listings: { title: string } | null;
}

async function getRecentLeads(customerId: string): Promise<LeadRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, reference_code, stage, listings ( title )")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []) as unknown as LeadRow[];
}

async function getRecommended(city: string | null) {
  const result = await searchListings({
    city: city ?? undefined,
    pageSize: 3,
    sort: "newest",
  });
  return result.listings;
}
