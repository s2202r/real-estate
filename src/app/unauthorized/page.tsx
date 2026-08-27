import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Not authorised",
  robots: { index: false, follow: false },
};

export default function UnauthorizedPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="size-7 text-destructive" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">You do not have access</h1>
        <p className="mt-2 text-muted-foreground">
          Your account does not hold the role required for this area. If you believe this is a
          mistake, contact your platform administrator.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">My dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
