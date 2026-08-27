"use client";

import { useState, useTransition } from "react";
import { ArrowUpCircle, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moderateReview, resolveDispute } from "@/lib/actions/admin";

export function DisputeDecision({ disputeId }: { disputeId: string }) {
  const [resolution, setResolution] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (message?.ok) {
    return (
      <div className="rounded-lg border border-success/40 bg-success-muted p-4">
        <p className="text-sm font-medium text-success">{message.text}</p>
      </div>
    );
  }

  const decide = (decision: "RESOLVED" | "REJECTED" | "ESCALATED") =>
    startTransition(async () => {
      const result = await resolveDispute(
        disputeId,
        decision,
        resolution || "No written resolution provided.",
      );
      setMessage({ ok: result.ok, text: result.message });
    });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label htmlFor={`resolution-${disputeId}`}>Decision and reasoning</Label>
        <Textarea
          id={`resolution-${disputeId}`}
          rows={4}
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          placeholder="Both parties see this. State what evidence you relied on."
        />
      </div>

      {message && !message.ok && (
        <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{message.text}</p>
      )}

      <div className="flex flex-col gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("RESOLVED")}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Uphold and resolve
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("REJECTED")}>
          <X aria-hidden />
          Reject claim
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("ESCALATED")}>
          <ArrowUpCircle aria-hidden />
          Escalate
        </Button>
      </div>
    </div>
  );
}

export function ReviewDecision({ reviewId }: { reviewId: string }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (message) return <p className="text-sm text-success">{message}</p>;

  const decide = (decision: "APPROVED" | "REJECTED") =>
    startTransition(async () => {
      const result = await moderateReview(reviewId, decision, reason || undefined);
      setMessage(result.message);
    });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label htmlFor={`review-reason-${reviewId}`}>Rejection reason</Label>
        <Textarea
          id={`review-reason-${reviewId}`}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Required when rejecting."
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("APPROVED")}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Publish
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("REJECTED")}>
          <X aria-hidden />
          Reject
        </Button>
      </div>
    </div>
  );
}
