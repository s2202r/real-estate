import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { VerificationDecision } from "./verification-decision";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const metadata = { title: "Verifications" };

export default async function AdminVerificationsPage() {
  await requireCapability("agent.verify");
  const pending = await getPending();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Approving a verification grants the corresponding badge. Agents cannot grant badges to
        themselves — the database rejects the write — so this queue is the only path to a verified
        badge on the network.
      </p>

      {pending.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title="No verifications waiting"
          description="Submissions from agents appear here for review."
        />
      ) : (
        pending.map((verification) => (
          <Card key={verification.id}>
            <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_18rem]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge kind="verification" status={verification.status} />
                  <Badge variant="outline" size="sm">
                    {humanise(verification.level)}
                  </Badge>
                </div>

                <p className="mt-2 font-medium">
                  {verification.agents?.agency_name ?? verification.legal_name ?? "Agent"}
                </p>

                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  {verification.legal_name && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Legal name</dt>
                      <dd>{verification.legal_name}</dd>
                    </div>
                  )}
                  {verification.business_name && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Business</dt>
                      <dd>{verification.business_name}</dd>
                    </div>
                  )}
                  {verification.gst_number && (
                    <div>
                      <dt className="text-xs text-muted-foreground">GST</dt>
                      <dd className="tabular">{verification.gst_number}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted-foreground">Submitted</dt>
                    <dd className="tabular">
                      {new Date(verification.submitted_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-xs text-muted-foreground">
                  Documents are stored in a private bucket and opened through short-lived signed
                  URLs. Opening one is itself recorded.
                </p>
              </div>

              <VerificationDecision verificationId={verification.id} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

interface VerificationRow {
  id: string;
  level: string;
  status: string;
  legal_name: string | null;
  business_name: string | null;
  gst_number: string | null;
  submitted_at: string;
  agents: { agency_name: string | null } | null;
}

async function getPending(): Promise<VerificationRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_verifications")
    .select(
      "id, level, status, legal_name, business_name, gst_number, submitted_at, agents ( agency_name )",
    )
    .in("status", ["SUBMITTED", "UNDER_REVIEW"])
    .order("submitted_at", { ascending: true })
    .limit(50);
  return (data ?? []) as unknown as VerificationRow[];
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
