import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { defaultLandingPath } from "@/lib/auth/permissions";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Change password",
  robots: { index: false, follow: false },
};

/**
 * Change password, for every role.
 *
 * Deliberately outside the role route groups: an agent, a customer and an
 * administrator all change a password the same way, and the alternative was
 * three copies of one form drifting apart.
 */
export default async function ChangePasswordPage() {
  const user = await requireUser("/account/password");

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-lg space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={defaultLandingPath(user)}>
            <ArrowLeft aria-hidden />
            Back to my workspace
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-muted p-2">
                <ShieldCheck className="size-5 text-muted-foreground" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-xl">Change your password</CardTitle>
                <CardDescription>
                  Signed in as {user.email ?? user.fullName}. You will need your current password.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Cannot remember your current password?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Reset it by email instead
          </Link>
        </p>
      </div>
    </div>
  );
}
