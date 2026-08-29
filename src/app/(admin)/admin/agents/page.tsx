import { Users } from "lucide-react";
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
import { EmptyState } from "@/components/shared/empty-state";
import { VerificationBadgeList } from "@/components/shared/verification-badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RecomputeStandingButton } from "./recompute-button";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import type { Enums } from "@/types/database";

export const metadata = { title: "Agents" };

export default async function AdminAgentsPage() {
  await requireCapability("agent.verify");
  const agents = await getAgents();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {agents.length} agents. Trust scores and earned badges are recomputed from observed
        behaviour — never self-reported.
      </p>

      {agents.length === 0 ? (
        <EmptyState icon={Users} title="No agents yet" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Badges</TableHead>
                <TableHead>Trust</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Deals</TableHead>
                <TableHead>Complaints</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <p className="font-medium">{agent.agency_name ?? "Agent"}</p>
                    <p className="text-xs text-muted-foreground">{agent.slug}</p>
                  </TableCell>
                  <TableCell>
                    <VerificationBadgeList badges={agent.badges} max={2} />
                  </TableCell>
                  <TableCell className="tabular">{Math.round(Number(agent.trust_score))}</TableCell>
                  <TableCell className="tabular">
                    {agent.rating_count > 0 ? Number(agent.rating_average).toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="tabular">{agent.closed_deal_count}</TableCell>
                  <TableCell className="tabular">
                    {agent.complaint_count > 0 ? (
                      <Badge variant="destructive" size="sm">
                        {agent.complaint_count}
                      </Badge>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={agent.status === "ACTIVE" ? "success" : "muted"} size="sm">
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* The profile is where a suspension decision is made:
                          the metrics behind it are not in this table. */}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/agents/${agent.id}`}>Open</Link>
                      </Button>
                      <RecomputeStandingButton agentId={agent.id} />
                    </div>
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

interface AgentRow {
  id: string;
  slug: string;
  agency_name: string | null;
  badges: Enums["agent_badge"][];
  trust_score: string;
  rating_average: string;
  rating_count: number;
  closed_deal_count: number;
  complaint_count: number;
  status: string;
}

async function getAgents(): Promise<AgentRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select(
      "id, slug, agency_name, badges, trust_score, rating_average, rating_count, closed_deal_count, complaint_count, status",
    )
    .order("trust_score", { ascending: false })
    .limit(200);
  return (data ?? []) as AgentRow[];
}
