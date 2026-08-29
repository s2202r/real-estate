"use client";

import { useActionState, useState } from "react";
import { Loader2, Save, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveListing } from "@/lib/actions/listings";
import { CityPicker } from "@/components/shared/city-picker";
import { supportedCities } from "@/config/app";
import { features } from "@/config/features";
import type { ActionResult } from "@/lib/actions/leads";

/**
 * Listing creation form.
 *
 * The AI assistant drafts a title, description and highlights, but its output
 * lands in editable fields that the agent must review before submitting (§31).
 * The agent is the author of record; the assistant is a first draft.
 */
export function ListingForm({
  amenities,
}: {
  amenities: readonly { key: string; label: string; category: string }[];
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ listingId: string }> | null,
    FormData
  >(saveListing, null);

  const [draft, setDraft] = useState<{
    title: string;
    description: string;
    highlights: string[];
  } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [listingType, setListingType] = useState("SALE");

  const generateDraft = async (form: HTMLFormElement) => {
    setDrafting(true);
    try {
      const data = new FormData(form);
      const response = await fetch("/api/v1/listings/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyType: data.get("propertyType"),
          bedrooms: Number(data.get("bedrooms")) || null,
          bathrooms: Number(data.get("bathrooms")) || null,
          area: Number(data.get("builtUpArea")) || null,
          locality: data.get("locality"),
          city: data.get("city"),
          price: String(data.get("price") ?? "0"),
          listingType: data.get("listingType"),
          furnishing: data.get("furnishing"),
          amenities: data.getAll("amenities").map(String),
        }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: { title: string; description: string; highlights: string[] };
      };
      if (payload.data) setDraft(payload.data);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <form action={formAction} className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Property details</CardTitle>
          <CardDescription>
            These facts create the property passport — the permanent identity of this physical
            property on the network.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Listing type" htmlFor="listingType">
            <select
              id="listingType"
              name="listingType"
              value={listingType}
              onChange={(event) => setListingType(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="SALE">For sale</option>
              <option value="RENT">For rent</option>
              <option value="LEASE">For lease</option>
            </select>
          </Field>

          <Field label="Property type" htmlFor="propertyType">
            <select
              id="propertyType"
              name="propertyType"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="APARTMENT">Apartment</option>
              <option value="BUILDER_FLOOR">Builder floor</option>
              <option value="VILLA">Villa</option>
              <option value="INDEPENDENT_HOUSE">Independent house</option>
              <option value="PENTHOUSE">Penthouse</option>
              <option value="STUDIO">Studio</option>
              <option value="PLOT">Plot</option>
              <option value="OFFICE">Office</option>
              <option value="SHOP">Shop</option>
            </select>
          </Field>

          {/* Anywhere in India, not just the cities the platform promotes: an
              agent's inventory is wherever it is. The state follows the city
              so the two can never contradict each other. */}
          <CityPicker
            id="city"
            className="sm:col-span-2"
            defaultValue={supportedCities[0].name}
            stateName="state"
            required
            error={state?.fieldErrors?.city}
            stateError={state?.fieldErrors?.state}
          />

          <Field label="Locality" htmlFor="locality" error={state?.fieldErrors?.locality}>
            <Input id="locality" name="locality" required placeholder="Sector 137" />
          </Field>

          <Field label="PIN code" htmlFor="pincode" error={state?.fieldErrors?.pincode}>
            <Input id="pincode" name="pincode" inputMode="numeric" placeholder="201305" />
          </Field>

          <Field label="Address line" htmlFor="addressLine1" className="sm:col-span-2">
            <Input id="addressLine1" name="addressLine1" placeholder="Tower B, Unit 1203" />
            <p className="text-xs text-muted-foreground">
              Kept private. Only the locality is shown publicly.
            </p>
          </Field>

          <Field label="Tower" htmlFor="tower">
            <Input id="tower" name="tower" placeholder="Tower B" />
          </Field>

          <Field label="Unit number" htmlFor="unitNumber">
            <Input id="unitNumber" name="unitNumber" placeholder="1203" />
          </Field>

          <Field label="Latitude" htmlFor="latitude">
            <Input id="latitude" name="latitude" type="number" step="0.0000001" placeholder="28.5041" />
          </Field>

          <Field label="Longitude" htmlFor="longitude">
            <Input id="longitude" name="longitude" type="number" step="0.0000001" placeholder="77.3910" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Bedrooms" htmlFor="bedrooms">
            <Input id="bedrooms" name="bedrooms" type="number" min={0} max={30} defaultValue={3} />
          </Field>
          <Field label="Bathrooms" htmlFor="bathrooms">
            <Input id="bathrooms" name="bathrooms" type="number" min={0} max={30} defaultValue={2} />
          </Field>
          <Field label="Balconies" htmlFor="balconies">
            <Input id="balconies" name="balconies" type="number" min={0} max={30} defaultValue={2} />
          </Field>

          <Field label="Built-up area (sq ft)" htmlFor="builtUpArea" error={state?.fieldErrors?.builtUpArea}>
            <Input id="builtUpArea" name="builtUpArea" type="number" required min={1} />
          </Field>
          <Field label="Carpet area (sq ft)" htmlFor="carpetArea" error={state?.fieldErrors?.carpetArea}>
            <Input id="carpetArea" name="carpetArea" type="number" min={1} />
          </Field>
          <Field label="Age (years)" htmlFor="ageYears">
            <Input id="ageYears" name="ageYears" type="number" min={0} max={200} />
          </Field>

          <Field label="Floor" htmlFor="floor" error={state?.fieldErrors?.floor}>
            <Input id="floor" name="floor" type="number" min={-5} max={200} />
          </Field>
          <Field label="Total floors" htmlFor="totalFloors">
            <Input id="totalFloors" name="totalFloors" type="number" min={0} max={200} />
          </Field>
          <Field label="Facing" htmlFor="facing">
            <select
              id="facing"
              name="facing"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Not specified</option>
              {["NORTH", "SOUTH", "EAST", "WEST", "NORTH_EAST", "NORTH_WEST", "SOUTH_EAST", "SOUTH_WEST"].map(
                (value) => (
                  <option key={value} value={value}>
                    {value.replace("_", " ").toLowerCase()}
                  </option>
                ),
              )}
            </select>
          </Field>

          <Field label="Furnishing" htmlFor="furnishing">
            <select
              id="furnishing"
              name="furnishing"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="UNFURNISHED">Unfurnished</option>
              <option value="SEMI_FURNISHED">Semi furnished</option>
              <option value="FULLY_FURNISHED">Fully furnished</option>
            </select>
          </Field>
          <Field label="Possession" htmlFor="possessionStatus">
            <select
              id="possessionStatus"
              name="possessionStatus"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="READY_TO_MOVE">Ready to move</option>
              <option value="UNDER_CONSTRUCTION">Under construction</option>
              <option value="NEW_LAUNCH">New launch</option>
              <option value="RESALE">Resale</option>
            </select>
          </Field>
          <Field label="Covered parking" htmlFor="coveredParking">
            <Input id="coveredParking" name="coveredParking" type="number" min={0} max={20} defaultValue={1} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Price (₹)" htmlFor="price" error={state?.fieldErrors?.price}>
            <Input id="price" name="price" required placeholder="8500000" inputMode="numeric" />
          </Field>
          <Field label="Maintenance (₹)" htmlFor="maintenanceCharge">
            <Input id="maintenanceCharge" name="maintenanceCharge" inputMode="numeric" />
          </Field>
          {listingType !== "SALE" && (
            <Field label="Security deposit (₹)" htmlFor="securityDeposit" error={state?.fieldErrors?.securityDeposit}>
              <Input id="securityDeposit" name="securityDeposit" inputMode="numeric" />
            </Field>
          )}
          <Field label="Brokerage (%)" htmlFor="brokerageValue">
            <Input
              id="brokerageValue"
              name="brokerageValue"
              type="number"
              step="0.1"
              min={0}
              max={100}
              defaultValue={1.5}
            />
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="isNegotiable"
              name="isNegotiable"
              type="checkbox"
              defaultChecked
              className="size-4 rounded border-input"
            />
            <Label htmlFor="isNegotiable" className="cursor-pointer font-normal">
              Price is negotiable
            </Label>
          </div>
        </CardContent>
      </Card>

      {amenities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Amenities</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {amenities.map((amenity) => (
              <label key={amenity.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="amenities"
                  value={amenity.key}
                  className="size-4 rounded border-input"
                />
                {amenity.label}
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Listing copy</CardTitle>
              <CardDescription>
                You are the author. Anything the assistant drafts must be reviewed before you
                submit.
              </CardDescription>
            </div>
            {features.ENABLE_AI_LISTING_ASSISTANT && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={drafting}
                onClick={(event) => {
                  const form = event.currentTarget.closest("form");
                  if (form) void generateDraft(form);
                }}
              >
                {drafting ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                Draft with assistant
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft && (
            <Badge variant="info">
              <Sparkles aria-hidden />
              Draft generated — review and edit before submitting
            </Badge>
          )}

          <Field label="Title" htmlFor="title" error={state?.fieldErrors?.title}>
            <Input
              id="title"
              name="title"
              required
              maxLength={160}
              key={draft?.title ?? "title"}
              defaultValue={draft?.title ?? ""}
              placeholder="3 BHK apartment for sale in Sector 137, Noida"
            />
          </Field>

          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={6}
              maxLength={5000}
              key={draft?.description ?? "description"}
              defaultValue={draft?.description ?? ""}
            />
          </Field>

          {(draft?.highlights ?? []).map((highlight, index) => (
            <input key={index} type="hidden" name="highlights" value={highlight} />
          ))}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cover image URL" htmlFor="coverImageUrl">
              <Input id="coverImageUrl" name="coverImageUrl" type="url" />
            </Field>
            <Field label="YouTube video or Short" htmlFor="youtubeUrl">
              <Input
                id="youtubeUrl"
                name="youtubeUrl"
                type="url"
                placeholder="https://youtube.com/shorts/…"
              />
            </Field>
            <Field label="Instagram Reel" htmlFor="instagramReelUrl">
              <Input
                id="instagramReelUrl"
                name="instagramReelUrl"
                type="url"
                placeholder="https://instagram.com/reel/…"
              />
            </Field>

            <Field label="Virtual tour URL" htmlFor="virtualTourUrl">
              <Input id="virtualTourUrl" name="virtualTourUrl" type="url" />
            </Field>
          </div>

          <Field label="RERA number" htmlFor="reraNumber">
            <Input id="reraNumber" name="reraNumber" placeholder="UPRERAPRJ123456" />
          </Field>

          <div className="flex items-center gap-2">
            <input
              id="isShareable"
              name="isShareable"
              type="checkbox"
              defaultChecked
              className="size-4 rounded border-input"
            />
            <Label htmlFor="isShareable" className="cursor-pointer font-normal">
              Allow other verified agents to request access to this listing
            </Label>
          </div>
        </CardContent>
      </Card>

      {state && !state.ok && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="submit" value="false" variant="outline" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          <Save aria-hidden />
          Save as draft
        </Button>
        <Button type="submit" name="submit" value="true" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          <Send aria-hidden />
          Submit for review
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Submitting sends this listing to platform moderation. It becomes publicly visible only
        after an administrator approves it — you cannot publish it yourself.
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error?.length ? <p className="text-xs text-destructive">{error[0]}</p> : null}
    </div>
  );
}
