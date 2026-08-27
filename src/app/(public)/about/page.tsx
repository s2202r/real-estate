import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: "About",
  description: `${appConfig.name} is a verified real-estate inventory network for customers, agents and investors.`,
  alternates: { canonical: `${appConfig.url}/about` },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight">About {appConfig.name}</h1>

      <div className="mt-8 space-y-5 text-muted-foreground">
        <p className="text-lg">
          Buying a home in India is not hard because there is too little information. It is hard
          because the information cannot be trusted.
        </p>
        <p>
          The same flat appears five times at three prices. Listings stay up months after the
          property is gone. A phone number, once given, is called for weeks. Agents who did the real
          work — the ones who showed the property on a Sunday afternoon — often get nothing when the
          deal closes elsewhere.
        </p>
        <p>
          {appConfig.name} is built to fix the record-keeping underneath all of that. Every physical
          property has one permanent identity. Every listing is reviewed before it is published.
          Every visit that earns money has to be independently confirmed by the customer. Every
          rupee of commission is split by a deterministic engine whose arithmetic each participant
          can inspect.
        </p>
        <p>
          The result is a network rather than a noticeboard: agents can collaborate on shared
          inventory instead of hoarding it, and customers see the right property regardless of which
          agent happens to hold it.
        </p>
      </div>

      <Card className="mt-10">
        <CardContent className="p-6">
          <h2 className="font-semibold">What we do not do</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>· We do not sell the same lead to five agents.</li>
            <li>· We do not publish a listing the platform has not reviewed.</li>
            <li>· We do not expose customer phone numbers to the agent network in bulk.</li>
            <li>
              · We do not claim to have verified legal title. Verification confirms that the
              information provided is complete and consistent; it is not a legal opinion on
              ownership.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/properties">Browse properties</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contact">Contact us</Link>
        </Button>
      </div>
    </div>
  );
}
