"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpField } from "@/components/auth/otp-field";
import { requestLoginCode, signIn, verifyEmailCode } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/leads";

type Method = "password" | "code";

/**
 * Sign in, two ways.
 *
 * A password for people who have one, and a code emailed on demand for the
 * rest — which in practice is most people most of the time, and is the only
 * route left for anyone who signed up, never set a password they remember, and
 * would otherwise be stuck at a form they cannot get past.
 *
 * The two share one email box: switching method keeps whatever has been typed,
 * because retyping an address to change your mind is a small insult that adds
 * up.
 */
export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to manage your properties, visits and enquiries.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
          <MethodTab
            active={method === "password"}
            onClick={() => setMethod("password")}
            icon={KeyRound}
            label="Password"
          />
          <MethodTab
            active={method === "code"}
            onClick={() => setMethod("code")}
            icon={Mail}
            label="Email code"
          />
        </div>

        {method === "password" ? (
          <PasswordSignIn next={next} email={email} onEmailChange={setEmail} />
        ) : (
          <CodeSignIn next={next} email={email} onEmailChange={setEmail} />
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function MethodTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof KeyRound;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

function PasswordSignIn({
  next,
  email,
  onEmailChange,
}: {
  next: string;
  email: string;
  onEmailChange: (value: string) => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <EmailField value={email} onChange={onEmailChange} error={state?.fieldErrors?.email} />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <FormError state={state} />

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Sign in
      </Button>
    </form>
  );
}

function CodeSignIn({
  next,
  email,
  onEmailChange,
}: {
  next: string;
  email: string;
  onEmailChange: (value: string) => void;
}) {
  const [request, requestAction, requesting] = useActionState<
    ActionResult<{ email: string }> | null,
    FormData
  >(requestLoginCode, null);

  // The address the code went to, which is the one that must be verified —
  // not whatever the box says by the time the code arrives.
  const sentTo = request?.ok ? request.data?.email : undefined;

  if (!sentTo) {
    return (
      <form action={requestAction} className="space-y-4">
        <EmailField
          value={email}
          onChange={onEmailChange}
          error={request?.fieldErrors?.email}
          hint="We'll email you a 6-digit code. No password needed."
        />

        <FormError state={request} />

        <Button type="submit" className="w-full" disabled={requesting}>
          {requesting && <Loader2 className="animate-spin" aria-hidden />}
          Email me a code
        </Button>
      </form>
    );
  }

  return <CodeEntry email={sentTo} next={next} purpose="signin" message={request?.message} />;
}

/** Shared by the code sign-in and the register flow: spend a code. */
export function CodeEntry({
  email,
  next,
  purpose,
  message,
  onBack,
}: {
  email: string;
  next?: string;
  purpose: "signin" | "signup";
  message?: string;
  onBack?: () => void;
}) {
  const [code, setCode] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    verifyEmailCode,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="purpose" value={purpose} />
      {next && <input type="hidden" name="next" value={next} />}

      <div className="rounded-md bg-muted p-3 text-sm">
        <p>{message ?? "Enter the 6-digit code we emailed you."}</p>
        <p className="mt-1 text-muted-foreground">
          Sent to <span className="font-medium text-foreground">{email}</span>. It expires in an
          hour. Check your spam folder if it has not arrived.
        </p>
      </div>

      <OtpField value={code} onChange={setCode} error={state?.fieldErrors?.code} />

      <FormError state={state} />

      <Button type="submit" className="w-full" disabled={pending || code.length < 6}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {purpose === "signup" ? "Verify my email" : "Sign in"}
      </Button>

      {onBack && (
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
          <ArrowLeft aria-hidden />
          Use a different address
        </Button>
      )}
    </form>
  );
}

function EmailField({
  value,
  onChange,
  error,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: readonly string[];
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
      {state.message}
    </p>
  );
}
