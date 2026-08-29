import Link from "next/link";
import type { LucideIcon } from "lucide-react";
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
import { getAdminDashboard, getMarketplaceTotals, type Tally } from "@/lib/data/dashboard";
import { appConfig } from "@/config/app";
import { formatMoney, money } from "@/lib/domain/money";

/**
 * The admin overview.
 *
 * Every figure is counted from the database when the page is requested — none
 * of it is cached, estimated or placeheld — and each headline is the true
 * total, not a filtered view of it.
 *
 * Two things it refuses to do. It will not show a zero it could not verify: a
 * count that failed to read says so, because on a dashboard "0" and "I could
 * not tell" look identical and mean opposite things. And it will not let the
 * demo seed pass unremarked — `seed.sql` plants a whole working marketplace,
 * so every card that contains any of it says how much.
 */
export default async function AdminOverviewPage() {
  await requireUser("/admin");
  const [stats, totals] = await Promise.all([getAdminDashboard(), getMarketplaceTotals()]);

  const readAt = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: appConfig.timezone,
  });
  const demoRows =
    stats.properties.demo + stats.agents.demo + stats.customers.demo + stats.deals.demo;

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
      {stats.errors.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-destructive">
              Some figures could not be read, and are shown as zero.
            </p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {stats.errors.map((failure) => (
                <li key={failure.source}>
                  {failure.source}: {failure.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
          <TallyCard label="Property passports" tally={stats.properties} icon={Building2} />
          <TallyCard label="Live listings" tally={stats.activeListings} icon={ListChecks} />
          <TallyCard
            label="Deals"
            tally={stats.deals}
            icon={Handshake}
            extra={`${stats.closedDeals.total} closed`}
          />
          <StatCard
            label="GMV (closed)"
            value={formatMoney(money(totals.gmvMinor))}
            hint={
              totals.gmvDemoMinor > 0
                ? `${formatMoney(money(totals.gmvDemoMinor))} of it from demo deals`
                : undefined
            }
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
          <TallyCard label="Customers" tally={stats.customers} icon={Users} />
          <TallyCard label="Agents" tally={stats.agents} icon={Users} />
          <TallyCard label="Leads" tally={stats.leads} icon={Users} />
          <TallyCard label="Visits" tally={stats.visits} icon={Users} />
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
            hint={
              totals.commissionDemoMinor > 0
                ? `${formatMoney(money(totals.commissionDemoMinor))} of it from demo deals`
                : undefined
            }
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

      <p className="text-xs text-muted-foreground">
        Counted from the database at {readAt}.
        {demoRows > 0 && (
          <>
            {" "}
            This database still holds rows planted by <code className="font-mono">seed.sql</code>;
            every card that includes some says how many. To clear them, run{" "}
            <code className="font-mono">supabase/remove-demo-data.sql</code> — it deletes only rows
            flagged <code className="font-mono">is_demo</code>, keeps your administrator account,
            and leaves real data untouched.
          </>
        )}
      </p>

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

/**
 * A count with its demo share spelled out.
 *
 * The headline is the true total — subtracting the seed would show zero across
 * a freshly seeded database, which reads as "broken" rather than "all demo".
 * The demo share sits underneath instead, so the number is never overstated
 * and never silently deflated either.
 */
function TallyCard({
  label,
  tally,
  icon,
  extra,
}: {
  label: string;
  tally: Tally;
  icon: LucideIcon;
  extra?: string;
}) {
  const notes = [
    extra,
    tally.demo > 0
      ? tally.demo === tally.total
        ? "all from the demo seed"
        : `${tally.demo} from the demo seed`
      : null,
  ].filter(Boolean);

  return (
    <StatCard
      label={label}
      value={tally.total}
      icon={icon}
      hint={notes.length > 0 ? notes.join(" · ") : undefined}
    />
  );
}
