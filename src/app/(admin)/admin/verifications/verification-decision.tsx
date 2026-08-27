"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideAgentVerification } from "@/lib/actions/admin";

export function VerificationDecision({ verificationId }: { verificationId: string }) {
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    return (
      <div className="rounded-lg border border-success/40 bg-success-muted p-4">
        <p className="text-sm font-medium text-success">{result.message}</p>
      </div>
    );
  }

  const decide = (decision: "APPROVED" | "REJECTED") =>
    startTransition(async () => {
      const response = await decideAgentVerification(verificationId, decision, {
        notes: decision === "APPROVED" ? notes || undefined : undefined,
        rejectionReason: decision === "REJECTED" ? notes || "Documents did not meet requirements." : undefined,
      });
      setResult(response);
    });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label htmlFor={`notes-${verificationId}`}>Notes / reason</Label>
        <Textarea
          id={`notes-${verificationId}`}
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Required when rejecting; the agent sees this."
        />
      </div>

      {result && !result.ok && (
        <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{result.message}</p>
      )}

      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("APPROVED")}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("REJECTED")}>
          <X aria-hidden />
          Reject
        </Button>
      </div>
    </div>
  );
}
