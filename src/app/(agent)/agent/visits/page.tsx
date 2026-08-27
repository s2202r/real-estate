import { CalendarClock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { VisitOfferActions, VisitConductActions } from "./visit-actions";
import { requireAgent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const metadata = { title: "Visits" };

export default async function AgentVisitsPage() {
  const user = await requireAgent();
  const [offers, assigned] = await Promise.all([
    getOffers(user.agentId),
    getAssignedVisits(user.agentId),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = assigned.filter(
    (visit) => visit.requested_date >= today && !["QUALIFIED", "COMPLETED", "CANCELLED"].includes(visit.status),
  );
  const completed = assigned.filter((visit) => ["QUALIFIED", "COMPLETED"].includes(visit.status));

  return (
    <Tabs defaultValue={offers.length > 0 ? "offers" : "upcoming"}>
      <TabsList>
        <TabsTrigger value="offers">Opportunities ({offers.length})</TabsTrigger>
        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="offers">
        {offers.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No visit opportunities right now"
            description="When a customer books a visit in your service area and the listing agent is unavailable, it is offered to you here."
          />
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <Card key={offer.id}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning" size="sm">
                        Offer #{offer.offer_rank}
                      </Badge>
                      {offer.distance_km && (
                        <Badge variant="muted" size="sm">
                          {Number(offer.distance_km).toFixed(1)} km away
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 truncate font-medium">
                      {offer.visits?.listings?.title ?? "Property visit"}
                    </p>
                    <p className="tabular mt-1 text-sm text-muted-foreground">
                      {offer.visits?.requested_date} at {offer.visits?.requested_time?.slice(0, 5)}
                    </p>
                    {offer.expires_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Offer expires{" "}
                        {new Date(offer.expires_at).toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  {offer.visit_id && <VisitOfferActions visitId={offer.visit_id} />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="upcoming">
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No visits scheduled" />
        ) : (
          <div className="space-y-3">
            {upcoming.map((visit) => (
              <Card key={visit.id}>
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <StatusBadge kind="visit" status={visit.status} />
                    <p className="mt-2 truncate font-medium">
                      {visit.listings?.title ?? "Property visit"}
                    </p>
                    {visit.listings && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3.5" aria-hidden />
                        {visit.listings.locality}, {visit.listings.city}
                      </p>
                    )}
                    <p className="tabular mt-1 text-sm text-muted-foreground">
                      {visit.requested_date} at {visit.requested_time.slice(0, 5)} ·{" "}
                      {visit.reference_code}
                    </p>
                  </div>
                  <VisitConductActions
                    visitId={visit.id}
                    started={Boolean(visit.started_at)}
                    customerConfirmed={Boolean(visit.customer_confirmed_at)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="completed">
        {completed.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No completed visits" />
        ) : (
          <div className="space-y-3">
            {completed.map((visit) => (
              <Card key={visit.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="visit" status={visit.status} />
                    {visit.is_qualified ? (
                      <Badge variant="success" size="sm">
                        Qualified for commission
                      </Badge>
                    ) : (
                      <Badge variant="muted" size="sm">
                        Not qualified
                      </Badge>
                    )}
                    {visit.duration_minutes != null && (
                      <Badge variant="muted" size="sm">
                        {visit.duration_minutes} min
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 truncate font-medium">
                    {visit.listings?.title ?? "Property visit"}
                  </p>
                  <p className="tabular mt-1 text-xs text-muted-foreground">
                    {visit.requested_date} · {visit.reference_code}
                  </p>
                  {!visit.is_qualified && visit.disqualification_reason && (
                    <p className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                      {visit.disqualification_reason}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

interface OfferRow {
  id: string;
  visit_id: string | null;
  offer_rank: number;
  distance_km: string | null;
  expires_at: string | null;
  visits: {
    requested_date: string;
    requested_time: string;
    listings: { title: string } | null;
  } | null;
}

async function getOffers(agentId: string): Promise<OfferRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("visit_assignments")
    .select(
      "id, visit_id, offer_rank, distance_km, expires_at, visits ( requested_date, requested_time, listings ( title ) )",
    )
    .eq("agent_id", agentId)
    .eq("status", "OFFERED")
    .order("offered_at", { ascending: false });
  return (data ?? []) as unknown as OfferRow[];
}

interface AssignedVisitRow {
  id: string;
  reference_code: string;
  requested_date: string;
  requested_time: string;
  status: string;
  started_at: string | null;
  customer_confirmed_at: string | null;
  is_qualified: boolean;
  duration_minutes: number | null;
  disqualification_reason: string | null;
  listings: { title: string; locality: string; city: string } | null;
}

async function getAssignedVisits(agentId: string): Promise<AssignedVisitRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select(
      `id, reference_code, requested_date, requested_time, status, started_at,
       customer_confirmed_at, is_qualified, duration_minutes, disqualification_reason,
       listings ( title, locality, city )`,
    )
    .eq("assigned_agent_id", agentId)
    .order("requested_date", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as AssignedVisitRow[];
}
