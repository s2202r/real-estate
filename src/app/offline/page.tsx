import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * The page the service worker serves when a navigation fails.
 *
 * It is deliberately static and self-contained: it has to render from cache
 * with no network at all, so it fetches nothing and shows no data. It also
 * does not pretend the app works offline — nothing here is cached, because
 * every page is either personalised or changes often.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-16">
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <Logo size={36} className="justify-center" />

          <div className="mx-auto mt-6 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <WifiOff className="size-6" aria-hidden />
          </div>

          <h1 className="mt-5 text-xl font-semibold tracking-tight">You are offline</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {appConfig.name} needs a connection to show verified inventory: listings, prices and
            availability change through the day, and showing you a stale copy would be worse than
            showing you none.
          </p>

          <div className="mt-6">
            <Button asChild>
              <Link href="/properties">Try again</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
