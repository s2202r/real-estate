import { AlertTriangle, Briefcase, IndianRupee, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoney, fromMajor, money } from "@/lib/domain/money";

export const metadata = { title: "Investor overview" };

export default async function InvestorDashboardPage() {
  const user = await requireUser("/investor/dashboard");
  const positions = user.investorId ? await getPositions(user.investorId) : [];

  const deployed = positions.reduce(
    (acc, position) => acc + Math.round(Number(position.capital_deployed) * 100),
    0,
  );
  const expected = positions.reduce(
    (acc, position) => acc + Math.round(Number(position.expected_return ?? 0) * 100),
    0,
  );
  const realised = positions.reduce(
    (acc, position) => acc + Math.round(Number(position.realised_return ?? 0) * 100),
    0,
  );

  return (
    <div className="space-y-6">
      <Card className="border-warning/40">
        <CardContent className="flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-foreground" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Indicative economics only</p>
            <p className="mt-1 text-muted-foreground">
              Nothing shown here is an offer of securities, nor an agreement to sell or transfer any
              interest in immovable property. Any arrangement is subject to a separate written
              agreement, independent legal advice and applicable law.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active positions" value={positions.length} icon={Briefcase} />
        <StatCard label="Capital deployed" value={formatMoney(money(deployed))} icon={IndianRupee} />
        <StatCard
          label="Expected return"
          value={formatMoney(money(expected))}
          icon={TrendingUp}
          accent="info"
        />
        <StatCard
          label="Realised return"
          value={formatMoney(money(realised))}
          icon={TrendingUp}
          accent="success"
        />
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No positions"
              description="Positions appear once an agreement has been legally reviewed and executed."
            />
          ) : (
            <ul className="space-y-3">
              {positions.map((position) => (
                <li
                  key={position.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{position.status}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      Entered {position.entered_on}
                    </p>
                  </div>
                  <span className="tabular text-sm font-medium">
                    {formatMoney(fromMajor(position.capital_deployed, "INR"))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface PositionRow {
  id: string;
  capital_deployed: string;
  expected_return: string | null;
  realised_return: string | null;
  status: string;
  entered_on: string;
}

async function getPositions(investorId: string): Promise<PositionRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("investor_positions")
    .select("id, capital_deployed, expected_return, realised_return, status, entered_on")
    .eq("investor_id", investorId)
    .order("entered_on", { ascending: false });
  return (data ?? []) as PositionRow[];
}
