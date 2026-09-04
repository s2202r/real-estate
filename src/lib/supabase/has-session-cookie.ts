/**
 * Could this request carry a Supabase session?
 *
 * `auth.getUser()` is a NETWORK ROUND TRIP to the auth server, and both the
 * middleware and `getSessionUser()` used to make it on every request — including
 * for the anonymous visitors who are most of the traffic on a property site,
 * who have no session cookie at all and for whom the answer was always null.
 *
 * DELIBERATELY PERMISSIVE. Any cookie whose name begins `sb-` counts, rather
 * than matching the exact `sb-<ref>-auth-token` shape (which is also chunked
 * into `.0`, `.1` for large tokens, and whose format is the auth library's to
 * change). Being too eager costs one wasted lookup; being too strict would
 * show a signed-in person a signed-out page. Those failures are not close to
 * equivalent, so the check errs firmly towards doing the work.
 *
 * A visitor who has never signed in has no `sb-` cookie whatsoever, which is
 * the case worth skipping and the only one this skips.
 */
export function mightHaveSession(cookies: { name: string }[]): boolean {
  return cookies.some((cookie) => cookie.name.startsWith("sb-"));
}
