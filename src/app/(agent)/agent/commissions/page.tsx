import { IndianRupee } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CommissionBreakdown } from "@/components/shared/commission-breakdown";
import { requireAgent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoney, fromMajor, money } from "@/lib/domain/money";

export const metadata = { title: "Earnings" };

/**
 * Agent earnings.
 *
 * Shows the full breakdown of every deal the agent participated in, including
 * what OTHER participants received. That is deliberate: transparent
 * distribution is the product promise, and an agent who can see the whole split
 * has no reason to suspect one.
 */
export default async function AgentCommissionsPage() {
  const user = await requireAgent();
  const [ledger, calculations] = await Promise.all([
    getLedger(user.agentId),
    getCalculations(user.agentId),
  ]);

  const totals = ledger.reduce(
    (acc, entry) => {
      if (entry.status === "PAID") acc.paid += entry.amount_minor;
      else if (entry.status === "APPROVED" || entry.status === "PAYMENT_PROCESSING")
        acc.approved += entry.amount_minor;
      else if (entry.status === "CALCULATED") acc.pending += entry.amount_minor;
      return acc;
    },
    { paid: 0, approved: 0, pending: 0 },
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={formatMoney(money(totals.pending))} icon={IndianRupee} />
        <StatCard
          label="Approved for payout"
          value={formatMoney(money(totals.approved))}
          icon={IndianRupee}
          accent="info"
        />
        <StatCard
          label="Paid to date"
          value={formatMoney(money(totals.paid))}
          icon={IndianRupee}
          accent="success"
        />
      </section>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Ledger</h2>
        {ledger.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title="No commission entries yet"
            description="Entries appear once a deal you contributed to is closed and the commission engine runs."
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="tabular whitespace-nowrap text-xs">
                      {entry.reference_code}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-xs">
                      {entry.deals?.reference_code ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {humanise(entry.role)}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap font-medium">
                      {formatMoney(fromMajor(entry.amount, "INR"))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="commission" status={entry.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {entry.calculation_rule ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {calculations.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Deal breakdowns</h2>
          <div className="space-y-5">
            {calculations.map((calculation) => (
              <CommissionBreakdown
                key={calculation.id}
                dealReference={calculation.deals?.reference_code ?? "—"}
                transactionValue={calculation.transaction_value}
                commissionPool={calculation.commission_pool}
                engineVersion={calculation.engine_version}
                explanation={(calculation.explanation ?? []) as never}
                distributions={(calculation.commission_distributions ?? []).map((distribution) => ({
                  role: distribution.role,
                  amount: distribution.amount,
                  sharePercent: distribution.share_percent ? Number(distribution.share_percent) : null,
                  tier: distribution.tier,
                  contributionScore: distribution.contribution_score
                    ? Number(distribution.contribution_score)
                    : null,
                  isYou: distribution.agent_id === user.agentId,
                }))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LedgerRow {
  id: string;
  reference_code: string;
  role: string;
  amount: string;
  amount_minor: number;
  status: string;
  calculation_rule: string | null;
  deals: { reference_code: string } | null;
}

async function getLedger(agentId: string): Promise<LedgerRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_ledger")
    .select(
      "id, reference_code, role, amount, amount_minor, status, calculation_rule, deals ( reference_code )",
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as LedgerRow[];
}

interface CalculationRow {
  id: string;
  transaction_value: string;
  commission_pool: string;
  engine_version: string;
  explanation: unknown;
  deals: { reference_code: string } | null;
  commission_distributions: {
    role: string;
    amount: string;
    share_percent: string | null;
    tier: string | null;
    contribution_score: string | null;
    agent_id: string | null;
  }[];
}

async function getCalculations(agentId: string): Promise<CalculationRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data: dealIds } = await supabase
    .from("deal_participants")
    .select("deal_id")
    .eq("agent_id", agentId);

  const ids = [...new Set((dealIds ?? []).map((row) => row.deal_id))];
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("commission_calculations")
    .select(
      `id, transaction_value, commission_pool, engine_version, explanation,
       deals ( reference_code ),
       commission_distributions ( role, amount, share_percent, tier, contribution_score, agent_id )`,
    )
    .in("deal_id", ids)
    .eq("is_current", true)
    .order("calculated_at", { ascending: false })
    .limit(10);

  return (data ?? []) as unknown as CalculationRow[];
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
