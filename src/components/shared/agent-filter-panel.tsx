"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckboxRow,
  ClearFiltersButton,
  FilterGroup,
  FilterShell,
} from "@/components/shared/filter-shell";
import { supportedCities } from "@/config/app";
import { cn } from "@/lib/utils";

/**
 * Agent directory filters.
 *
 * Like the property filters, state lives in the URL rather than in React, so
 * every filtered view of the directory is shareable and server-rendered.
 *
 * The options here are the ones `searchAgents` can actually answer — city,
 * specialisation, language, RERA registration. Nothing is offered that the
 * query cannot honour.
 */

const SPECIALISATIONS = [
  { value: "APARTMENT", label: "Apartments" },
  { value: "BUILDER_FLOOR", label: "Builder floors" },
  { value: "VILLA", label: "Villas" },
  { value: "INDEPENDENT_HOUSE", label: "Independent houses" },
  { value: "PLOT", label: "Plots" },
  { value: "OFFICE", label: "Offices" },
  { value: "SHOP", label: "Shops" },
] as const;

const LANGUAGES = ["Hindi", "English", "Punjabi", "Bengali", "Marathi", "Tamil", "Telugu"] as const;

const FILTER_KEYS = ["city", "specialisation", "language", "rera"] as const;

export function AgentFilterPanel({ className }: { className?: string }) {
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

  const toggleParam = (key: string, value: string) =>
    setParam(key, params.get(key) === value ? null : value);

  const activeCount = FILTER_KEYS.filter((key) => params.get(key)).length;

  const reset = () =>
    startTransition(() => router.push(pathname, { scroll: false }));

  const body = (
    <div className={cn("space-y-6", isPending && "opacity-60 transition-opacity")}>
      <FilterGroup title="City">
        <div className="flex flex-wrap gap-2">
          {supportedCities.map((city) => (
            <Button
              key={city.slug}
              variant={params.get("city") === city.name ? "default" : "outline"}
              size="sm"
              onClick={() => toggleParam("city", city.name)}
            >
              {city.name}
            </Button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Specialises in">
        <div className="space-y-2">
          {SPECIALISATIONS.map((option) => (
            <CheckboxRow
              key={option.value}
              id={`spec-${option.value}`}
              label={option.label}
              checked={params.get("specialisation") === option.value}
              onChange={() => toggleParam("specialisation", option.value)}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Speaks">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((language) => (
            <Button
              key={language}
              variant={params.get("language") === language ? "default" : "outline"}
              size="sm"
              onClick={() => toggleParam("language", language)}
            >
              {language}
            </Button>
          ))}
        </div>
      </FilterGroup>

      <Separator />

      <FilterGroup title="Verification">
        <CheckboxRow
          id="agent-rera"
          label="RERA registered only"
          checked={params.get("rera") === "1"}
          onChange={() => toggleParam("rera", "1")}
        />
      </FilterGroup>

      <ClearFiltersButton activeCount={activeCount} onReset={reset} />
    </div>
  );

  return (
    <FilterShell
      activeCount={activeCount}
      onReset={reset}
      busy={isPending}
      className={className}
    >
      {body}
    </FilterShell>
  );
}
