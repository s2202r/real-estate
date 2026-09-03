"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  describeCity,
  findCity,
  indianStates,
  searchCities,
  type IndianCity,
} from "@/data/india";
import { cn } from "@/lib/utils";

/**
 * City and state entry over the whole of India.
 *
 * A free-text city field produced "Bangalore", "Bengaluru" and "bengaluru" as
 * three different places, and a free-text state field let a Noida listing
 * claim Karnataka. Both are now chosen from one dataset, so a city always
 * arrives spelled the same way and always carries the state it is actually in.
 *
 * It is a combobox rather than a `<select>` because the list is six hundred
 * entries long: scrolling to Tiruchirappalli is worse than typing four letters
 * of it. The visible input carries the value directly, so the field still works
 * with the browser's autofill and with a plain form POST — no hidden state to
 * fall out of sync.
 *
 * Everything is driven by events (typing, clicking, keys) with no effects, so
 * there is no render-phase state to go stale under the React compiler.
 */
export function CityPicker({
  name = "city",
  id,
  defaultValue = "",
  /** Renders a matching state field alongside, filled in from the city. */
  stateName,
  defaultState = "",
  required,
  placeholder = "Start typing a city",
  className,
  label = "City",
  stateLabel = "State",
  error,
  stateError,
  onValueChange,
}: {
  name?: string;
  id?: string;
  defaultValue?: string;
  stateName?: string;
  defaultState?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
  stateLabel?: string;
  error?: readonly string[];
  stateError?: readonly string[];
  /** Notified as the field changes, for a caller that collects several. */
  onValueChange?: (value: string) => void;
}) {
  const generatedId = useId();
  const fieldId = id ?? `city-${generatedId}`;
  const listId = `${fieldId}-options`;

  const [value, setValue] = useState(defaultValue);
  const [state, setState] = useState(
    defaultState || (defaultValue ? (findCity(defaultValue)?.state ?? "") : ""),
  );
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // A state the person set by hand is not overwritten by a later city choice
  // unless that city is genuinely somewhere else.
  const stateTouched = useRef(Boolean(defaultState) && !defaultValue);

  const suggestions = useMemo(() => searchCities(value, 8), [value]);
  const resolved = useMemo(() => findCity(value, state) ?? findCity(value), [value, state]);

  const choose = (city: IndianCity) => {
    setValue(city.name);
    onValueChange?.(city.name);
    setState(city.state);
    stateTouched.current = false;
    setOpen(false);
    setHighlight(0);
  };

  const onType = (next: string) => {
    setValue(next);
    onValueChange?.(next);
    setOpen(true);
    setHighlight(0);

    // Typing a full city name (or pasting one) fills the state without a click.
    const match = findCity(next);
    if (match && !stateTouched.current) setState(match.state);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => {
        const next = current + step;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && open && suggestions[highlight]) {
      // Only swallow the key when it is choosing something; otherwise a city
      // typed in full would block the form from submitting.
      event.preventDefault();
      choose(suggestions[highlight]);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={cn("grid gap-4", stateName ? "sm:grid-cols-2" : undefined, className)}>
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={fieldId} className="text-sm font-medium">
            {label}
          </label>
        )}

        <div className="relative">
          <MapPin
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={fieldId}
            name={name}
            value={value}
            required={required}
            autoComplete="address-level2"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={Boolean(error)}
            placeholder={placeholder}
            maxLength={80}
            className="pl-9 pr-9"
            onChange={(event) => onType(event.target.value)}
            onFocus={() => setOpen(true)}
            // A click on a suggestion blurs the input first, so closing is
            // deferred past the click that would otherwise be lost.
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
          />

          {value ? (
            <button
              type="button"
              aria-label="Clear city"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
              onClick={() => {
                setValue("");
                onValueChange?.("");
                setOpen(true);
              }}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : (
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          )}

          {open && suggestions.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
            >
              {suggestions.map((city, index) => (
                <li key={city.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    // Runs before blur, so the choice is not lost to the close.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(city)}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm",
                      index === highlight && "bg-accent",
                    )}
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{city.name}</span>
                      <span className="text-muted-foreground">, {city.state}</span>
                    </span>
                    {city.name === value && <Check className="size-4 text-primary" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <p className="text-xs text-destructive">{error[0]}</p>
        ) : value && !resolved ? (
          <p className="text-xs text-muted-foreground">
            Not a city we know. Pick the nearest one from the list so buyers can find it.
          </p>
        ) : resolved ? (
          <p className="text-xs text-muted-foreground">{describeCity(resolved)}</p>
        ) : null}
      </div>

      {stateName && (
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-state`} className="text-sm font-medium">
            {stateLabel}
          </label>
          <select
            id={`${fieldId}-state`}
            name={stateName}
            value={state}
            required={required}
            aria-invalid={Boolean(stateError)}
            onChange={(event) => {
              stateTouched.current = true;
              setState(event.target.value);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a state</option>
            {indianStates.map((entry) => (
              <option key={entry.code} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
          {stateError ? (
            <p className="text-xs text-destructive">{stateError[0]}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Filled in from the city; change it if needed.</p>
          )}
        </div>
      )}
    </div>
  );
}
