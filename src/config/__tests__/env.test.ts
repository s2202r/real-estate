import { describe, expect, it } from "vitest";
import { normaliseUrl } from "../env";

/**
 * These cover the shape of failure that took the whole site down: a URL
 * variable that zod refused, thrown at module scope, before any route could
 * load. The rule now is that no environment value can produce an exception
 * here — the worst case is an empty string and a warning.
 */
describe("normaliseUrl", () => {
  it("accepts a well-formed URL unchanged", () => {
    expect(normaliseUrl("https://getmespace.in", "TEST")).toBe("https://getmespace.in");
    expect(normaliseUrl("https://abc.supabase.co", "TEST")).toBe("https://abc.supabase.co");
  });

  it("adds the scheme a pasted hostname is missing", () => {
    // The exact mistake that produced a bare 500 on every page.
    expect(normaliseUrl("getmespace.in", "TEST")).toBe("https://getmespace.in");
    expect(normaliseUrl("www.getmespace.in", "TEST")).toBe("https://www.getmespace.in");
  });

  it("trims whitespace picked up when copying from a dashboard", () => {
    expect(normaliseUrl("  https://getmespace.in  ", "TEST")).toBe("https://getmespace.in");
    expect(normaliseUrl("\nhttps://getmespace.in\n", "TEST")).toBe("https://getmespace.in");
  });

  it("drops a trailing slash, which would double up in every canonical URL", () => {
    expect(normaliseUrl("https://getmespace.in/", "TEST")).toBe("https://getmespace.in");
  });

  it("keeps a path when one is genuinely part of the value", () => {
    expect(normaliseUrl("https://example.com/app", "TEST")).toBe("https://example.com/app");
  });

  it("treats an absent value as absent, not as an error", () => {
    expect(normaliseUrl(undefined, "TEST")).toBe("");
    expect(normaliseUrl("", "TEST")).toBe("");
    expect(normaliseUrl("   ", "TEST")).toBe("");
  });

  it("returns empty rather than throwing on something unparseable", () => {
    // The whole point: a bad value disables one integration; it must never be
    // able to stop the module from loading.
    expect(() => normaliseUrl("http://", "TEST")).not.toThrow();
    expect(normaliseUrl("http://", "TEST")).toBe("");
    expect(normaliseUrl(":::", "TEST")).toBe("");
    expect(normaliseUrl("not a url", "TEST")).toBe("");
  });

  it("preserves a non-https scheme that was stated explicitly", () => {
    expect(normaliseUrl("http://localhost:3000", "TEST")).toBe("http://localhost:3000");
  });
});
