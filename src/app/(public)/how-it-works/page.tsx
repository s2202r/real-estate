import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calculator, Fingerprint, Network, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { appConfig } from "@/config/app";
import { getSessionUser } from "@/lib/auth/session";
import { canViewNetworkGuide } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How the verified inventory network works for customers, agents and investors — property passports, the visit marketplace and transparent commission.",
  alternates: { canonical: `${appConfig.url}/how-it-works` },
  // The guide is for signed-in agents and investors, so it is not a page
  // search engines should index or surface to the public.
  robots: { index: false, follow: false },
};

// The page renders differently per viewer (in fact, only for some viewers), so
// it must never be served from a prerendered shell.
export const dynamic = "force-dynamic";

export default async function HowItWorksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fhow-it-works");
  if (!canViewNetworkGuide(user)) redirect("/unauthorized");

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight">How it works</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {appConfig.name} models what actually happens in a property transaction: a physical
          property, several agents, a series of visits, and money that has to be split fairly at
          the end.
        </p>
      </header>

      <section className="mt-14">
        <div className="flex items-center gap-2">
          <Fingerprint className="size-5 text-primary" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight">1. One property, one identity</h2>
        </div>
        <p className="mt-3 text-muted-foreground">
          Every physical property gets a permanent Property Passport — an id like{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">PROP-NCR-0001827</code> that
          never changes and is never reused. Listings reference the passport rather than replacing
          it.
        </p>
        <p className="mt-3 text-muted-foreground">
          That means price history, visit history and verification history accumulate against the
          property. When a listing expires, the history does not vanish. When two agents both offer
          the same flat, you can see that it is the same flat.
        </p>
      </section>

      <Separator className="my-12" />

      <section>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight">2. Verification before publication</h2>
        </div>
        <p className="mt-3 text-muted-foreground">
          No listing is public until the platform has reviewed it. Agents pass identity
          verification, and RERA registration is checked against the issuing state authority where
          applicable.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Identity Verified", "Mobile, email and a government ID document."],
            ["RERA Verified", "A valid state RERA agent registration."],
            ["Trusted Agent", "Earned from transactions, ratings and reliability."],
            ["Top Performer", "Top of the network over the last 12 months."],
          ].map(([title, body]) => (
            <Card key={title}>
              <CardContent className="p-4">
                <Badge variant="success" size="sm">
                  {title}
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Badges are granted by the platform after review. An agent cannot award one to themselves —
          the database refuses the write.
        </p>
      </section>

      <Separator className="my-12" />

      <section>
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight">3. The visit marketplace</h2>
        </div>
        <p className="mt-3 text-muted-foreground">
          You pick a slot. The listing agent is offered it first. If they are unavailable, nearby
          verified agents are offered the visit in ranked order, and whoever accepts becomes your
          visiting agent. You stop waiting three days for a viewing.
        </p>
        <p className="mt-3 text-muted-foreground">
          A visit only counts once several independent signals agree: the agent checks in, you
          confirm it happened, it lasted long enough to be meaningful, and — for an in-person visit
          — the check-in location matches the property. This is what stops two agents inventing a
          visit to claim commission.
        </p>
      </section>

      <Separator className="my-12" />

      <section>
        <div className="flex items-center gap-2">
          <Calculator className="size-5 text-primary" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight">4. Commission you can audit</h2>
        </div>
        <p className="mt-3 text-muted-foreground">
          When a deal closes, a deterministic engine splits the commission pool across everyone who
          contributed: the listing agent, the sales agent, every agent who conducted a qualifying
          visit, any referrer, and the platform.
        </p>

        <Card className="mt-5">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Worked example
            </p>
            <pre className="tabular mt-3 overflow-x-auto text-sm leading-relaxed">
{`Transaction Value       ₹1,10,00,000
Commission Pool            ₹5,00,000

Listing Agent    20%       ₹1,00,000
Sales Agent      40%       ₹2,00,000
Visit Pool       15%         ₹75,000
Platform         25%       ₹1,25,000

Visit pool split
  Latest meaningful visit    ₹37,500
  Previous visit             ₹18,750
  Earlier qualifying visit   ₹18,750`}
            </pre>
          </CardContent>
        </Card>

        <p className="mt-4 text-muted-foreground">
          Percentages are configuration, not code, and the policy in force is snapshotted into the
          calculation — so changing a rule tomorrow can never rewrite yesterday&rsquo;s payout.
          Every agent sees the full derivation of their own figure.
        </p>
      </section>

      <Separator className="my-12" />

      <section>
        <div className="flex items-center gap-2">
          <Network className="size-5 text-primary" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight">5. Agents collaborate</h2>
        </div>
        <p className="mt-3 text-muted-foreground">
          An agent can request access to another agent&rsquo;s inventory. The owner approves or
          declines, optionally agreeing a share up front. Every referral is recorded, so nobody has
          to argue later about who introduced whom.
        </p>
      </section>

      <div className="mt-14 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/properties">
            Browse verified properties
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/register?role=agent">Join as an agent</Link>
        </Button>
      </div>
    </div>
  );
}
