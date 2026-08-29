"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/leads";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    changePassword,
    null,
  );

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <p className="text-sm font-medium">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        errors={state?.fieldErrors?.currentPassword}
      />

      <Field
        label="New password"
        name="password"
        autoComplete="new-password"
        hint="At least 10 characters, including a letter and a number."
        errors={state?.fieldErrors?.password}
      />

      <Field
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        errors={state?.fieldErrors?.confirmPassword}
      />

      {state && !state.ok && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Change password
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  autoComplete,
  hint,
  errors,
}: {
  label: string;
  name: string;
  autoComplete: string;
  hint?: string;
  errors?: readonly string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(errors)}
      />
      {errors ? (
        <p className="text-xs text-destructive">{errors[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
