"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requestInventoryAccess, respondToShareRequest } from "@/lib/actions/listings";

export function ShareRequestButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (result) return <span className="text-xs text-muted-foreground">{result}</span>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send aria-hidden />
          Request access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request access to this listing</DialogTitle>
          <DialogDescription>
            The owning agent decides. If they approve, you can share the property with your
            customer and register the lead — with the referral recorded, so attribution is not in
            dispute later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="share-message">Message to the owning agent</Label>
          <Textarea
            id="share-message"
            rows={3}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="I have a client actively looking in this locality with a matching budget."
          />
        </div>

        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const response = await requestInventoryAccess(listingId, message || undefined);
                setResult(response.message);
                setOpen(false);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShareResponseButtons({ shareId }: { shareId: string }) {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState("30");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (result) return <span className="text-sm text-muted-foreground">{result}</span>;

  const respond = (decision: "APPROVED" | "REJECTED", agreedSharePercent?: number) =>
    startTransition(async () => {
      const response = await respondToShareRequest(shareId, decision, { agreedSharePercent });
      setResult(response.message);
      setOpen(false);
    });

  return (
    <div className="flex shrink-0 gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => respond("REJECTED")}>
        <X aria-hidden />
        Decline
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Check aria-hidden />
            Approve
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve inventory access</DialogTitle>
            <DialogDescription>
              Optionally agree the commission share up front. Recording it now is what stops the
              argument at closing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="agreed-share">Agreed share for the requesting agent (%)</Label>
            <Input
              id="agreed-share"
              type="number"
              min={0}
              max={100}
              value={share}
              onChange={(event) => setShare(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => respond("APPROVED", Number(share) || undefined)}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Approve access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
