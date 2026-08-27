"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveDuplicate } from "@/lib/actions/admin";

export function DuplicateDecision({ candidateId }: { candidateId: string }) {
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (message) {
    return (
      <div className="rounded-lg border border-success/40 bg-success-muted p-4">
        <p className="text-sm font-medium text-success">{message}</p>
      </div>
    );
  }

  const decide = (decision: "CONFIRMED_DUPLICATE" | "NOT_DUPLICATE") =>
    startTransition(async () => {
      const result = await resolveDuplicate(candidateId, decision, notes || undefined);
      setMessage(result.message);
    });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label htmlFor={`dup-notes-${candidateId}`}>Adjudication notes</Label>
        <Textarea
          id={`dup-notes-${candidateId}`}
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What did you check to reach this conclusion?"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button size="sm" disabled={pending} onClick={() => decide("CONFIRMED_DUPLICATE")}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Same property
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => decide("NOT_DUPLICATE")}
        >
          <X aria-hidden />
          Different properties
        </Button>
      </div>
    </div>
  );
}
