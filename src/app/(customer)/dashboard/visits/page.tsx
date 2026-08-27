import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { VisitConfirmation } from "@/components/shared/visit-confirmation";
import { requireCustomer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const metadata = { title: "My site visits" };

export default async function CustomerVisitsPage() {
  const user = await requireCustomer();
  const visits = await getVisits(user.customerId);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = visits.filter(
    (visit) =>
      visit.requested_date >= today &&
      !["CANCELLED", "EXPIRED", "REJECTED", "COMPLETED", "QUALIFIED"].includes(visit.status),
  );
  const past = visits.filter((visit) => !upcoming.includes(visit));

  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming">
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No upcoming visits"
            description="Book a visit from any property page. If the listing agent is unavailable, a nearby verified agent will take it."
            action={
              <Button asChild>
                <Link href="/properties">Browse properties</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {upcoming.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="past">
        {past.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No past visits" />
        ) : (
          <div className="space-y-4">
            {past.map((visit) => (
              <VisitCard key={visit.id} visit={visit} showConfirmation />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

interface VisitRow {
  id: string;
  reference_code: string;
  requested_date: string;
  requested_time: string;
  status: string;
  visit_type: string;
  is_qualified: boolean;
  customer_confirmed_at: string | null;
  ended_at: string | null;
  listings: { title: string; locality: string; city: string; slug: string; reference_code: string } | null;
}

function VisitCard({ visit, showConfirmation }: { visit: VisitRow; showConfirmation?: boolean }) {
  const needsConfirmation =
    showConfirmation && visit.ended_at != null && visit.customer_confirmed_at == null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="visit" status={visit.status} />
            <Badge variant="outline" size="sm">
              {visit.visit_type === "PHYSICAL" ? "In person" : "Remote"}
            </Badge>
            {visit.is_qualified && (
              <Badge variant="success" size="sm">
                Confirmed visit
              </Badge>
            )}
          </div>

          <p className="mt-2 truncate font-medium">{visit.listings?.title ?? "Property visit"}</p>

          {visit.listings && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {visit.listings.locality}, {visit.listings.city}
            </p>
          )}

          <p className="tabular mt-2 text-sm text-muted-foreground">
            {new Date(visit.requested_date).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            at {visit.requested_time.slice(0, 5)} · {visit.reference_code}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {needsConfirmation && <VisitConfirmation visitId={visit.id} />}
        </div>
      </CardContent>
    </Card>
  );
}

async function getVisits(customerId: string): Promise<VisitRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select(
      `id, reference_code, requested_date, requested_time, status, visit_type,
       is_qualified, customer_confirmed_at, ended_at,
       listings ( title, locality, city, slug, reference_code )`,
    )
    .eq("customer_id", customerId)
    .order("requested_date", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as VisitRow[];
}
