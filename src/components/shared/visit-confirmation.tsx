"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmVisitAsCustomer } from "@/lib/actions/visits";

/**
 * Customer visit confirmation.
 *
 * This small control carries a lot of weight: it is the independent signal that
 * makes visit fraud hard. Without it, a visit cannot qualify, and an agent
 * cannot be paid from the visit pool — which is exactly why the customer, and
 * only the customer, can press it.
 */
export function VisitConfirmation({ visitId }: { visitId: string }) {
  const [done, setDone] = useState<null | boolean>(null);
  const [pending, startTransition] = useTransition();

  if (done !== null) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 className="size-4" aria-hidden />
        {done ? "Thanks — visit confirmed." : "Recorded. We will look into it."}
      </p>
    );
  }

  const respond = (didHappen: boolean) => {
    startTransition(async () => {
      const result = await confirmVisitAsCustomer(visitId, didHappen);
      if (result.ok) setDone(didHappen);
    });
  };

  return (
    <div className="text-right">
      <p className="mb-2 text-xs text-muted-foreground">Did this visit take place?</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => respond(false)}>
          <ThumbsDown aria-hidden />
          No
        </Button>
        <Button size="sm" disabled={pending} onClick={() => respond(true)}>
          <ThumbsUp aria-hidden />
          Yes
        </Button>
      </div>
    </div>
  );
}
