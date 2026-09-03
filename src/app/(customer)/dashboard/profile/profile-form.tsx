"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityPicker } from "@/components/shared/city-picker";
import { updateMyProfile } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/leads";

/**
 * Your own details.
 *
 * Email is shown but not editable here: it identifies the account and signs
 * you in, so changing it needs a fresh verification round rather than a text
 * box. Changing the mobile number clears its verified status, because a
 * verified number is verified because a code reached THAT number.
 */
export function ProfileForm({
  fullName,
  displayName,
  phone,
  city,
  email,
}: {
  fullName: string;
  displayName: string | null;
  phone: string | null;
  city: string | null;
  email: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateMyProfile,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          name="fullName"
          defaultValue={fullName}
          required
          errors={state?.fieldErrors?.fullName}
        />
        <Field
          label="Display name"
          name="displayName"
          defaultValue={displayName ?? ""}
          hint="Optional. Shown instead of your full name where space is short."
          errors={state?.fieldErrors?.displayName}
        />
        <Field
          label="Mobile"
          name="phone"
          defaultValue={phone ?? ""}
          inputMode="numeric"
          placeholder="9876543210"
          hint="10 digits. Changing it means verifying it again."
          errors={state?.fieldErrors?.phone}
        />

        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email ?? ""} readOnly disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            This signs you in. Contact support to change it.
          </p>
        </div>

        <CityPicker
          id="profile-city"
          label="City"
          defaultValue={city ?? ""}
          placeholder="Where you are looking"
          className="sm:col-span-2"
          error={state?.fieldErrors?.city}
        />
      </div>

      {state && (
        <p
          className={
            state.ok
              ? "flex items-center gap-2 rounded-md bg-success-muted p-3 text-sm text-success"
              : "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          }
          role="status"
        >
          {state.ok && <CheckCircle2 className="size-4" aria-hidden />}
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Save details
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  errors,
  ...rest
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
  errors?: readonly string[];
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={Boolean(errors)}
        {...rest}
      />
      {errors ? (
        <p className="text-xs text-destructive">{errors[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
