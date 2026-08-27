import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RevealContactButton } from "./reveal-contact";
import { requireAgent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoneyCompact, fromMajor } from "@/lib/domain/money";
import { maskName, maskPhone } from "@/lib/security/masking";

export const metadata = { title: "Leads" };

const OPEN_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPERTY_SHARED", "VISIT_REQUESTED", "VISIT_SCHEDULED", "VISIT_COMPLETED", "INTERESTED", "NEGOTIATION", "BOOKING", "FOLLOW_UP"];

/**
 * Agent CRM: leads.
 *
 * Customer identity is MASKED until the agent unlocks it, and unlocking is an
 * audited, quota-limited action. This page therefore shows enough to work the
 * lead — property, stage, budget, timing — without handing over a phone book.
 */
export default async function AgentLeadsPage() {
  const user = await requireAgent();
  const leads = await getLeads(user.agentId);

  const open = leads.filter((lead) => OPEN_STAGES.includes(lead.stage));
  const won = leads.filter((lead) => lead.stage === "CLOSED_WON");
  const lost = leads.filter((lead) => lead.stage === "CLOSED_LOST");

  return (
    <Tabs defaultValue="open">
      <TabsList>
        <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
        <TabsTrigger value="won">Won ({won.length})</TabsTrigger>
        <TabsTrigger value="lost">Lost ({lost.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="open">
        <LeadList leads={open} emptyTitle="No open leads" />
      </TabsContent>
      <TabsContent value="won">
        <LeadList leads={won} emptyTitle="No closed-won leads yet" />
      </TabsContent>
      <TabsContent value="lost">
        <LeadList leads={lost} emptyTitle="No lost leads" />
      </TabsContent>
    </Tabs>
  );
}

function LeadList({ leads, emptyTitle }: { leads: LeadRow[]; emptyTitle: string }) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={emptyTitle}
        description="Leads arrive when a customer enquires about your inventory or books a visit."
      />
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((lead) => (
        <Card key={lead.id}>
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge kind="lead" status={lead.stage} />
                <Badge variant="outline" size="sm">
                  {humanise(lead.source)}
                </Badge>
                {lead.is_contact_unlocked && (
                  <Badge variant="success" size="sm">
                    Contact unlocked
                  </Badge>
                )}
              </div>

              <p className="mt-2 truncate font-medium">
                {lead.listings?.title ?? "Direct enquiry"}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {/* Identity stays partial until the agent unlocks it. */}
                {maskName(lead.customers?.profiles?.full_name ?? null)} ·{" "}
                {lead.is_contact_unlocked
                  ? (lead.customers?.profiles?.phone ?? "No phone on file")
                  : maskPhone(lead.customers?.profiles?.phone ?? null)}
              </p>

              {lead.message && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{lead.message}</p>
              )}

              <p className="tabular mt-2 text-xs text-muted-foreground">
                {lead.reference_code}
                {lead.budget ? ` · budget ${formatMoneyCompact(fromMajor(lead.budget, "INR"))}` : ""}
                {lead.next_follow_up_at
                  ? ` · follow up ${new Date(lead.next_follow_up_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                  : ""}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {!lead.is_contact_unlocked && <RevealContactButton leadId={lead.id} />}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface LeadRow {
  id: string;
  reference_code: string;
  stage: string;
  source: string;
  message: string | null;
  budget: string | null;
  next_follow_up_at: string | null;
  is_contact_unlocked: boolean;
  listings: { title: string } | null;
  customers: { profiles: { full_name: string; phone: string | null } | null } | null;
}

async function getLeads(agentId: string): Promise<LeadRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      `id, reference_code, stage, source, message, budget, next_follow_up_at, is_contact_unlocked,
       listings ( title ),
       customers ( profiles ( full_name, phone ) )`,
    )
    .or(`sales_agent_id.eq.${agentId},listing_agent_id.eq.${agentId}`)
    .order("last_activity_at", { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as LeadRow[];
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
