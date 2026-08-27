"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Heart,
  Loader2,
  MessageSquare,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { submitEnquiry, toggleFavourite, type ActionResult } from "@/lib/actions/leads";
import { requestVisit } from "@/lib/actions/visits";
import { cn } from "@/lib/utils";

/**
 * The enquiry and visit-booking panel.
 *
 * Sticky on desktop, fixed to the bottom on mobile (§49) — the two actions that
 * matter must never require scrolling to find.
 *
 * Note what is NOT here: the agent's phone number. Contact exchange is mediated
 * by the platform so that both sides are protected and the interaction is
 * attributable.
 */
export function EnquiryPanel({
  listingId,
  propertyId,
  agentName,
  isAuthenticated,
  isFavourited = false,
  className,
}: {
  listingId: string;
  propertyId: string;
  agentName: string;
  isAuthenticated: boolean;
  isFavourited?: boolean;
  className?: string;
}) {
  const [favourited, setFavourited] = useState(isFavourited);
  const [savePending, setSavePending] = useState(false);

  const handleSave = async () => {
    if (!isAuthenticated) return;
    setSavePending(true);
    const result = await toggleFavourite(listingId, propertyId);
    if (result.ok && result.data) setFavourited(result.data.favourited);
    setSavePending(false);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold">Interested in this property?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {agentName} will respond through the platform. Your contact details stay private until
            you choose to share them.
          </p>
        </div>

        <div className="grid gap-2">
          <VisitDialog listingId={listingId} isAuthenticated={isAuthenticated} />
          <EnquiryDialog
            listingId={listingId}
            agentName={agentName}
            isAuthenticated={isAuthenticated}
          />
          <Button
            variant="ghost"
            onClick={handleSave}
            disabled={!isAuthenticated || savePending}
            className="justify-start"
          >
            {savePending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Heart className={cn(favourited && "fill-current text-destructive")} aria-hidden />
            )}
            {favourited ? "Saved to shortlist" : "Save to shortlist"}
          </Button>
        </div>

        {!isAuthenticated && (
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
              Sign in
            </Link>{" "}
            to book a visit, enquire or save this property.
          </p>
        )}

        <p className="flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
          Your phone number is never shown to agents in bulk. An agent can only see it after you
          engage with them, and every access is logged for you to review.
        </p>
      </CardContent>
    </Card>
  );
}

function VisitDialog({
  listingId,
  isAuthenticated,
}: {
  listingId: string;
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ visitId: string; reference: string }> | null,
    FormData
  >(requestVisit, null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!isAuthenticated} className="w-full">
          <CalendarClock aria-hidden />
          Book a site visit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book a site visit</DialogTitle>
          <DialogDescription>
            Choose a slot. If the listing agent is unavailable, a verified agent nearby will take
            the visit — you will not be left waiting.
          </DialogDescription>
        </DialogHeader>

        {state?.ok ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-success" aria-hidden />
            <p className="font-medium">{state.message}</p>
            <Button asChild variant="outline">
              <Link href="/dashboard/visits">View my visits</Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="listingId" value={listingId} />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Visit type</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "PHYSICAL", label: "In person" },
                    { value: "VIRTUAL", label: "Virtual tour" },
                    { value: "LIVE_VIDEO", label: "Live video" },
                  ] as const
                ).map((option, index) => (
                  <label key={option.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="visitType"
                      value={option.value}
                      defaultChecked={index === 0}
                      className="peer sr-only"
                    />
                    <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="requestedDate">Preferred date</Label>
                <Input
                  id="requestedDate"
                  name="requestedDate"
                  type="date"
                  min={today}
                  defaultValue={today}
                  required
                  aria-invalid={Boolean(state?.fieldErrors?.requestedDate)}
                />
                <FieldError errors={state?.fieldErrors?.requestedDate} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requestedTime">Preferred time</Label>
                <Input
                  id="requestedTime"
                  name="requestedTime"
                  type="time"
                  defaultValue="16:00"
                  required
                  aria-invalid={Boolean(state?.fieldErrors?.requestedTime)}
                />
                <FieldError errors={state?.fieldErrors?.requestedTime} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="visit-notes">Anything the agent should know?</Label>
              <Textarea
                id="visit-notes"
                name="notes"
                rows={3}
                maxLength={500}
                placeholder="e.g. I would like to see the parking and the society clubhouse."
              />
            </div>

            {state && !state.ok && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.message}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Request visit
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EnquiryDialog({
  listingId,
  agentName,
  isAuthenticated,
}: {
  listingId: string;
  agentName: string;
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ leadId: string; reference: string }> | null,
    FormData
  >(submitEnquiry, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!isAuthenticated} className="w-full">
          <MessageSquare aria-hidden />
          Contact agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact {agentName}</DialogTitle>
          <DialogDescription>
            Your enquiry is delivered through the platform, so the conversation stays on record.
          </DialogDescription>
        </DialogHeader>

        {state?.ok ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-success" aria-hidden />
            <p className="font-medium">{state.message}</p>
            <Badge variant="secondary">Typical response: within a few hours</Badge>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="source" value="CUSTOMER_SEARCH" />

            <div className="space-y-1.5">
              <Label htmlFor="enquiry-message">Message</Label>
              <Textarea
                id="enquiry-message"
                name="message"
                rows={4}
                maxLength={1000}
                defaultValue="I am interested in this property. Please share more details and availability for a site visit."
              />
              <FieldError errors={state?.fieldErrors?.message} />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="requestCallback"
                name="requestCallback"
                type="checkbox"
                className="size-4 rounded border-input"
              />
              <Label htmlFor="requestCallback" className="cursor-pointer font-normal">
                <Phone className="mr-1 inline size-3.5" aria-hidden />
                Request a callback
              </Label>
            </div>

            {state && !state.ok && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.message}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Send enquiry
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors[0]}</p>;
}

/** Mobile sticky action bar. */
export function StickyEnquiryBar({
  listingId,
  isAuthenticated,
}: {
  listingId: string;
  isAuthenticated: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg gap-2">
        <VisitDialog listingId={listingId} isAuthenticated={isAuthenticated} />
      </div>
    </div>
  );
}
