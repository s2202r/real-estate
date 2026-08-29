import { supportedCities } from "@/config/app";

/**
 * The visitor's chosen location, carried across the whole site.
 *
 * Stored in a cookie rather than the URL, because the choice outlives any one
 * page: someone who picks Noida expects the agent directory and the home page
 * to be about Noida too, not just the search they set it on. The URL stays
 * authoritative for a single view — a link to `/properties?city=Mumbai` shows
 * Mumbai regardless of the cookie — so a shared link never silently changes
 * meaning for the person who opens it.
 *
 * The cookie is USER INPUT: it is read back with the same suspicion as a query
 * string. The city must be one the platform actually serves, and every free
 * text field is length-capped before it reaches a query.
 *
 * Everything here is pure, so the client picker and the server pages share one
 * definition of what a scope means. Reading the cookie lives in `./server`,
 * which is server-only.
 */

export const LOCATION_COOKIE = "gms_location";

export interface LocationScope {
  readonly city?: string;
  readonly locality?: string;
  readonly projectId?: string;
  /** Carried so the header can name the project without a round trip. */
  readonly projectName?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate an untrusted scope object into one safe to query with. */
export function parseScope(raw: unknown): LocationScope {
  if (typeof raw !== "object" || raw === null) return {};
  const value = raw as Record<string, unknown>;

  const city =
    typeof value.city === "string" &&
    supportedCities.some((entry) => entry.name === value.city)
      ? value.city
      : undefined;

  // A locality without a city is meaningless, and would filter every result
  // out of a nationwide search.
  const locality =
    city && typeof value.locality === "string" && value.locality.length <= 80
      ? value.locality
      : undefined;

  const projectId =
    typeof value.projectId === "string" && UUID.test(value.projectId)
      ? value.projectId
      : undefined;

  const projectName =
    projectId && typeof value.projectName === "string" && value.projectName.length <= 160
      ? value.projectName
      : undefined;

  return {
    ...(city ? { city } : {}),
    ...(locality ? { locality } : {}),
    ...(projectId ? { projectId } : {}),
    ...(projectName ? { projectName } : {}),
  };
}

/**
 * Fill a set of listing filters from the scope, where the URL said nothing.
 *
 * Precedence is the whole point: an explicit filter is a decision the visitor
 * made on this page, the scope is a standing preference. A link to
 * `/properties?city=Mumbai` therefore shows Mumbai even for someone whose
 * header says Noida — otherwise a shared link would mean different things to
 * different people.
 */
export function applyScope<T extends object>(
  filters: T,
  scope: LocationScope,
): T & ScopableFilters {
  const current = filters as ScopableFilters;

  // A city stated in the URL means the visitor is looking somewhere specific;
  // layering a stored locality or project on top would narrow it wrongly.
  if (current.city) return filters;

  return {
    ...filters,
    ...(scope.city ? { city: scope.city } : {}),
    ...(current.locality ? {} : scope.locality ? { locality: scope.locality } : {}),
    ...(current.projectId ? {} : scope.projectId ? { projectId: scope.projectId } : {}),
  };
}

export interface ScopableFilters {
  readonly city?: string;
  readonly locality?: string;
  readonly projectId?: string;
}

/** How the scope reads in the header. */
export function describeScope(scope: LocationScope): string {
  if (scope.projectName) return scope.projectName;
  if (scope.locality) return `${scope.locality}, ${scope.city}`;
  if (scope.city) return scope.city;
  return "All cities";
}
