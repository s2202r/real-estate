/**
 * Capability model.
 *
 * Roles are rows in `user_roles`, never claims the client can set. This module
 * turns those roles into named capabilities so that server code asks
 * "can this user moderate a listing?" rather than "is this user an admin?".
 *
 * These checks are DEFENCE IN DEPTH. The authorisation boundary is RLS; this
 * layer exists to fail fast with a clear error, and to gate the few operations
 * that legitimately run through the service-role client (which RLS cannot
 * protect).
 */

export type AppRole = "customer" | "agent" | "investor" | "admin";

export type AdminRole =
  | "super_admin"
  | "operations_admin"
  | "verification_admin"
  | "finance_admin"
  | "support_admin"
  | "content_admin";

export const CAPABILITIES = [
  "listing.moderate",
  "listing.suspend",
  "property.verify",
  "agent.verify",
  "investor.verify",
  "duplicate.review",
  "document.review",
  "commission.configure",
  "commission.calculate",
  "commission.approve",
  "payment.record",
  "deal.manage",
  "dispute.manage",
  "review.moderate",
  "user.manage",
  "role.grant",
  "settings.manage",
  "feature.toggle",
  "audit.read",
  "analytics.read",
  "notification.manage",
  "visit.override",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * Which admin sub-role holds which capability.
 *
 * `super_admin` is handled separately: it holds everything, so adding a new
 * capability never accidentally locks the platform owner out.
 */
const ADMIN_CAPABILITIES: Record<Exclude<AdminRole, "super_admin">, readonly Capability[]> = {
  operations_admin: [
    "listing.moderate",
    "listing.suspend",
    "property.verify",
    "duplicate.review",
    "deal.manage",
    "visit.override",
    "analytics.read",
    "audit.read",
  ],
  verification_admin: [
    "agent.verify",
    "investor.verify",
    "property.verify",
    "document.review",
    "listing.moderate",
    "audit.read",
  ],
  finance_admin: [
    "commission.configure",
    "commission.calculate",
    "commission.approve",
    "payment.record",
    "deal.manage",
    "analytics.read",
    "audit.read",
  ],
  support_admin: ["dispute.manage", "review.moderate", "analytics.read", "audit.read"],
  content_admin: ["review.moderate", "notification.manage", "settings.manage"],
};

export interface ActorRoles {
  readonly roles: readonly AppRole[];
  readonly adminRole: AdminRole | null;
}

export function hasRole(actor: ActorRoles, role: AppRole): boolean {
  return actor.roles.includes(role);
}

export function isAdmin(actor: ActorRoles): boolean {
  return hasRole(actor, "admin");
}

export function can(actor: ActorRoles, capability: Capability): boolean {
  if (!isAdmin(actor)) return false;
  if (actor.adminRole === "super_admin") return true;
  if (!actor.adminRole) return false;
  return ADMIN_CAPABILITIES[actor.adminRole]?.includes(capability) ?? false;
}

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  readonly status = 401;
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** Throws unless the actor holds the capability. */
export function assertCan(actor: ActorRoles, capability: Capability): void {
  if (!can(actor, capability)) {
    throw new AuthorizationError(`This action requires the "${capability}" capability.`);
  }
}

export function assertRole(actor: ActorRoles, role: AppRole): void {
  if (!hasRole(actor, role)) {
    throw new AuthorizationError(`This action requires the ${role} role.`);
  }
}

/** Every capability an actor holds — used to render admin navigation. */
export function capabilitiesOf(actor: ActorRoles): Capability[] {
  if (!isAdmin(actor)) return [];
  if (actor.adminRole === "super_admin") return [...CAPABILITIES];
  if (!actor.adminRole) return [];
  return [...(ADMIN_CAPABILITIES[actor.adminRole] ?? [])];
}

/**
 * Who may read the network guide ("How it works").
 *
 * The guide documents the mechanics professionals operate inside — passport
 * identity, visit attribution, and how a commission split is computed. It is
 * written for the people those rules bind, so it is shown to agents and
 * investors, and to platform staff (who need to see what those users see).
 * Customers and anonymous visitors get the marketing pages instead.
 */
export function canViewNetworkGuide(actor: ActorRoles): boolean {
  return hasRole(actor, "agent") || hasRole(actor, "investor") || isAdmin(actor);
}

/** The dashboard a user should land on after signing in. */
export function defaultLandingPath(actor: ActorRoles): string {
  if (isAdmin(actor)) return "/admin";
  if (hasRole(actor, "agent")) return "/agent/dashboard";
  if (hasRole(actor, "investor")) return "/investor/dashboard";
  return "/dashboard";
}
