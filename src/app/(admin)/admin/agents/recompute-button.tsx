"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recomputeAgentStanding } from "@/lib/actions/admin";

export function RecomputeStandingButton({ agentId }: { agentId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (message) return <span className="text-xs text-muted-foreground">{message}</span>;

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await recomputeAgentStanding(agentId);
          setMessage(result.message);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      Recompute
    </Button>
  );
}
