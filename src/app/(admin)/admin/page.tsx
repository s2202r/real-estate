import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Copy,
  Handshake,
  IndianRupee,
  ListChecks,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { requireUser } from "@/lib/auth/session";
import { getAdminDashboard, getMarketplaceTotals } from "@/lib/data/dashboard";
import { formatMoney, money } from "@/lib/domain/money";

export default async function AdminOverviewPage() {
  await requireUser("/admin");
  const [stats, totals] = await Promise.all([getAdminDashboard(), getMarketplaceTotals()]);

  const queues = [
    {
      label: "Listings awaiting review",
      value: stats.pendingListings,
      href: "/admin/listings",
      icon: ListChecks,
    },
    {
      label: "Agent verifications",
      value: stats.pendingAgentVerifications,
      href: "/admin/verifications",
      icon: BadgeCheck,
    },
    {
      label: "Duplicate candidates",
      value: stats.duplicateCandidates,
      href: "/admin/properties",
      icon: Copy,
    },
    {
      label: "Open disputes",
      value: stats.openDisputes,
      href: "/admin/disputes",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Work queues lead: an operator opens this page to find what needs doing. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Needs attention
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((queue) => (
            <Link key={queue.href} href={queue.href} className="block">
              <StatCard
                label={queue.label}
                value={queue.value}
                icon={queue.icon}
                accent={queue.value > 0 ? "warning" : "default"}
                className="transition-shadow hover:shadow-md"
              />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Marketplace
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Property passports" value={stats.totalProperties} icon={Building2} />
          <StatCard label="Live listings" value={stats.activeListings} icon={ListChecks} />
          <StatCard label="Deals" value={stats.deals} hint={`${stats.closedDeals} closed`} icon={Handshake} />
          <StatCard
            label="GMV (closed)"
            value={formatMoney(money(totals.gmvMinor))}
            icon={TrendingUp}
            accent="success"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Network
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Customers" value={stats.customers} icon={Users} />
          <StatCard label="Agents" value={stats.agents} icon={Users} />
          <StatCard label="Leads" value={stats.leads} icon={Users} />
          <StatCard label="Visits" value={stats.visits} icon={Users} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Commission
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total commission recorded"
            value={formatMoney(money(totals.commissionMinor))}
            icon={IndianRupee}
          />
          <StatCard
            label="Platform share"
            value={formatMoney(money(totals.platformMinor))}
            icon={IndianRupee}
            accent="info"
          />
          <StatCard
            label="Failed notifications"
            value={stats.failedNotifications}
            icon={AlertTriangle}
            accent={stats.failedNotifications > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operating notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            · No listing becomes publicly visible without approval here. Rejections must carry a
            reason — the agent is told why so they can fix it.
          </p>
          <p>
            · Duplicate candidates are LINKED, never auto-merged. Merging two genuinely distinct
            units destroys price and visit history.
          </p>
          <p>
            · Commission approval is irreversible in the sense that a PAID entry can never be
            rewritten; corrections are made as reversal and adjustment entries.
          </p>
          <p>
            · Every action on this console writes an append-only audit entry with your identity
            attached.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
