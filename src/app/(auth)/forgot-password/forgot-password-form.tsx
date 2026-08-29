"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpField } from "@/components/auth/otp-field";
import { requestPasswordReset, resetPasswordWithCode } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/leads";

/**
 * Forgotten password, in two screens: ask for a code, then spend it on a new
 * password.
 *
 * The code and the new password are submitted together rather than the code
 * buying a session first. Otherwise anyone who can read the inbox is signed in
 * the moment they type six digits, and stays signed in if they wander off
 * without finishing — an account takeover that never had to set a password.
 */
export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");

  const [request, requestAction, requesting] = useActionState<
    ActionResult<{ email: string }> | null,
    FormData
  >(requestPasswordReset, null);

  const sentTo = request?.ok ? request.data?.email : undefined;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          {sentTo
            ? "Enter the code we emailed you, and choose a new password."
            : "Tell us the address on your account and we'll email you a 6-digit code."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {sentTo ? (
          <NewPasswordForm email={sentTo} message={request?.message} />
        ) : (
          <form action={requestAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(request?.fieldErrors?.email)}
              />
              {request?.fieldErrors?.email && (
                <p className="text-xs text-destructive">{request.fieldErrors.email[0]}</p>
              )}
            </div>

            {request && !request.ok && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {request.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={requesting}>
              {requesting && <Loader2 className="animate-spin" aria-hidden />}
              Email me a code
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function NewPasswordForm({ email, message }: { email: string; message?: string }) {
  const [code, setCode] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    resetPasswordWithCode,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="email" value={email} />

      <div className="rounded-md bg-muted p-3 text-sm">
        <p>{message}</p>
        <p className="mt-1 text-muted-foreground">
          Sent to <span className="font-medium text-foreground">{email}</span>, if that address has
          an account. Check your spam folder if it has not arrived.
        </p>
      </div>

      <OtpField value={code} onChange={setCode} error={state?.fieldErrors?.code} />

      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.fieldErrors?.password)}
        />
        <p className="text-xs text-muted-foreground">
          At least 10 characters, including a letter and a number.
        </p>
        {state?.fieldErrors?.password && (
          <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.fieldErrors?.confirmPassword)}
        />
        {state?.fieldErrors?.confirmPassword && (
          <p className="text-xs text-destructive">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      {state && !state.ok && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending || code.length < 6}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Set new password and sign in
      </Button>
    </form>
  );
}
