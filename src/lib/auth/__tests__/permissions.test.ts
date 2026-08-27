import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  CAPABILITIES,
  assertCan,
  assertRole,
  can,
  capabilitiesOf,
  defaultLandingPath,
  hasRole,
  isAdmin,
  type ActorRoles,
} from "../permissions";

const customer: ActorRoles = { roles: ["customer"], adminRole: null };
const agent: ActorRoles = { roles: ["agent"], adminRole: null };
const dualRole: ActorRoles = { roles: ["agent", "investor"], adminRole: null };
const superAdmin: ActorRoles = { roles: ["admin"], adminRole: "super_admin" };
const financeAdmin: ActorRoles = { roles: ["admin"], adminRole: "finance_admin" };
const supportAdmin: ActorRoles = { roles: ["admin"], adminRole: "support_admin" };
const roleless: ActorRoles = { roles: [], adminRole: null };

describe("role checks", () => {
  it("recognises a single role", () => {
    expect(hasRole(agent, "agent")).toBe(true);
    expect(hasRole(agent, "customer")).toBe(false);
  });

  it("supports one account holding several roles", () => {
    // The brief is explicit: one agent account can also be an investor, and
    // agent sub-roles are never separate accounts.
    expect(hasRole(dualRole, "agent")).toBe(true);
    expect(hasRole(dualRole, "investor")).toBe(true);
  });

  it("does not treat any non-admin as an admin", () => {
    for (const actor of [customer, agent, dualRole, roleless]) {
      expect(isAdmin(actor)).toBe(false);
    }
  });
});

describe("capabilities", () => {
  it("grants a super admin every capability, including future ones", () => {
    for (const capability of CAPABILITIES) {
      expect(can(superAdmin, capability)).toBe(true);
    }
    expect(capabilitiesOf(superAdmin)).toHaveLength(CAPABILITIES.length);
  });

  it("scopes a finance admin to money, not moderation", () => {
    expect(can(financeAdmin, "commission.approve")).toBe(true);
    expect(can(financeAdmin, "payment.record")).toBe(true);
    expect(can(financeAdmin, "listing.moderate")).toBe(false);
    expect(can(financeAdmin, "role.grant")).toBe(false);
  });

  it("scopes a support admin to disputes, not money", () => {
    expect(can(supportAdmin, "dispute.manage")).toBe(true);
    expect(can(supportAdmin, "commission.approve")).toBe(false);
  });

  it("grants no capability to a non-admin, however many roles they hold", () => {
    for (const capability of CAPABILITIES) {
      expect(can(agent, capability)).toBe(false);
      expect(can(dualRole, capability)).toBe(false);
      expect(can(customer, capability)).toBe(false);
    }
  });

  it("grants nothing to an admin with no sub-role assigned", () => {
    const unscoped: ActorRoles = { roles: ["admin"], adminRole: null };
    expect(can(unscoped, "listing.moderate")).toBe(false);
    expect(capabilitiesOf(unscoped)).toEqual([]);
  });

  it("throws a typed error rather than returning false where it matters", () => {
    expect(() => assertCan(agent, "commission.approve")).toThrow(AuthorizationError);
    expect(() => assertCan(financeAdmin, "commission.approve")).not.toThrow();
    expect(() => assertRole(customer, "agent")).toThrow(AuthorizationError);
  });

  it("reports 403 on authorisation errors", () => {
    try {
      assertCan(agent, "role.grant");
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as AuthorizationError).status).toBe(403);
    }
  });
});

describe("landing paths", () => {
  it("sends each audience to their own workspace", () => {
    expect(defaultLandingPath(superAdmin)).toBe("/admin");
    expect(defaultLandingPath(agent)).toBe("/agent/dashboard");
    expect(defaultLandingPath({ roles: ["investor"], adminRole: null })).toBe("/investor/dashboard");
    expect(defaultLandingPath(customer)).toBe("/dashboard");
  });

  it("prefers admin, then agent, for a multi-role account", () => {
    expect(defaultLandingPath({ roles: ["customer", "agent"], adminRole: null })).toBe(
      "/agent/dashboard",
    );
    expect(defaultLandingPath({ roles: ["agent", "admin"], adminRole: "operations_admin" })).toBe(
      "/admin",
    );
  });
});
