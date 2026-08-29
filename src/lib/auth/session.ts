import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import {
  AuthenticationError,
  assertCan,
  defaultLandingPath,
  type ActorRoles,
  type AdminRole,
  type AppRole,
  type Capability,
} from "./permissions";

export interface SessionUser extends ActorRoles {
  readonly id: string;
  readonly email: string | null;
  readonly fullName: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly city: string | null;
  readonly status: string;
  /** Populated only for the role the account actually holds. */
  readonly agentId: string | null;
  readonly customerId: string | null;
  readonly investorId: string | null;
}

/**
 * The current user, or null.
 *
 * Wrapped in React `cache` so that a page rendering a header, a sidebar and a
 * body all asking "who is this?" costs ONE round trip per request, not three.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  // getUser() verifies the token with the auth server; getSession() would
  // trust a cookie the client controls.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const [profileResult, rolesResult, agentResult, customerResult, investorResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, display_name, avatar_url, city, status, email")
        .eq("id", user.id)
        .maybeSingle(),
      // Scoped by user_id explicitly, NOT left to RLS. The policy on this table
      // reads `user_id = auth.uid() OR is_admin()`, so for an administrator it
      // returns every role row in the platform: their own session would then
      // carry other people's roles, and `adminRole` would be whichever admin
      // row happened to come back first — possibly not theirs. RLS is the
      // boundary; the filter is the query saying what it actually wants.
      supabase
        .from("user_roles")
        .select("role, admin_role")
        .eq("user_id", user.id)
        .is("revoked_at", null),
      supabase.from("agents").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("customers").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("investors").select("id").eq("user_id", user.id).maybeSingle(),
    ]);

  const roleRows = rolesResult.data ?? [];
  const roles = roleRows.map((row) => row.role as AppRole);
  const adminRole =
    (roleRows.find((row) => row.role === "admin")?.admin_role as AdminRole | null) ?? null;

  return {
    id: user.id,
    email: profileResult.data?.email ?? user.email ?? null,
    fullName: profileResult.data?.full_name ?? user.email?.split("@")[0] ?? "User",
    displayName: profileResult.data?.display_name ?? null,
    avatarUrl: profileResult.data?.avatar_url ?? null,
    city: profileResult.data?.city ?? null,
    status: profileResult.data?.status ?? "ACTIVE",
    roles,
    adminRole,
    agentId: agentResult.data?.id ?? null,
    customerId: customerResult.data?.id ?? null,
    investorId: investorResult.data?.id ?? null,
  };
});

/** For Server Components: redirect a signed-out visitor to the login page. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  }
  return user;
}

/** For Server Components: require a role, or send the user somewhere useful. */
export async function requireRole(role: AppRole, returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!user.roles.includes(role)) redirect("/unauthorized");
  return user;
}

export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await requireUser();
  try {
    assertCan(user, capability);
  } catch {
    redirect("/unauthorized");
  }
  return user;
}

/**
 * For Server Components: require a customer profile, or send them somewhere
 * that makes sense.
 *
 * The distinction from `requireCustomer` below matters. That one THROWS, which
 * is right in a Server Action — the caller turns it into a 401. Thrown from a
 * page render there is nobody to catch it, so it becomes a 500 and an error
 * screen. An agent who signs in and lands in the customer workspace is not an
 * error; they are simply in the wrong room.
 */
export async function requireCustomerPage(
  returnTo?: string,
): Promise<SessionUser & { customerId: string }> {
  const user = await requireUser(returnTo);
  if (!user.customerId) {
    const home = defaultLandingPath(user);
    // The customer overview explains the situation rather than 404ing, so it
    // is the right destination when the account has no other workspace.
    redirect(home === "/dashboard" ? "/dashboard" : home);
  }
  return user as SessionUser & { customerId: string };
}

/** The same, for the agent workspace. */
export async function requireAgentPage(
  returnTo?: string,
): Promise<SessionUser & { agentId: string }> {
  const user = await requireUser(returnTo);
  // Matches the group layout: no agent profile means no agent workspace, and
  // /unauthorized explains that without bouncing between two guards.
  if (!user.agentId) redirect("/unauthorized");
  return user as SessionUser & { agentId: string };
}

/** For Server Actions and route handlers: throw rather than redirect. */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function requireAgent(): Promise<SessionUser & { agentId: string }> {
  const user = await requireUserOrThrow();
  if (!user.agentId) {
    throw new AuthenticationError("An agent profile is required for this action.");
  }
  return user as SessionUser & { agentId: string };
}

export async function requireCustomer(): Promise<SessionUser & { customerId: string }> {
  const user = await requireUserOrThrow();
  if (!user.customerId) {
    throw new AuthenticationError("A customer profile is required for this action.");
  }
  return user as SessionUser & { customerId: string };
}
