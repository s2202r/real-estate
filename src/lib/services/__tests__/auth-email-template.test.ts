import { describe, expect, it } from "vitest";
import { renderAuthEmail } from "../auth-email-template";

const CODE = "482915";

describe("renderAuthEmail", () => {
  it("puts the code in the subject, the text and the HTML", () => {
    const mail = renderAuthEmail({ code: CODE, purpose: "signin", name: "Sunita" });
    expect(mail.subject).toContain(CODE);
    expect(mail.text).toContain(CODE);
    expect(mail.html).toContain(CODE);
  });

  it("leads the subject with the code", () => {
    // A phone notification shows the first few characters and no more. The
    // code has to be in them, or the email has to be opened to be useful.
    expect(renderAuthEmail({ code: CODE, purpose: "signin", name: null }).subject.startsWith(CODE))
      .toBe(true);
  });

  it("says what the code is for", () => {
    const signin = renderAuthEmail({ code: CODE, purpose: "signin", name: null });
    const recovery = renderAuthEmail({ code: CODE, purpose: "recovery", name: null });
    expect(signin.text).toMatch(/sign in/i);
    expect(recovery.text).toMatch(/new password/i);
    expect(recovery.subject).toMatch(/password reset/i);
  });

  it("greets by name when there is one, and neutrally when there is not", () => {
    expect(renderAuthEmail({ code: CODE, purpose: "signin", name: "Sunita" }).text).toContain(
      "Hi Sunita,",
    );
    expect(renderAuthEmail({ code: CODE, purpose: "signin", name: null }).text).toContain("Hi,");
  });

  it("always carries the warning, which is the only alert an account gets", () => {
    for (const purpose of ["signin", "recovery"] as const) {
      const mail = renderAuthEmail({ code: CODE, purpose, name: null });
      expect(mail.text).toMatch(/did not ask for this/i);
      expect(mail.html).toMatch(/did not ask for this/i);
    }
  });

  it("states the expiry, so the wording matches what the code actually does", () => {
    const mail = renderAuthEmail({ code: CODE, purpose: "signin", name: null });
    expect(mail.text).toMatch(/expires in an hour/i);
    expect(mail.text).toMatch(/used once/i);
  });

  it("escapes a name that contains markup", () => {
    const mail = renderAuthEmail({
      code: CODE,
      purpose: "signin",
      name: '<img src=x onerror="alert(1)">',
    });
    // The point is that no TAG survives. The characters of "onerror=" remain,
    // inert, inside a text node — escaping the angle brackets and quotes is
    // what makes them inert, and stripping the word would prove nothing.
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
    expect(mail.html).toContain("&quot;alert(1)&quot;");
  });

  it("sends a text part as well as HTML", () => {
    const mail = renderAuthEmail({ code: CODE, purpose: "signin", name: null });
    expect(mail.text).not.toContain("<");
    expect(mail.html).toContain("<!doctype html>");
  });
});
