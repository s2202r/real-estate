import { IndianRupee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoney, fromMajor, money } from "@/lib/domain/money";

export const metadata = { title: "Commissions" };

/**
 * Commission ledger and rules.
 *
 * The rules table is the point of §22: percentages are configuration, stored as
 * data and versioned. The engine snapshots the policy in force into each
 * calculation, so editing a rule here changes future payouts only.
 */
export default async function AdminCommissionsPage() {
  await requireCapability("commission.configure");
  const [ledger, rules] = await Promise.all([getLedger(), getRules()]);

  const totals = ledger.reduce(
    (acc, entry) => {
      acc.all += entry.amount_minor;
      if (entry.status === "PAID") acc.paid += entry.amount_minor;
      if (entry.status === "CALCULATED") acc.pending += entry.amount_minor;
      return acc;
    },
    { all: 0, paid: 0, pending: 0 },
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total recorded" value={formatMoney(money(totals.all))} icon={IndianRupee} />
        <StatCard
          label="Awaiting approval"
          value={formatMoney(money(totals.pending))}
          icon={IndianRupee}
          accent={totals.pending > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Paid"
          value={formatMoney(money(totals.paid))}
          icon={IndianRupee}
          accent="success"
        />
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Commission rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <EmptyState icon={IndianRupee} title="No commission rules configured" />
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const policy = rule.policy as { roleShares?: Record<string, number>; visitModel?: string } | null;
                return (
                  <div key={rule.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="tabular text-xs text-muted-foreground">
                          {rule.code} v{rule.version}
                          {rule.listing_type ? ` · ${rule.listing_type}` : ""}
                          {rule.city ? ` · ${rule.city}` : ""}
                        </p>
                      </div>
                      <Badge variant={rule.is_active ? "success" : "muted"} size="sm">
                        {rule.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Pool</dt>
                        <dd className="tabular">
                          {rule.pool_mode === "PERCENT_OF_TRANSACTION"
                            ? `${Number(rule.pool_percent ?? 0)}% of transaction`
                            : formatMoney(fromMajor(rule.pool_fixed_amount ?? "0", "INR"))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Visit model</dt>
                        <dd>{policy?.visitModel ?? rule.visit_model}</dd>
                      </div>
                      {rule.min_pool_amount && (
                        <div>
                          <dt className="text-xs text-muted-foreground">Minimum pool</dt>
                          <dd className="tabular">
                            {formatMoney(fromMajor(rule.min_pool_amount, "INR"))}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {policy?.roleShares && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {Object.entries(policy.roleShares).map(([role, share]) => (
                          <Badge key={role} variant="muted" size="sm">
                            {humanise(role)} {share}%
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Percentages live in the database, not in application code. Each calculation stores the
            policy it applied, so editing a rule affects future deals only.
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Ledger</h2>
        {ledger.length === 0 ? (
          <EmptyState icon={IndianRupee} title="No ledger entries" />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell>
                      <Badge
                        variant={entry.entry_type === "REVERSAL" ? "destructive" : "muted"}
                        size="sm"
                      >
                        {entry.entry_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap font-medium">
                      {formatMoney(money(entry.amount_minor))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="commission" status={entry.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}

interface LedgerRow {
  id: string;
  reference_code: string;
  role: string;
  entry_type: string;
  amount_minor: number;
  status: string;
  deals: { reference_code: string } | null;
}

async function getLedger(): Promise<LedgerRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_ledger")
    .select("id, reference_code, role, entry_type, amount_minor, status, deals ( reference_code )")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as LedgerRow[];
}

interface RuleRow {
  id: string;
  code: string;
  name: string;
  version: number;
  listing_type: string | null;
  city: string | null;
  pool_mode: string;
  pool_percent: string | null;
  pool_fixed_amount: string | null;
  min_pool_amount: string | null;
  visit_model: string;
  is_active: boolean;
  policy: unknown;
}

async function getRules(): Promise<RuleRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("commission_rules")
    .select(
      "id, code, name, version, listing_type, city, pool_mode, pool_percent, pool_fixed_amount, min_pool_amount, visit_model, is_active, policy",
    )
    .order("priority", { ascending: true });
  return (data ?? []) as RuleRow[];
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
