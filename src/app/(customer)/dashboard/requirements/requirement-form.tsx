"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createRequirement } from "@/lib/actions/leads";
import { CityPicker } from "@/components/shared/city-picker";
import { supportedCities } from "@/config/app";
import type { ActionResult } from "@/lib/actions/leads";

const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "BUILDER_FLOOR", label: "Builder floor" },
  { value: "VILLA", label: "Villa" },
  { value: "INDEPENDENT_HOUSE", label: "Independent house" },
  { value: "PLOT", label: "Plot" },
] as const;

export function RequirementForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string; reference: string }> | null,
    FormData
  >(createRequirement, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Post a requirement</CardTitle>
        <CardDescription>
          Tell the network what you want. Agents see the requirement, never your contact details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.ok ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-10 text-success" aria-hidden />
            <p className="text-sm font-medium">{state.message}</p>
            <p className="tabular text-xs text-muted-foreground">{state.data?.reference}</p>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="req-title">Title</Label>
              <Input
                id="req-title"
                name="title"
                placeholder="3BHK in Noida Extension under 1.5 Cr"
                maxLength={160}
              />
              <FieldError errors={state?.fieldErrors?.title} />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">I want to</legend>
              <div className="flex gap-2">
                {(
                  [
                    { value: "SALE", label: "Buy" },
                    { value: "RENT", label: "Rent" },
                  ] as const
                ).map((option, index) => (
                  <label key={option.value} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="listingType"
                      value={option.value}
                      defaultChecked={index === 0}
                      className="peer sr-only"
                      required
                    />
                    <span className="flex h-9 items-center justify-center rounded-md border text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Property type</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {PROPERTY_TYPES.map((type, index) => (
                  <label key={type.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="propertyTypes"
                      value={type.value}
                      defaultChecked={index === 0}
                      className="size-4 rounded border-input"
                    />
                    {type.label}
                  </label>
                ))}
              </div>
              <FieldError errors={state?.fieldErrors?.propertyTypes} />
            </fieldset>

            {/* Type-ahead over every Indian city rather than a ten-entry
                dropdown: someone looking in Indore should not have to find
                their requirement unpostable. */}
            <CityPicker
              id="req-city"
              defaultValue={supportedCities[0].name}
              required
              error={state?.fieldErrors?.city}
            />

            <div className="space-y-1.5">
              <Label htmlFor="req-localities">Preferred localities</Label>
              <Input
                id="req-localities"
                name="localities"
                placeholder="Sector 137, Noida Extension"
              />
              <p className="text-xs text-muted-foreground">Separate with commas.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-budget-min">Budget from (₹)</Label>
                <Input id="req-budget-min" name="budgetMin" type="number" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-budget-max">Budget up to (₹)</Label>
                <Input
                  id="req-budget-max"
                  name="budgetMax"
                  type="number"
                  inputMode="numeric"
                  required
                />
                <FieldError errors={state?.fieldErrors?.budgetMax} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-bedrooms">Bedrooms (min)</Label>
                <Input id="req-bedrooms" name="bedroomsMin" type="number" min={0} max={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-area">Area (min sq ft)</Label>
                <Input id="req-area" name="minArea" type="number" min={0} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="req-preferences">Anything else?</Label>
              <Textarea
                id="req-preferences"
                name="preferences"
                rows={3}
                maxLength={1000}
                placeholder="High floor, east facing, close to metro and good schools."
              />
            </div>

            <div className="flex items-start gap-2">
              <input
                id="isDiscoverable"
                name="isDiscoverable"
                type="checkbox"
                defaultChecked
                className="mt-1 size-4 rounded border-input"
              />
              <Label htmlFor="isDiscoverable" className="cursor-pointer text-xs font-normal leading-relaxed">
                Let verified agents discover this requirement. Turn this off to keep it private to
                agents you contact yourself.
              </Label>
            </div>

            {state && !state.ok && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Post requirement
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors[0]}</p>;
}
