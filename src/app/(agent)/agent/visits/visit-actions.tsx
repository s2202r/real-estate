"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, LogIn, MapPin, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { acceptVisit, checkInToVisit, completeVisit, declineVisit } from "@/lib/actions/visits";

export function VisitOfferActions({ visitId }: { visitId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (message) return <p className="text-sm text-muted-foreground">{message}</p>;

  return (
    <div className="flex shrink-0 gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await declineVisit(visitId);
            setMessage(result.message);
          })
        }
      >
        <X aria-hidden />
        Decline
      </Button>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptVisit(visitId);
            setMessage(result.message);
          })
        }
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Accept visit
      </Button>
    </div>
  );
}

/**
 * Conducting a visit.
 *
 * Check-in requests the browser's geolocation because the position is one of
 * the signals that qualifies the visit for commission. If the customer declines
 * the permission or the fix fails, check-in still proceeds without coordinates —
 * a missing fix is tolerated by the qualification rules, whereas a fix that
 * contradicts the property is not.
 */
export function VisitConductActions({
  visitId,
  started,
  customerConfirmed,
}: {
  visitId: string;
  started: boolean;
  customerConfirmed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(started);
  const [completeOpen, setCompleteOpen] = useState(false);

  const checkIn = () => {
    const submit = (position?: GeolocationPosition) =>
      startTransition(async () => {
        const result = await checkInToVisit({
          visitId,
          actor: "AGENT",
          latitude: position?.coords.latitude,
          longitude: position?.coords.longitude,
          accuracyMeters: position?.coords.accuracy,
        });
        setMessage(result.message);
        if (result.ok) setCheckedIn(true);
      });

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => submit(position),
        () => submit(),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    } else {
      submit();
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      <div className="flex gap-2">
        {!checkedIn ? (
          <Button size="sm" disabled={pending} onClick={checkIn}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
            Check in
          </Button>
        ) : (
          <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <CheckCircle2 aria-hidden />
                Complete visit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Complete this visit</DialogTitle>
                <DialogDescription>
                  Record what happened. The platform then evaluates whether the visit qualifies for
                  commission attribution — you cannot set that yourself.
                </DialogDescription>
              </DialogHeader>
              <CompleteVisitForm
                visitId={visitId}
                onDone={(text) => {
                  setMessage(text);
                  setCompleteOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {checkedIn && !customerConfirmed && (
        <p className="flex items-center gap-1 text-xs text-warning-foreground">
          <MapPin className="size-3" aria-hidden />
          Waiting on the customer to confirm
        </p>
      )}
    </div>
  );
}

function CompleteVisitForm({
  visitId,
  onDone,
}: {
  visitId: string;
  onDone: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState("INTERESTED");
  const [interest, setInterest] = useState(4);
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="outcome">Outcome</Label>
        <select
          id="outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="INTERESTED">Interested</option>
          <option value="NEGOTIATION_STARTED">Negotiation started</option>
          <option value="NEEDS_FOLLOW_UP">Needs follow up</option>
          <option value="PRICE_MISMATCH">Price mismatch</option>
          <option value="LOCATION_MISMATCH">Location mismatch</option>
          <option value="PROPERTY_MISMATCH">Property mismatch</option>
          <option value="NOT_INTERESTED">Not interested</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="interest">Customer interest (1–5)</Label>
        <input
          id="interest"
          type="range"
          min={1}
          max={5}
          value={interest}
          onChange={(event) => setInterest(Number(event.target.value))}
          className="w-full"
        />
        <p className="tabular text-xs text-muted-foreground">{interest} / 5</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="visit-notes">Notes</Label>
        <Textarea
          id="visit-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What did the customer like, and what are the next steps?"
        />
      </div>

      <DialogFooter>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await completeVisit({
                visitId,
                outcome,
                interestLevel: interest,
                notes: notes || undefined,
              });
              onDone(result.message);
            })
          }
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Complete visit
        </Button>
      </DialogFooter>
    </div>
  );
}
