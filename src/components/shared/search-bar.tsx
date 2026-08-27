"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Search bar with optional natural-language parsing.
 *
 * When AI search is enabled, the parsed interpretation is shown BEFORE the
 * search runs ("Here's what I understood…"), so the customer can correct a
 * misreading instead of silently getting the wrong results.
 */
export function SearchBar({
  defaultValue = "",
  aiEnabled = true,
  className,
}: {
  defaultValue?: string;
  aiEnabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isParsing, setIsParsing] = useState(false);

  const runSearch = (query: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(searchParams.toString());
    if (query) next.set("q", query);
    else next.delete("q");
    for (const [key, item] of Object.entries(extra)) next.set(key, item);
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    runSearch(value);
  };

  const handleAiSearch = async () => {
    if (!value.trim()) return;
    setIsParsing(true);
    try {
      const response = await fetch("/api/v1/search/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value }),
      });
      if (!response.ok) throw new Error("parse failed");

      const parsed = (await response.json()) as {
        data?: { interpretation?: string; filters?: Record<string, string> };
      };

      setInterpretation(parsed.data?.interpretation ?? null);
      runSearch(value, parsed.data?.filters ?? {});
    } catch {
      // A parsing failure must never block the search; fall back to plain text.
      runSearch(value);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <form onSubmit={handleSubmit} role="search" className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="listing-search" className="sr-only">
          Search properties
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="listing-search"
            name="q"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="City, locality, project — or describe what you want"
            className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {aiEnabled && (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={handleAiSearch}
            disabled={isParsing || !value.trim()}
          >
            {isParsing ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            Understand my query
          </Button>
        )}

        <Button type="submit" className="h-11" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Search
        </Button>
      </form>

      {interpretation && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="info" size="sm">
            <Sparkles aria-hidden />
            Understood
          </Badge>
          Searching for {interpretation}.
        </p>
      )}
    </div>
  );
}
