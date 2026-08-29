"use client";

import { useState, useTransition } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setAgentStatus, setInvestorStanding } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/leads";

/**
 * Suspend or reinstate an account.
 *
 * The reason is not optional and not a formality: it is written to the audit
 * log and, for an agent, sent to them. Someone whose livelihood runs through
 * this platform and cannot find out why they were stopped has nothing to act
 * on and nothing to appeal.
 */
export function AccountStatusControl({
  kind,
  id,
  status,
  name,
}: {
  kind: "agent" | "investor";
  id: string;
  status: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const suspended = status === "SUSPENDED";

  const submit = () => {
    startTransition(async () => {
      const outcome =
        kind === "agent"
          ? await setAgentStatus(id, suspended ? "ACTIVE" : "SUSPENDED", reason)
          : await setInvestorStanding(id, suspended ? "REINSTATE" : "SUSPEND", reason);

      setResult(outcome);
      if (outcome.ok) {
        setOpen(false);
        setReason("");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={suspended ? "default" : "outline"} size="sm">
          {suspended ? <Play aria-hidden /> : <Pause aria-hidden />}
          {suspended ? "Reinstate" : "Suspend"}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {suspended ? "Reinstate" : "Suspend"} {name}
          </DialogTitle>
          <DialogDescription>
            {suspended
              ? "They return to the public directory and can operate again."
              : kind === "agent"
                ? "They leave the public directory immediately. Their existing listings stay up — taking down inventory is a separate decision, and customers may be mid-enquiry."
                : "They lose access to investor features while this stands."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="status-reason" className="text-sm font-medium">
            Reason
          </label>
          <Textarea
            id="status-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              suspended
                ? "What changed?"
                : "What happened? This is recorded, and the agent is told."
            }
          />
        </div>

        {result && !result.ok && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {result.message}
          </p>
        )}

        <Button onClick={submit} disabled={isPending || reason.trim().length < 5}>
          {isPending && <Loader2 className="animate-spin" aria-hidden />}
          {suspended ? "Reinstate account" : "Suspend account"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Approve or reject an investor's verification, separately from their standing. */
export function InvestorVerificationControl({
  id,
  verificationStatus,
  name,
}: {
  id: string;
  verificationStatus: string;
  name: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const decide = (decision: "APPROVE" | "REJECT") => {
    startTransition(async () => {
      setResult(
        await setInvestorStanding(
          id,
          decision,
          decision === "APPROVE"
            ? `Verification approved for ${name}.`
            : `Verification rejected for ${name}.`,
        ),
      );
    });
  };

  if (verificationStatus === "APPROVED") {
    return <span className="text-xs text-muted-foreground">Verification approved</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => decide("APPROVE")} disabled={isPending}>
        {isPending && <Loader2 className="animate-spin" aria-hidden />}
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => decide("REJECT")} disabled={isPending}>
        Reject
      </Button>
      {result && (
        <span className={result.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {result.message}
        </span>
      )}
    </div>
  );
}
