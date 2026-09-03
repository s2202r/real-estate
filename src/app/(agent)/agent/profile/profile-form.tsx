"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CityMultiPicker } from "@/components/shared/city-multi-picker";
import { updateAgentProfile } from "@/lib/actions/agent-profile";
import { AGENT_LANGUAGES } from "@/lib/validation/profile";
import type { ActionResult } from "@/lib/actions/leads";

/**
 * The half of an agent's profile the agent writes.
 *
 * The other half — badges, trust score, ratings, response rate, standing — is
 * the platform's judgement of them and is deliberately absent. It is not
 * hidden here for tidiness: a write carrying those columns is reverted by a
 * trigger in the database, so the form and the table agree about what an agent
 * may say about themselves.
 */
export function AgentProfileForm({
  agencyName,
  headline,
  bio,
  experienceYears,
  languages,
  serviceCities,
  acceptsVisitRequests,
  maxVisitDistanceKm,
}: {
  agencyName: string | null;
  headline: string | null;
  bio: string | null;
  experienceYears: number;
  languages: readonly string[];
  serviceCities: readonly string[];
  acceptsVisitRequests: boolean;
  maxVisitDistanceKm: number;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateAgentProfile,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="agencyName">Agency name</Label>
          <Input id="agencyName" name="agencyName" defaultValue={agencyName ?? ""} maxLength={120} />
          <FieldError errors={state?.fieldErrors?.agencyName} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="experienceYears">Years of experience</Label>
          <Input
            id="experienceYears"
            name="experienceYears"
            type="number"
            min={0}
            max={70}
            defaultValue={experienceYears}
          />
          <FieldError errors={state?.fieldErrors?.experienceYears} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          name="headline"
          defaultValue={headline ?? ""}
          maxLength={160}
          placeholder="Resale flats in Noida Extension, 9 years"
        />
        <p className="text-xs text-muted-foreground">
          One line under your name in the directory.
        </p>
        <FieldError errors={state?.fieldErrors?.headline} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">About you</Label>
        <Textarea id="bio" name="bio" rows={5} maxLength={2000} defaultValue={bio ?? ""} />
        <p className="text-xs text-muted-foreground">
          What you specialise in and how you work. Customers read this before they enquire.
        </p>
        <FieldError errors={state?.fieldErrors?.bio} />
      </div>

      <CityMultiPicker
        name="serviceCities"
        label="Cities you work in"
        initial={serviceCities}
        error={state?.fieldErrors?.serviceCities}
        hint="Customers filter the directory by these, and visit offers are routed by them."
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Languages you work in</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {AGENT_LANGUAGES.map((language) => (
            <label key={language} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="languages"
                value={language}
                defaultChecked={languages.includes(language)}
                className="size-4 rounded border-input"
              />
              {language}
            </label>
          ))}
        </div>
        <FieldError errors={state?.fieldErrors?.languages} />
      </fieldset>

      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Visit marketplace</p>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="acceptsVisitRequests"
            defaultChecked={acceptsVisitRequests}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            Offer me visits on other agents&rsquo; listings
            <span className="block text-xs text-muted-foreground">
              You are paid from the visit pool for visits the customer confirms.
            </span>
          </span>
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="maxVisitDistanceKm">How far you will travel (km)</Label>
          <Input
            id="maxVisitDistanceKm"
            name="maxVisitDistanceKm"
            type="number"
            min={1}
            max={200}
            step="0.5"
            defaultValue={maxVisitDistanceKm}
            className="max-w-32"
          />
          <FieldError errors={state?.fieldErrors?.maxVisitDistanceKm} />
        </div>
      </div>

      {state && (
        <p
          className={
            state.ok
              ? "flex items-center gap-2 rounded-md bg-success-muted p-3 text-sm text-success"
              : "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          }
          role="status"
        >
          {state.ok && <CheckCircle2 className="size-4" aria-hidden />}
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Save profile
      </Button>
    </form>
  );
}

function FieldError({ errors }: { errors?: readonly string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors[0]}</p>;
}
