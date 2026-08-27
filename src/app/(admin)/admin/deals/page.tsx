import { Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CommissionBreakdown } from "@/components/shared/commission-breakdown";
import { CommissionActions } from "./commission-actions";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoney, fromMajor } from "@/lib/domain/money";

export const metadata = { title: "Deals" };

/**
 * Deal management.
 *
 * The commission engine is invoked from here. It is deterministic, so running
 * it twice on unchanged inputs produces an identical result; a re-run after the
 * inputs change writes a NEW version and reverses the previous ledger entries
 * rather than editing them.
 */
export default async function AdminDealsPage() {
  await requireCapability("deal.manage");
  const deals = await getDeals();

  return (
    <div className="space-y-4">
      {deals.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No deals yet"
          description="Deals appear when an agent converts a lead into a transaction."
        />
      ) : (
        deals.map((deal) => {
          const calculation = deal.commission_calculations?.[0];

          return (
            <Card key={deal.id}>
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind="deal" status={deal.status} />
                      <Badge variant="outline" size="sm">
                        {deal.listing_type}
                      </Badge>
                      <span className="tabular text-xs text-muted-foreground">
                        {deal.reference_code}
                      </span>
                    </div>

                    <p className="mt-2 font-medium">
                      {deal.listings?.title ?? "Transaction"}
                    </p>

                    <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-muted-foreground">Final price</dt>
                        <dd className="tabular font-medium">
                          {deal.final_price
                            ? formatMoney(fromMajor(deal.final_price, "INR"))
                            : "Not agreed"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Commission pool</dt>
                        <dd className="tabular font-medium">
                          {deal.commission_pool
                            ? formatMoney(fromMajor(deal.commission_pool, "INR"))
                            : "From policy"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Participants</dt>
                        <dd className="tabular font-medium">
                          {deal.deal_participants?.length ?? 0}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <CommissionActions
                    dealId={deal.id}
                    hasCalculation={Boolean(calculation)}
                    isApproved={calculation?.status === "APPROVED"}
                  />
                </div>

                {calculation && (
                  <CommissionBreakdown
                    dealReference={deal.reference_code}
                    transactionValue={calculation.transaction_value}
                    commissionPool={calculation.commission_pool}
                    engineVersion={calculation.engine_version}
                    explanation={(calculation.explanation ?? []) as never}
                    distributions={(calculation.commission_distributions ?? []).map((row) => ({
                      role: row.role,
                      amount: row.amount,
                      sharePercent: row.share_percent ? Number(row.share_percent) : null,
                      tier: row.tier,
                      contributionScore: row.contribution_score
                        ? Number(row.contribution_score)
                        : null,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

interface DealRow {
  id: string;
  reference_code: string;
  status: string;
  listing_type: string;
  final_price: string | null;
  commission_pool: string | null;
  listings: { title: string } | null;
  deal_participants: { id: string }[] | null;
  commission_calculations:
    | {
        status: string;
        transaction_value: string;
        commission_pool: string;
        engine_version: string;
        explanation: unknown;
        commission_distributions: {
          role: string;
          amount: string;
          share_percent: string | null;
          tier: string | null;
          contribution_score: string | null;
        }[];
      }[]
    | null;
}

async function getDeals(): Promise<DealRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select(
      `id, reference_code, status, listing_type, final_price, commission_pool,
       listings ( title ),
       deal_participants ( id ),
       commission_calculations!inner ( status, transaction_value, commission_pool, engine_version, explanation,
         commission_distributions ( role, amount, share_percent, tier, contribution_score ) )`,
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (data && data.length > 0) return data as unknown as DealRow[];

  // `!inner` hides deals with no calculation yet, but those are exactly the
  // ones an operator needs to act on, so fetch them separately.
  const { data: uncalculated } = await supabase
    .from("deals")
    .select(
      `id, reference_code, status, listing_type, final_price, commission_pool,
       listings ( title ), deal_participants ( id )`,
    )
    .order("created_at", { ascending: false })
    .limit(25);

  return (uncalculated ?? []) as unknown as DealRow[];
}
