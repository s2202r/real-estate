"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The six-digit code box.
 *
 * One input rather than six, deliberately: six separate boxes look tidy and
 * are miserable on a phone — they fight paste, they fight the keyboard's
 * autofill of an SMS or email code, and they lose a digit whenever focus
 * jumps. `autoComplete="one-time-code"` lets iOS and Android offer the code
 * straight from the notification, which is the fastest path there is.
 *
 * Non-digits are stripped as they are typed, so a code pasted as "123 456" or
 * "Code: 123456" still works.
 */
export function OtpField({
  value,
  onChange,
  error,
  id = "code",
  name = "code",
  label = "6-digit code",
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: readonly string[];
  id?: string;
  name?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        aria-invalid={Boolean(error)}
        placeholder="123456"
        className="tabular text-center text-lg tracking-[0.5em]"
      />
      {error ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
