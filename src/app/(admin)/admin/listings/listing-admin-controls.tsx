"use client";

import { useActionState, useState } from "react";
import { Loader2, Pause, Pencil, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { moderateListing, updateListingAsAdmin } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/leads";

export interface EditableListing {
  readonly id: string;
  readonly reference_code: string;
  readonly title: string;
  readonly status: string;
  readonly description: string | null;
  readonly price: string;
  readonly bedrooms: number | null;
  readonly bathrooms: number | null;
  readonly built_up_area: string | null;
  readonly city: string;
  readonly locality: string;
}

/**
 * Per-listing controls on a listing that has already been decided.
 *
 * Two things the queue could not do: correct a field, and take a listing down
 * (or put it back). Both are here rather than in the review panel because they
 * apply to live inventory, not to a submission awaiting a first decision.
 */
export function ListingAdminControls({ listing }: { listing: EditableListing }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil aria-hidden />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {listing.reference_code}</DialogTitle>
            <DialogDescription>
              For correcting what is wrong — a typo, a price that contradicts the paperwork. Every
              change is recorded with its previous value, and the agent is told.
            </DialogDescription>
          </DialogHeader>
          <EditForm listing={listing} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <StatusControl listing={listing} />
    </div>
  );
}

function EditForm({ listing, onDone }: { listing: EditableListing; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateListingAsAdmin,
    null,
  );

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-success-muted p-3 text-sm text-success">{state.message}</p>
        <Button variant="outline" onClick={onDone}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="listingId" value={listing.id} />

      <FormField label="Title" name="title" defaultValue={listing.title} errors={state} />

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={4000}
          defaultValue={listing.description ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Price (₹)"
          name="price"
          type="number"
          defaultValue={listing.price}
          errors={state}
        />
        <FormField
          label="Built-up area (sq ft)"
          name="builtUpArea"
          type="number"
          defaultValue={listing.built_up_area ?? ""}
          errors={state}
        />
        <FormField
          label="Bedrooms"
          name="bedrooms"
          type="number"
          defaultValue={listing.bedrooms ?? ""}
          errors={state}
        />
        <FormField
          label="Bathrooms"
          name="bathrooms"
          type="number"
          defaultValue={listing.bathrooms ?? ""}
          errors={state}
        />
        <FormField label="Locality" name="locality" defaultValue={listing.locality} errors={state} />
        <FormField label="City" name="city" defaultValue={listing.city} errors={state} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Why are you changing this?</Label>
        <Textarea
          id="reason"
          name="reason"
          rows={2}
          maxLength={500}
          placeholder="Goes on the audit record and to the agent."
          required
        />
        {state?.fieldErrors?.reason && (
          <p className="text-xs text-destructive">{state.fieldErrors.reason[0]}</p>
        )}
      </div>

      {state && !state.ok && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        Save changes
      </Button>
    </form>
  );
}

function FormField({
  label,
  name,
  type = "text",
  defaultValue,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string | number;
  errors: ActionResult | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={Boolean(errors?.fieldErrors?.[name])}
      />
      {errors?.fieldErrors?.[name] && (
        <p className="text-xs text-destructive">{errors.fieldErrors[name][0]}</p>
      )}
    </div>
  );
}

/** Take a live listing down, or put a suspended one back. */
function StatusControl({ listing }: { listing: EditableListing }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    moderateListing,
    null,
  );

  const suspended = listing.status === "SUSPENDED";

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="listingId" value={listing.id} />
      <input
        type="hidden"
        name="rejectionReason"
        value={suspended ? "" : "Suspended from the admin console."}
      />
      <input type="hidden" name="notes" value={suspended ? "Reinstated." : "Suspended."} />

      <Button
        type="submit"
        name="decision"
        value={suspended ? "REINSTATE" : "SUSPEND"}
        size="sm"
        variant={suspended ? "default" : "ghost"}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : suspended ? (
          <Play aria-hidden />
        ) : (
          <Pause aria-hidden />
        )}
        {suspended ? "Reinstate" : "Suspend"}
      </Button>

      {state && (
        <span className={state.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
