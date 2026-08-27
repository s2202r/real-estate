"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitListingForReview } from "@/lib/actions/listings";

export function SubmitListingButton({ listingId }: { listingId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (message) return <span className="text-xs text-success">{message}</span>;

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await submitListingForReview(listingId);
          if (result.ok) setMessage("Submitted");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
      Submit
    </Button>
  );
}
