"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Search filters.
 *
 * State lives in the URL, not in React. That makes every filtered view
 * shareable, bookmarkable, back-button-correct and server-rendered — which
 * matters because these are the pages search engines index.
 */

const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "BUILDER_FLOOR", label: "Builder floor" },
  { value: "VILLA", label: "Villa" },
  { value: "INDEPENDENT_HOUSE", label: "Independent house" },
  { value: "PLOT", label: "Plot" },
  { value: "OFFICE", label: "Office" },
  { value: "SHOP", label: "Shop" },
] as const;

const FURNISHING = [
  { value: "UNFURNISHED", label: "Unfurnished" },
  { value: "SEMI_FURNISHED", label: "Semi furnished" },
  { value: "FULLY_FURNISHED", label: "Fully furnished" },
] as const;

const POSSESSION = [
  { value: "READY_TO_MOVE", label: "Ready to move" },
  { value: "UNDER_CONSTRUCTION", label: "Under construction" },
  { value: "NEW_LAUNCH", label: "New launch" },
  { value: "RESALE", label: "Resale" },
] as const;

const FACING = [
  { value: "NORTH", label: "North" },
  { value: "EAST", label: "East" },
  { value: "SOUTH", label: "South" },
  { value: "WEST", label: "West" },
  { value: "NORTH_EAST", label: "North east" },
  { value: "SOUTH_EAST", label: "South east" },
] as const;

const BEDROOMS = [1, 2, 3, 4, 5] as const;

export interface FilterPanelProps {
  localities?: readonly string[];
  className?: string;
}

export function FilterPanel({ localities = [], className }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      // Any filter change resets paging; page 4 of the old filter is meaningless.
      next.delete("page");
      startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const current = next.get(key)?.split(",").filter(Boolean) ?? [];
      const updated = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      if (updated.length === 0) next.delete(key);
      else next.set(key, updated.join(","));
      next.delete("page");
      startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  const isSelected = (key: string, value: string) =>
    (params.get(key)?.split(",") ?? []).includes(value);

  const activeCount = ["type", "bedrooms", "furnishing", "possession", "facing", "priceMin", "priceMax", "areaMin", "locality", "rera", "tour", "exclusive"].filter(
    (key) => params.get(key),
  ).length;

  const reset = () => {
    const next = new URLSearchParams();
    const preserved = ["q", "city", "listingType"];
    for (const key of preserved) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const body = (
    <div className={cn("space-y-6", isPending && "opacity-60 transition-opacity")}>
      <FilterGroup title="Transaction">
        <div className="flex gap-2">
          {(["SALE", "RENT"] as const).map((value) => (
            <Button
              key={value}
              variant={params.get("listingType") === value ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setParam("listingType", params.get("listingType") === value ? null : value)
              }
            >
              {value === "SALE" ? "Buy" : "Rent"}
            </Button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Budget (₹)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            defaultValue={params.get("priceMin") ?? ""}
            onBlur={(event) => setParam("priceMin", event.target.value)}
            aria-label="Minimum price"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            defaultValue={params.get("priceMax") ?? ""}
            onBlur={(event) => setParam("priceMax", event.target.value)}
            aria-label="Maximum price"
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Bedrooms">
        <div className="flex flex-wrap gap-2">
          {BEDROOMS.map((count) => (
            <Button
              key={count}
              variant={isSelected("bedrooms", String(count)) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMulti("bedrooms", String(count))}
            >
              {count} BHK
            </Button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Property type">
        <div className="space-y-2">
          {PROPERTY_TYPES.map((type) => (
            <CheckboxRow
              key={type.value}
              id={`type-${type.value}`}
              label={type.label}
              checked={isSelected("type", type.value)}
              onChange={() => toggleMulti("type", type.value)}
            />
          ))}
        </div>
      </FilterGroup>

      {localities.length > 0 && (
        <FilterGroup title="Locality">
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {localities.map((locality) => (
              <CheckboxRow
                key={locality}
                id={`locality-${locality}`}
                label={locality}
                checked={params.get("locality") === locality}
                onChange={() =>
                  setParam("locality", params.get("locality") === locality ? null : locality)
                }
              />
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Furnishing">
        <div className="space-y-2">
          {FURNISHING.map((option) => (
            <CheckboxRow
              key={option.value}
              id={`furnishing-${option.value}`}
              label={option.label}
              checked={isSelected("furnishing", option.value)}
              onChange={() => toggleMulti("furnishing", option.value)}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Possession">
        <div className="space-y-2">
          {POSSESSION.map((option) => (
            <CheckboxRow
              key={option.value}
              id={`possession-${option.value}`}
              label={option.label}
              checked={isSelected("possession", option.value)}
              onChange={() => toggleMulti("possession", option.value)}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Facing">
        <div className="flex flex-wrap gap-2">
          {FACING.map((option) => (
            <Button
              key={option.value}
              variant={isSelected("facing", option.value) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleMulti("facing", option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </FilterGroup>

      <Separator />

      <FilterGroup title="Trust and media">
        <div className="space-y-2">
          <CheckboxRow
            id="filter-rera"
            label="RERA registered agent"
            checked={params.get("rera") === "1"}
            onChange={() => setParam("rera", params.get("rera") === "1" ? null : "1")}
          />
          <CheckboxRow
            id="filter-tour"
            label="Has a virtual tour"
            checked={params.get("tour") === "1"}
            onChange={() => setParam("tour", params.get("tour") === "1" ? null : "1")}
          />
          <CheckboxRow
            id="filter-exclusive"
            label="Platform exclusive"
            checked={params.get("exclusive") === "1"}
            onChange={() => setParam("exclusive", params.get("exclusive") === "1" ? null : "1")}
          />
        </div>
      </FilterGroup>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={reset} className="w-full">
          <RotateCcw aria-hidden />
          Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: a persistent rail. */}
      <aside className={cn("hidden lg:block", className)} aria-label="Filters">
        {body}
      </aside>

      {/* Mobile: a sheet, so filters never eat the results. */}
      <div className="lg:hidden">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter aria-hidden />
              Filters
              {activeCount > 0 && (
                <Badge variant="default" size="sm">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
            </DialogHeader>
            {body}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                <X aria-hidden />
                Clear all
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}

/** Sort control, kept in the URL alongside the filters. */
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("sort") ?? "newest");

  const options = [
    { value: "newest", label: "Newest first" },
    { value: "price_asc", label: "Price: low to high" },
    { value: "price_desc", label: "Price: high to low" },
    { value: "area_desc", label: "Largest first" },
  ];

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort" className="whitespace-nowrap text-xs text-muted-foreground">
        Sort
      </Label>
      <select
        id="sort"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          const next = new URLSearchParams(searchParams.toString());
          next.set("sort", event.target.value);
          next.delete("page");
          router.push(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
