"use client";

import { useState, useTransition } from "react";
import { Calculator, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveCommission, runCommissionCalculation } from "@/lib/actions/admin";

/**
 * Commission controls.
 *
 * Calculate is safe to re-run: the engine is deterministic, and a re-run writes
 * a new version with reversal entries for the previous one rather than editing
 * settled history.
 */
export function CommissionActions({
  dealId,
  hasCalculation,
  isApproved,
}: {
  dealId: string;
  hasCalculation: boolean;
  isApproved: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={hasCalculation ? "outline" : "default"}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await runCommissionCalculation(dealId);
              setMessage({ ok: result.ok, text: result.message });
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Calculator aria-hidden />}
          {hasCalculation ? "Recalculate" : "Calculate commission"}
        </Button>

        {hasCalculation && !isApproved && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await approveCommission(dealId);
                setMessage({ ok: result.ok, text: result.message });
              })
            }
          >
            <CheckCircle2 aria-hidden />
            Approve payout
          </Button>
        )}
      </div>

      {message && (
        <p className={message.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
