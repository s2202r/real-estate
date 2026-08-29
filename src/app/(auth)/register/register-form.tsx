"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Briefcase, CheckCircle2, Loader2, TrendingUp, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendSignUpCode, signUp, type SignUpOutcome } from "@/lib/actions/auth";
import { CodeEntry } from "../login/login-form";
import { features } from "@/config/features";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/leads";

const ROLES = [
  {
    value: "customer",
    label: "I'm looking for a property",
    icon: User,
    description: "Search verified listings, book visits and track your enquiries.",
  },
  {
    value: "agent",
    label: "I'm a real-estate agent",
    icon: Briefcase,
    description: "List inventory, take visits from the network and earn tracked commission.",
  },
  {
    value: "investor",
    label: "I'm an investor",
    icon: TrendingUp,
    description: "Access exclusive inventory opportunities, subject to verification.",
  },
] as const;

export function RegisterForm() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role");
  const [role, setRole] = useState<string>(
    ROLES.some((item) => item.value === initialRole) ? initialRole! : "customer",
  );
  const [state, formAction, pending] = useActionState<
    ActionResult<SignUpOutcome> | null,
    FormData
  >(signUp, null);

  // The investor module is legally gated and ships disabled; hiding the option
  // is clearer than letting someone sign up for a product that will not appear.
  const availableRoles = ROLES.filter(
    (item) => item.value !== "investor" || features.ENABLE_INVESTOR_MODULE,
  );

  // The address has to be proved before the account is any use. Asking for the
  // code here, rather than sending them off to find a link in their inbox,
  // keeps the whole of registration in one tab — the tab they are already in,
  // with everything they just typed still on screen behind the step.
  if (state?.ok && state.data?.needsVerification) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Confirm your email</CardTitle>
          <CardDescription>
            One last step. It proves the address is yours, which is what lets us send you visit
            confirmations and enquiry alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyEmailStep email={state.data.email} message={state.message} />
        </CardContent>
      </Card>
    );
  }

  if (state?.ok) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="size-12 text-success" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold">Account created</h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Button asChild>
            <Link href="/login">Continue to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>One account. Verified from the start.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">I am joining as</legend>
            <div className="grid gap-2">
              {availableRoles.map((item) => (
                <label
                  key={item.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    role === item.value ? "border-primary bg-accent" : "hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={item.value}
                    checked={role === item.value}
                    onChange={(event) => setRole(event.target.value)}
                    className="sr-only"
                  />
                  <item.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" autoComplete="name" required />
            <FieldError errors={state?.fieldErrors?.fullName} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
              <FieldError errors={state?.fieldErrors?.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="9810012001"
                required
              />
              <FieldError errors={state?.fieldErrors?.phone} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">
              At least 10 characters, including a letter and a number.
            </p>
            <FieldError errors={state?.fieldErrors?.password} />
          </div>

          <div className="flex items-start gap-2">
            <input
              id="acceptTerms"
              name="acceptTerms"
              type="checkbox"
              required
              className="mt-1 size-4 rounded border-input"
            />
            <Label htmlFor="acceptTerms" className="cursor-pointer text-xs font-normal leading-relaxed">
              I agree to the terms of service and privacy policy, and consent to my details being
              used to deliver the service.
            </Label>
          </div>
          <FieldError errors={state?.fieldErrors?.acceptTerms} />

          {state && !state.ok && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {state.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors[0]}</p>;
}

/**
 * The verification step, with a way out of the commonest failure.
 *
 * The code goes missing often enough — spam folder, slow relay, a typo in the
 * address — that "resend" is not a nicety. Resending is throttled server-side
 * per address, so the button cannot be turned into a way to bomb an inbox.
 */
function VerifyEmailStep({ email, message }: { email: string; message: string }) {
  const [resent, resendAction, resending] = useActionState<
    ActionResult<{ email: string }> | null,
    FormData
  >(resendSignUpCode, null);

  return (
    <div className="space-y-4">
      <CodeEntry email={email} purpose="signup" message={message} />

      <form action={resendAction} className="border-t pt-4 text-center">
        <input type="hidden" name="email" value={email} />
        <p className="text-sm text-muted-foreground">Nothing arrived?</p>
        <Button type="submit" variant="ghost" size="sm" disabled={resending}>
          {resending && <Loader2 className="animate-spin" aria-hidden />}
          Send the code again
        </Button>
        {resent && (
          <p
            className={resent.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}
            role="status"
          >
            {resent.message}
          </p>
        )}
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Wrong address?{" "}
        <Link href="/register" className="text-primary underline-offset-4 hover:underline">
          Start again
        </Link>
      </p>
    </div>
  );
}
