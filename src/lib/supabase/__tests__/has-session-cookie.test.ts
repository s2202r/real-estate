import { describe, expect, it } from "vitest";
import { mightHaveSession } from "../has-session-cookie";

/**
 * The asymmetry this encodes is the whole point: a false positive costs one
 * wasted lookup, a false negative shows a signed-in person a signed-out page.
 */
describe("mightHaveSession", () => {
  it("is false for a visitor who has never signed in", () => {
    expect(mightHaveSession([])).toBe(false);
    expect(mightHaveSession([{ name: "gms_location" }])).toBe(false);
  });

  it("is true for the ordinary session cookie", () => {
    expect(mightHaveSession([{ name: "sb-abcdefg-auth-token" }])).toBe(true);
  });

  it("is true for a token split into chunks, which large sessions are", () => {
    expect(
      mightHaveSession([{ name: "sb-abcdefg-auth-token.0" }, { name: "sb-abcdefg-auth-token.1" }]),
    ).toBe(true);
  });

  it("is true for any sb- cookie, because the exact shape is not ours to assume", () => {
    // The auth library owns this format and has changed it before. Matching
    // loosely fails safe; matching precisely fails closed.
    expect(mightHaveSession([{ name: "sb-provider-token" }])).toBe(true);
    expect(mightHaveSession([{ name: "sb-something-we-have-not-seen" }])).toBe(true);
  });

  it("finds the cookie among others", () => {
    expect(
      mightHaveSession([
        { name: "gms_location" },
        { name: "_vercel_jwt" },
        { name: "sb-abcdefg-auth-token" },
      ]),
    ).toBe(true);
  });

  it("does not match a name that merely contains sb-", () => {
    expect(mightHaveSession([{ name: "not-sb-auth-token" }])).toBe(false);
  });
});
