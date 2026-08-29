"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCATION_COOKIE, parseScope, type LocationScope } from "@/lib/location/scope";

/**
 * Set (or clear) the site-wide location.
 *
 * A Server Action rather than `document.cookie` so the value is written once,
 * validated on the way in, and the pages that read it are revalidated in the
 * same round trip — otherwise the header would update while the results below
 * it still showed the previous city.
 */
export async function setLocationScope(scope: LocationScope): Promise<void> {
  const clean = parseScope(scope);
  const store = await cookies();

  if (Object.keys(clean).length === 0) {
    store.delete(LOCATION_COOKIE);
  } else {
    store.set(LOCATION_COOKIE, JSON.stringify(clean), {
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
      sameSite: "lax",
      // Not httpOnly: this is a display preference, not a credential, and
      // keeping it readable lets a future client-side view use it without a
      // round trip. It carries no personal data — a city, a locality, an id.
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  // Every public surface reads this, so the whole tree is stale after a change.
  revalidatePath("/", "layout");
}
