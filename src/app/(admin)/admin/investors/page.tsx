import { notFound } from "next/navigation";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { features } from "@/config/features";
import { formatMoney, fromMajor } from "@/lib/domain/money";
import {
  AccountStatusControl,
  InvestorVerificationControl,
} from "../agents/account-status";

export const metadata = { title: "Investors" };

export default async function AdminInvestorsPage() {
  if (!features.ENABLE_INVESTOR_MODULE) notFound();
  await requireCapability("investor.verify");

  const [investors, agreements] = await Promise.all([getInvestors(), getAgreements()]);

  return (
    <div className="space-y-6">
      <Card className="border-warning/40">
        <CardContent className="flex items-start gap-3 p-5 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" aria-hidden />
          <p className="text-muted-foreground">
            No exclusive-inventory agreement can become ACTIVE without a recorded legal review. That
            is enforced by a database constraint, so it cannot be bypassed from this console.
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Investors</h2>
        {investors.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No investors registered" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {investors.map((investor) => (
              <Card key={investor.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{investor.entity_name ?? "Investor"}</p>
                    <Badge
                      variant={investor.verification_status === "APPROVED" ? "success" : "warning"}
                      size="sm"
                    >
                      {investor.verification_status}
                    </Badge>
                  </div>
                  <p className="tabular mt-2 text-sm text-muted-foreground">
                    {investor.ticket_size_min
                      ? formatMoney(fromMajor(investor.ticket_size_min, "INR"))
                      : "—"}{" "}
                    –{" "}
                    {investor.ticket_size_max
                      ? formatMoney(fromMajor(investor.ticket_size_max, "INR"))
                      : "—"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <Badge variant={investor.status === "ACTIVE" ? "success" : "muted"} size="sm">
                      {investor.status}
                    </Badge>
                    {/* Verification and standing are separate decisions: an
                        approved investor can still be suspended for conduct. */}
                    <InvestorVerificationControl
                      id={investor.id}
                      verificationStatus={investor.verification_status}
                      name={investor.entity_name ?? "this investor"}
                    />
                    <AccountStatusControl
                      kind="investor"
                      id={investor.id}
                      status={investor.status}
                      name={investor.entity_name ?? "this investor"}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Agreements</h2>
        {agreements.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No agreements" />
        ) : (
          <div className="space-y-3">
            {agreements.map((agreement) => (
              <Card key={agreement.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="tabular text-sm font-medium">{agreement.reference_code}</p>
                    <p className="text-xs text-muted-foreground">
                      {humanise(agreement.agreement_type)}
                      {agreement.legal_reviewed_at
                        ? ` · legal review recorded`
                        : " · awaiting legal review"}
                    </p>
                  </div>
                  <Badge
                    variant={agreement.status === "ACTIVE" ? "success" : "warning"}
                    size="sm"
                  >
                    {humanise(agreement.status)}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface InvestorRow {
  id: string;
  entity_name: string | null;
  verification_status: string;
  status: string;
  ticket_size_min: string | null;
  ticket_size_max: string | null;
}

async function getInvestors(): Promise<InvestorRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("investors")
    .select("id, entity_name, verification_status, status, ticket_size_min, ticket_size_max")
    .limit(100);
  return (data ?? []) as InvestorRow[];
}

interface AgreementRow {
  id: string;
  reference_code: string;
  agreement_type: string;
  status: string;
  legal_reviewed_at: string | null;
}

async function getAgreements(): Promise<AgreementRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("agreements")
    .select("id, reference_code, agreement_type, status, legal_reviewed_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as AgreementRow[];
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
