"use client";

import { useActionState, useState } from "react";
import { Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveNriPreferences } from "@/lib/actions/nri";
import { NRI_TIME_ZONES, TIME_ZONE_REGIONS } from "@/lib/domain/timezones";
import type { ActionResult } from "@/lib/actions/leads";

const CURRENCIES = [
  { code: "INR", label: "Indian rupee (₹) — no second currency" },
  { code: "USD", label: "US dollar ($)" },
  { code: "AED", label: "UAE dirham (AED)" },
  { code: "GBP", label: "Pound sterling (£)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "SGD", label: "Singapore dollar (S$)" },
] as const;

/**
 * Buying from abroad.
 *
 * The copy does the important work here. Everything on this form is a DISPLAY
 * preference: a second currency does not change what a property costs, and a
 * timezone does not move a visit — it only shows the same appointment on the
 * clock the buyer actually reads. Somebody who thinks they have switched the
 * platform into dollars has been misled by the control, however correct the
 * code behind it is.
 */
export function NriPreferences({
  isNri,
  timeZone,
  displayCurrency,
}: {
  isNri: boolean;
  timeZone: string;
  displayCurrency: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveNriPreferences,
    null,
  );
  const [enabled, setEnabled] = useState(isNri);

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="isNri"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          <span className="text-sm font-medium">I am buying from outside India</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Turns on a second currency beside every price, and shows visit times on your clock as
            well as the property&apos;s.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="grid gap-4 border-l-2 pl-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="timeZone">Your timezone</Label>
            <select
              id="timeZone"
              name="timeZone"
              defaultValue={timeZone}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TIME_ZONE_REGIONS.map((region) => (
                <optgroup key={region} label={region}>
                  {NRI_TIME_ZONES.filter((zone) => zone.region === region).map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {state?.fieldErrors?.timeZone && (
              <p className="text-xs text-destructive">{state.fieldErrors.timeZone[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayCurrency">Show prices also in</Label>
            <select
              id="displayCurrency"
              name="displayCurrency"
              defaultValue={displayCurrency}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              An indicative conversion, at a rate we publish the date of. Every transaction is in
              rupees; your bank sets the rate you actually pay.
            </p>
          </div>
        </div>
      )}

      {state && (
        <p
          className={
            state.ok
              ? "rounded-md bg-success-muted p-3 text-sm text-success"
              : "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Globe2 aria-hidden />}
        Save preferences
      </Button>
    </form>
  );
}
