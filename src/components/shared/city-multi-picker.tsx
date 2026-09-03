"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CityPicker } from "@/components/shared/city-picker";
import { findCity } from "@/data/india";
import { Badge } from "@/components/ui/badge";

/**
 * A list of cities, built one at a time.
 *
 * Each chosen city is submitted as its own `serviceCities` field rather than
 * as a joined string, so an empty list is distinguishable from a list holding
 * one empty value — and so a city containing a comma could never split into
 * two.
 *
 * The picker below the list stays a single-city picker: reusing it means one
 * definition of what a valid city is, and the type-ahead behaves identically
 * everywhere it appears.
 */
export function CityMultiPicker({
  name,
  label,
  initial,
  max = 12,
  error,
  hint,
}: {
  name: string;
  label: string;
  initial: readonly string[];
  max?: number;
  error?: readonly string[];
  hint?: string;
}) {
  const [cities, setCities] = useState<string[]>(() => [...new Set(initial)]);
  const [draft, setDraft] = useState("");
  // Remounts the picker after each add, so its own input clears.
  const [pickerKey, setPickerKey] = useState(0);

  const add = () => {
    const resolved = findCity(draft)?.name ?? draft.trim();
    if (!resolved || cities.includes(resolved) || cities.length >= max) return;
    setCities((current) => [...current, resolved]);
    setDraft("");
    setPickerKey((key) => key + 1);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {cities.map((city) => (
        <input key={city} type="hidden" name={name} value={city} />
      ))}

      <div className="flex flex-wrap gap-2">
        {cities.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          cities.map((city) => (
            <Badge key={city} variant="muted" className="gap-1 pr-1">
              {city}
              <button
                type="button"
                aria-label={`Remove ${city}`}
                onClick={() => setCities((current) => current.filter((item) => item !== city))}
                className="rounded p-0.5 hover:bg-background/60"
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))
        )}
      </div>

      {cities.length < max && (
        <div className="flex items-end gap-2">
          <CityPicker
            key={pickerKey}
            id={`${name}-add`}
            name={`${name}-draft`}
            label=""
            placeholder="Add a city"
            defaultValue=""
            className="flex-1"
            onValueChange={setDraft}
          />
          <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
            <Plus aria-hidden />
            Add
          </Button>
        </div>
      )}

      {error ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
