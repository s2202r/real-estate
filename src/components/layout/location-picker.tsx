"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { setLocationScope } from "@/lib/actions/location";
import { describeScope, type LocationScope } from "@/lib/location/scope";
import type { ProjectSummary } from "@/lib/data/places";
import { searchCities } from "@/data/india";
import { cn } from "@/lib/utils";

/**
 * The site-wide location control.
 *
 * Three levels that narrow left to right — city, then a locality within it,
 * then a project — and the panel stays open through all of them. Choosing a
 * city is the start of the task, not the end of it: closing there would force
 * a reopen to reach the locality, and again to reach the project.
 *
 * So selections build a DRAFT, and one "Apply" commits it. Picking a city
 * fetches that city's localities and projects straight away, so the next level
 * appears without a page round trip.
 */
export function LocationPicker({
  scope,
  cities,
  localities,
  projects,
  label,
}: {
  scope: LocationScope;
  cities: readonly { name: string; state: string }[];
  /** Localities in the committed city, so the panel opens already populated. */
  localities: readonly string[];
  projects: readonly ProjectSummary[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LocationScope>(scope);
  const [isPending, startTransition] = useTransition();

  // Options for whatever city the draft is on, seeded with what the server
  // already sent for the committed one.
  const [options, setOptions] = useState<{ localities: string[]; projects: ProjectSummary[] }>({
    localities: [...localities],
    projects: [...projects],
  });
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [cityQuery, setCityQuery] = useState("");
  const [localityQuery, setLocalityQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");

  // Which city the in-flight lookup is for, so a slow answer for a city the
  // visitor has already moved on from cannot overwrite a newer one.
  const pendingCity = useRef<string | null>(null);

  /** Reopening shows what is actually in force, not last time's draft. */
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(scope);
      setOptions({ localities: [...localities], projects: [...projects] });
      setCityQuery("");
      setLocalityQuery("");
      setProjectQuery("");
      pendingCity.current = null;
    }
    setOpen(next);
  };

  /**
   * Load the levels below a city.
   *
   * Driven by the click rather than by an effect on the draft: it is a
   * response to an action, and keeping it here means the request starts on the
   * tap instead of a render later.
   */
  const loadOptionsFor = async (city: string) => {
    pendingCity.current = city;
    setLoadingOptions(true);

    try {
      const response = await fetch(`/api/v1/places?city=${encodeURIComponent(city)}`);
      if (!response.ok) throw new Error("lookup failed");

      const payload = (await response.json()) as {
        data?: { localities?: string[]; projects?: ProjectSummary[] };
      };
      if (pendingCity.current !== city) return;

      setOptions({
        localities: payload.data?.localities ?? [],
        projects: payload.data?.projects ?? [],
      });
    } catch {
      // A failed lookup leaves the city selectable with no levels below it,
      // which is a smaller loss than an error the visitor cannot act on.
      if (pendingCity.current === city) setOptions({ localities: [], projects: [] });
    } finally {
      if (pendingCity.current === city) setLoadingOptions(false);
    }
  };

  /**
   * Searching reaches the whole country, not just the chips.
   *
   * The chips are the cities the platform promotes — the answer for most
   * visitors, one tap away. But inventory exists wherever an agent puts it, so
   * someone looking in Indore must be able to say so rather than conclude the
   * site does not cover them.
   */
  const cityMatches = useMemo(
    () => (cityQuery.trim() ? searchCities(cityQuery, 12) : []),
    [cityQuery],
  );

  const visibleLocalities = useMemo(() => {
    const term = localityQuery.trim().toLowerCase();
    const list = term
      ? options.localities.filter((locality) => locality.toLowerCase().includes(term))
      : options.localities;
    return list.slice(0, 60);
  }, [options.localities, localityQuery]);

  const visibleProjects = useMemo(() => {
    // A drafted locality narrows the projects on offer: a project in another
    // part of the city is not a plausible next choice.
    const withinLocality = draft.locality
      ? options.projects.filter((project) => project.locality === draft.locality)
      : options.projects;

    const term = projectQuery.trim().toLowerCase();
    const list = term
      ? withinLocality.filter(
          (project) =>
            project.name.toLowerCase().includes(term) ||
            project.locality.toLowerCase().includes(term),
        )
      : withinLocality;
    return list.slice(0, 40);
  }, [options.projects, draft.locality, projectQuery]);

  const commit = (next: LocationScope) => {
    startTransition(async () => {
      await setLocationScope(next);
      setOpen(false);
    });
  };

  const pickCity = (city: string | undefined) => {
    // Changing city invalidates everything under it.
    setDraft(city ? { city } : {});

    if (!city) {
      pendingCity.current = null;
      setOptions({ localities: [], projects: [] });
      return;
    }

    if (city === scope.city) {
      // The server already sent this city's options with the page.
      pendingCity.current = null;
      setOptions({ localities: [...localities], projects: [...projects] });
      setLoadingOptions(false);
      return;
    }

    void loadOptionsFor(city);
  };

  const pickLocality = (locality: string) =>
    setDraft((current) => ({
      city: current.city,
      // Tapping the chosen locality again clears it, so the whole city is back
      // in scope without reaching for a separate control.
      ...(current.locality === locality ? {} : { locality }),
    }));

  const pickProject = (project: ProjectSummary) =>
    setDraft((current) =>
      current.projectId === project.id
        ? { city: current.city, locality: current.locality }
        : {
            city: project.city,
            locality: project.locality,
            projectId: project.id,
            projectName: project.name,
          },
    );

  const isScoped = Boolean(scope.city || scope.projectId);
  const draftLabel = describeScope(draft);
  const unchanged =
    draft.city === scope.city &&
    draft.locality === scope.locality &&
    draft.projectId === scope.projectId;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          // `min-w-0` is what actually lets this shrink. A flex item defaults
          // to min-width:auto, so without it the button refuses to go below the
          // width of its own label and pushes the header off the screen on a
          // narrow phone. With it, the label truncates and the header holds.
          className="min-w-0 max-w-[9rem] gap-1.5 px-2 sm:max-w-[14rem]"
          aria-label={`Location: ${label}. Change`}
        >
          <MapPin className={cn("size-4 shrink-0", isScoped && "text-primary")} aria-hidden />
          <span className="truncate text-sm font-medium">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[92%] max-w-md">
        <SheetHeader>
          <SheetTitle>Where are you looking?</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Selecting: <span className="font-medium text-foreground">{draftLabel}</span>
          </p>
        </SheetHeader>

        <div className={cn("flex-1 space-y-6 pb-2", isPending && "pointer-events-none opacity-60")}>
          <section>
            <h3 className="mb-3 text-sm font-semibold">City</h3>
            <div className="relative mb-3">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={cityQuery}
                onChange={(event) => setCityQuery(event.target.value)}
                placeholder="Search any city in India"
                className="h-9 pl-9"
                aria-label="Search any city in India"
              />
            </div>

            {cityQuery.trim() ? (
              cityMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No city matches “{cityQuery.trim()}”.
                </p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {cityMatches.map((city) => (
                    <button
                      key={city.slug}
                      type="button"
                      onClick={() => {
                        setCityQuery("");
                        pickCity(city.name);
                      }}
                      aria-pressed={draft.city === city.name}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                        draft.city === city.name && "bg-accent font-medium",
                      )}
                    >
                      <span className="min-w-0 truncate">
                        {city.name}
                        <span className="text-muted-foreground">, {city.state}</span>
                      </span>
                      {draft.city === city.name && (
                        <Check className="size-4 text-primary" aria-hidden />
                      )}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={draft.city ? "outline" : "default"}
                  size="sm"
                  onClick={() => pickCity(undefined)}
                >
                  All cities
                </Button>
                {cities.map((city) => (
                  <Button
                    key={city.name}
                    variant={draft.city === city.name ? "default" : "outline"}
                    size="sm"
                    onClick={() => pickCity(city.name)}
                  >
                    {city.name}
                  </Button>
                ))}
                {draft.city && !cities.some((city) => city.name === draft.city) && (
                  <Button variant="default" size="sm" onClick={() => pickCity(draft.city)}>
                    {draft.city}
                  </Button>
                )}
              </div>
            )}
          </section>

          {draft.city && (
            <>
              <Separator />

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Locality in {draft.city}</h3>
                  {loadingOptions && (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                  )}
                </div>

                {loadingOptions ? (
                  <p className="text-sm text-muted-foreground">Loading localities…</p>
                ) : options.localities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No published inventory in {draft.city} yet.
                  </p>
                ) : (
                  <>
                    {options.localities.length > 8 && (
                      <div className="relative mb-2">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                          aria-hidden
                        />
                        <Input
                          value={localityQuery}
                          onChange={(event) => setLocalityQuery(event.target.value)}
                          placeholder="Find a locality"
                          className="h-9 pl-9"
                          aria-label="Find a locality"
                        />
                      </div>
                    )}
                    <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                      {visibleLocalities.map((locality) => (
                        <button
                          key={locality}
                          type="button"
                          onClick={() => pickLocality(locality)}
                          aria-pressed={draft.locality === locality}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                            draft.locality === locality && "bg-accent font-medium",
                          )}
                        >
                          {locality}
                          {draft.locality === locality && (
                            <Check className="size-4 text-primary" aria-hidden />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 text-sm font-semibold">
                  Project{draft.locality ? ` in ${draft.locality}` : ""}
                </h3>

                {loadingOptions ? (
                  <p className="text-sm text-muted-foreground">Loading projects…</p>
                ) : visibleProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {draft.locality
                      ? `No projects listed in ${draft.locality} yet.`
                      : `No projects listed in ${draft.city} yet.`}
                  </p>
                ) : (
                  <>
                    {options.projects.length > 6 && (
                      <div className="relative mb-2">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                          aria-hidden
                        />
                        <Input
                          value={projectQuery}
                          onChange={(event) => setProjectQuery(event.target.value)}
                          placeholder="Find a project"
                          className="h-9 pl-9"
                          aria-label="Find a project"
                        />
                      </div>
                    )}
                    <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                      {visibleProjects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => pickProject(project)}
                          aria-pressed={draft.projectId === project.id}
                          className={cn(
                            "flex w-full items-start justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-accent",
                            draft.projectId === project.id && "bg-accent",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {project.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {project.locality}
                              {project.developerName ? ` · ${project.developerName}` : ""}
                            </span>
                          </span>
                          {draft.projectId === project.id && (
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>

        <SheetFooter className="gap-2 border-t pt-4">
          <Button className="h-11 w-full" onClick={() => commit(draft)} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Applying…
              </>
            ) : unchanged ? (
              "Done"
            ) : (
              `Show ${draftLabel}`
            )}
          </Button>

          {(isScoped || draft.city) && !isPending && (
            <Button
              variant="ghost"
              className="h-10 w-full"
              onClick={() => (isScoped ? commit({}) : setDraft({}))}
            >
              <X aria-hidden />
              Show all of India
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
