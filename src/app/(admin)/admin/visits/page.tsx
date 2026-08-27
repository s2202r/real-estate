import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const metadata = { title: "Visits" };

/**
 * Visit oversight.
 *
 * The qualification column is the one that matters operationally: an unusual
 * rate of unqualified visits for one agent is the leading indicator of either a
 * process problem or an attempt to farm the visit pool.
 */
export default async function AdminVisitsPage() {
  await requireCapability("visit.override");
  const visits = await getVisits();

  const qualified = visits.filter((visit) => visit.is_qualified).length;
  const completed = visits.filter((visit) =>
    ["COMPLETED", "QUALIFIED"].includes(visit.status),
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {visits.length} recent visits · {completed} completed · {qualified} qualified for commission
        attribution.
      </p>

      {visits.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No visits recorded" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Qualified</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell className="tabular whitespace-nowrap text-xs">
                    {visit.reference_code}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm">
                    {visit.listings?.title ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {visit.agents?.agency_name ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-xs">
                    {visit.requested_date}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="visit" status={visit.status} />
                  </TableCell>
                  <TableCell>
                    {visit.is_qualified ? (
                      <Badge variant="success" size="sm">
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="muted" size="sm" title={visit.disqualification_reason ?? undefined}>
                        No
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular text-xs">
                    {visit.duration_minutes != null ? `${visit.duration_minutes} min` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

interface VisitRow {
  id: string;
  reference_code: string;
  requested_date: string;
  status: string;
  is_qualified: boolean;
  duration_minutes: number | null;
  disqualification_reason: string | null;
  listings: { title: string } | null;
  agents: { agency_name: string | null } | null;
}

async function getVisits(): Promise<VisitRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select(
      `id, reference_code, requested_date, status, is_qualified, duration_minutes,
       disqualification_reason, listings ( title ),
       agents!visits_assigned_agent_id_fkey ( agency_name )`,
    )
    .order("requested_date", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as VisitRow[];
}
