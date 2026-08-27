"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Route-level error boundary.
 *
 * Next's default screen says "a server error occurred" and offers a Reload
 * that repeats whatever failed. This one does two better things: `reset()`
 * re-renders the segment without a full page load, and the digest is shown,
 * because that string is the only way to find the matching line in the server
 * log.
 *
 * The message itself is never rendered — it is a server error, and its text
 * can name tables, columns and internal paths.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server already logged this; repeating it in the browser console gives
    // whoever is debugging the digest without opening the hosting dashboard.
    console.error("Route error", error.digest ?? "(no digest)", error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-16">
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden />
          </div>

          <h1 className="mt-5 text-xl font-semibold tracking-tight">This page didn&apos;t load</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Something failed on the server while building this page. Trying again often works — if
            it does not, the reference below identifies this exact failure in the server log.
          </p>

          {error.digest && (
            <p className="tabular mt-4 rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>
              <RotateCw aria-hidden />
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Go to the homepage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
