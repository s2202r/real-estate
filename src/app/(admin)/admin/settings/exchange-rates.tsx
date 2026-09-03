"use client";

import { useActionState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteExchangeRate, saveExchangeRate } from "@/lib/actions/nri";
import type { ActionResult } from "@/lib/actions/leads";

export interface RateRow {
  readonly quote: string;
  readonly rate: string;
  readonly asOf: string;
  readonly source: string | null;
  readonly stale: boolean;
  readonly ageDays: number;
}

const QUOTES = ["USD", "AED", "GBP", "EUR", "SGD"] as const;

/**
 * Indicative display rates.
 *
 * Entered by hand, with the date they are FOR, because that is what they are:
 * a figure copied from somewhere on a particular day. There is no feed, and
 * pretending there is one — by defaulting the date to today — would make a
 * month-old rate look current.
 *
 * A pair with no row shows no conversion at all. That is deliberate: no rate
 * is better than an invented one, which on screen is indistinguishable from a
 * real one.
 */
export function ExchangeRatesEditor({ rates }: { rates: readonly RateRow[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveExchangeRate,
    null,
  );
  const [removeState, removeAction] = useActionState<ActionResult | null, FormData>(
    deleteExchangeRate,
    null,
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      {rates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rates published. Prices are shown in rupees only, which is the correct behaviour until
          somebody enters a real rate.
        </p>
      ) : (
        <ul className="space-y-2">
          {rates.map((row) => (
            <li
              key={row.quote}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="tabular text-sm font-medium">
                  1 ₹ = {row.rate} {row.quote}
                </p>
                <p className="text-xs text-muted-foreground">
                  for {row.asOf}
                  {row.stale && (
                    <span className="text-warning-foreground">
                      {" "}
                      · {row.ageDays} days old, shown to buyers with that warning
                    </span>
                  )}
                  {row.source ? ` · ${row.source}` : ""}
                </p>
              </div>

              <form action={removeAction}>
                <input type="hidden" name="quoteCurrency" value={row.quote} />
                <Button type="submit" variant="ghost" size="sm">
                  <Trash2 aria-hidden />
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {removeState && !removeState.ok && (
        <p className="text-xs text-destructive">{removeState.message}</p>
      )}

      <form action={formAction} className="grid gap-3 border-t pt-4 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="quoteCurrency">Currency</Label>
          <select
            id="quoteCurrency"
            name="quoteCurrency"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {QUOTES.map((quote) => (
              <option key={quote} value={quote}>
                {quote}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rate">Units per ₹1</Label>
          <Input
            id="rate"
            name="rate"
            inputMode="decimal"
            placeholder="0.01200000"
            required
            aria-invalid={Boolean(state?.fieldErrors?.rate)}
          />
          {state?.fieldErrors?.rate && (
            <p className="text-xs text-destructive">{state.fieldErrors.rate[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="asOf">Rate is for</Label>
          <Input
            id="asOf"
            name="asOf"
            type="date"
            max={today}
            required
            aria-invalid={Boolean(state?.fieldErrors?.asOf)}
          />
          {state?.fieldErrors?.asOf && (
            <p className="text-xs text-destructive">{state.fieldErrors.asOf[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="source">Source (optional)</Label>
          <Input id="source" name="source" placeholder="RBI reference rate" maxLength={120} />
        </div>

        <div className="sm:col-span-4">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            Publish rate
          </Button>
          {state && (
            <span
              className={
                state.ok ? "ml-3 text-xs text-success" : "ml-3 text-xs text-destructive"
              }
            >
              {state.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
