"use client";

import { useMemo, useState, useTransition } from "react";
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
import type { LocationScope } from "@/lib/location/scope";
import type { ProjectSummary } from "@/lib/data/places";
import { cn } from "@/lib/utils";

/**
 * The site-wide location control.
 *
 * Three levels, narrowing left to right: city, then a locality within it, then
 * a specific project. Picking a city loads its localities and projects; there
 * is no point offering a locality list for "everywhere".
 *
 * Choosing writes a cookie through a Server Action and revalidates the tree,
 * so the results below update in the same round trip as the label above them.
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
  /** Localities in the currently scoped city, if one is set. */
  localities: readonly string[];
  /** Projects in the currently scoped city, if one is set. */
  projects: readonly ProjectSummary[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [projectQuery, setProjectQuery] = useState("");
  const [localityQuery, setLocalityQuery] = useState("");

  const apply = (next: LocationScope) => {
    startTransition(async () => {
      await setLocationScope(next);
      setOpen(false);
    });
  };

  const visibleLocalities = useMemo(() => {
    const term = localityQuery.trim().toLowerCase();
    const list = term
      ? localities.filter((locality) => locality.toLowerCase().includes(term))
      : localities;
    return list.slice(0, 40);
  }, [localities, localityQuery]);

  const visibleProjects = useMemo(() => {
    const term = projectQuery.trim().toLowerCase();
    const list = term
      ? projects.filter(
          (project) =>
            project.name.toLowerCase().includes(term) ||
            project.locality.toLowerCase().includes(term),
        )
      : projects;
    return list.slice(0, 30);
  }, [projects, projectQuery]);

  const isScoped = Boolean(scope.city || scope.projectId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-[9rem] gap-1.5 px-2 sm:max-w-[14rem]"
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
        </SheetHeader>

        <div className={cn("flex-1 space-y-6", isPending && "pointer-events-none opacity-60")}>
          <section>
            <h3 className="mb-3 text-sm font-semibold">City</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={scope.city ? "outline" : "default"}
                size="sm"
                onClick={() => apply({})}
              >
                All cities
              </Button>
              {cities.map((city) => (
                <Button
                  key={city.name}
                  variant={scope.city === city.name ? "default" : "outline"}
                  size="sm"
                  onClick={() => apply({ city: city.name })}
                >
                  {city.name}
                </Button>
              ))}
            </div>
          </section>

          {scope.city && (
            <>
              <Separator />

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Locality in {scope.city}</h3>
                  {scope.locality && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => apply({ city: scope.city })}
                    >
                      <X aria-hidden />
                      Clear
                    </Button>
                  )}
                </div>

                {localities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No published inventory in {scope.city} yet.
                  </p>
                ) : (
                  <>
                    {localities.length > 8 && (
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
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                      {visibleLocalities.map((locality) => (
                        <button
                          key={locality}
                          type="button"
                          onClick={() => apply({ city: scope.city, locality })}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                            scope.locality === locality && "bg-accent font-medium",
                          )}
                        >
                          {locality}
                          {scope.locality === locality && (
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
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Project</h3>
                  {scope.projectId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => apply({ city: scope.city, locality: scope.locality })}
                    >
                      <X aria-hidden />
                      Clear
                    </Button>
                  )}
                </div>

                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No projects listed in {scope.city} yet.
                  </p>
                ) : (
                  <>
                    {projects.length > 6 && (
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
                    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                      {visibleProjects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() =>
                            apply({
                              city: project.city,
                              locality: project.locality,
                              projectId: project.id,
                              projectName: project.name,
                            })
                          }
                          className={cn(
                            "flex w-full items-start justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-accent",
                            scope.projectId === project.id && "bg-accent",
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
                          {scope.projectId === project.id && (
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

        <SheetFooter>
          {isPending ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Updating the site…
            </p>
          ) : (
            isScoped && (
              <Button variant="outline" className="h-11" onClick={() => apply({})}>
                <X aria-hidden />
                Show all of India
              </Button>
            )
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
