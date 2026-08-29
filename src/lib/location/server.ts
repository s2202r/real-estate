import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { LOCATION_COOKIE, parseScope, type LocationScope } from "./scope";

/**
 * The current scope. Cached per request so a page, its header and its data
 * layer all reading it costs one cookie parse.
 */
export const getLocationScope = cache(async (): Promise<LocationScope> => {
  const store = await cookies();
  const raw = store.get(LOCATION_COOKIE)?.value;
  if (!raw) return {};

  try {
    return parseScope(JSON.parse(raw));
  } catch {
    // A malformed cookie is the same as no cookie, never an error.
    return {};
  }
});
