"use client";

import { useState, useTransition } from "react";
import { Eye, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { revealContact } from "@/lib/actions/leads";

/**
 * Contact reveal.
 *
 * The confirmation step is intentional friction. The agent is told, before
 * they act, that the customer will see this access in their own dashboard —
 * which is a far more effective control on casual scraping than a silent quota.
 */
export function RevealContactButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; phone?: string; email?: string } | null>(
    null,
  );

  const reveal = () => {
    startTransition(async () => {
      const response = await revealContact(leadId);
      setResult({
        ok: response.ok,
        message: response.message,
        phone: response.data?.phone,
        email: response.data?.email,
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye aria-hidden />
          Reveal contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reveal customer contact details</DialogTitle>
          <DialogDescription>
            This is recorded. The customer can see that you accessed their details, and when.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className={result.ok ? "text-sm text-success" : "text-sm text-destructive"}>
              {result.message}
            </p>
            {result.ok && (
              <dl className="space-y-2 rounded-lg border p-4">
                <div className="flex justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Phone</dt>
                  <dd className="tabular text-sm font-medium">{result.phone}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd className="truncate text-sm font-medium">{result.email}</dd>
                </div>
              </dl>
            )}
          </div>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Reveals are limited per day and are audited. Use them for customers you are actively
              working with.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={reveal} disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Reveal and record
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
