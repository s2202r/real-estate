"use client";

import { useActionState } from "react";
import { Check, Loader2, Pause, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moderateListing } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/leads";

/**
 * Moderation decision panel.
 *
 * Rejection REQUIRES a reason (enforced by the schema, not just the form): a
 * rejection an agent cannot act on generates a support ticket and erodes trust
 * in the queue.
 */
export function ModerationPanel({
  listingId,
  suggestedScore,
}: {
  listingId: string;
  suggestedScore: number;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    moderateListing,
    null,
  );

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-success/40 bg-success-muted p-4">
        <p className="text-sm font-medium text-success">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="listingId" value={listingId} />

      <div className="space-y-1.5">
        <Label htmlFor={`score-${listingId}`}>Verification score</Label>
        <Input
          id={`score-${listingId}`}
          name="verificationScore"
          type="number"
          min={0}
          max={100}
          defaultValue={suggestedScore}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${listingId}`}>Review notes</Label>
        <Textarea id={`notes-${listingId}`} name="notes" rows={2} maxLength={1000} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`reason-${listingId}`}>Rejection reason</Label>
        <Textarea
          id={`reason-${listingId}`}
          name="rejectionReason"
          rows={2}
          maxLength={500}
          placeholder="Required when rejecting. The agent sees this."
        />
        {state?.fieldErrors?.rejectionReason && (
          <p className="text-xs text-destructive">{state.fieldErrors.rejectionReason[0]}</p>
        )}
      </div>

      {state && !state.ok && (
        <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{state.message}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="APPROVE" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="REJECT"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          <X aria-hidden />
          Reject
        </Button>
        <Button
          type="submit"
          name="decision"
          value="SUSPEND"
          size="sm"
          variant="ghost"
          disabled={pending}
        >
          <Pause aria-hidden />
          Suspend
        </Button>
      </div>
    </form>
  );
}
