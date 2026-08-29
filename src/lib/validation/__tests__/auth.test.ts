import { describe, expect, it } from "vitest";
import {
  ChangePasswordSchema,
  EmailSchema,
  LoginSchema,
  OtpSchema,
  PasswordSchema,
  RegisterSchema,
  ResetPasswordSchema,
  VerifyCodeSchema,
} from "../auth";

const CODE = "123456";
const STRONG = "correct7horse";

describe("OtpSchema", () => {
  it("accepts six digits, with the whitespace a paste brings", () => {
    expect(OtpSchema.parse("123456")).toBe("123456");
    expect(OtpSchema.parse("  123456 ")).toBe("123456");
  });

  it("rejects anything that is not exactly six digits", () => {
    for (const bad of ["12345", "1234567", "12345a", "", "12 34 56", "abcdef"]) {
      expect(OtpSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("EmailSchema", () => {
  it("normalises case and space, so one address is one account", () => {
    expect(EmailSchema.parse("  Person@Example.COM ")).toBe("person@example.com");
  });

  it("rejects what is not an address", () => {
    expect(EmailSchema.safeParse("person@").success).toBe(false);
    expect(EmailSchema.safeParse("person.example.com").success).toBe(false);
  });
});

describe("PasswordSchema", () => {
  it("requires ten characters with a letter and a digit", () => {
    expect(PasswordSchema.safeParse(STRONG).success).toBe(true);
    expect(PasswordSchema.safeParse("short1").success).toBe(false);
    expect(PasswordSchema.safeParse("allletters").success).toBe(false);
    expect(PasswordSchema.safeParse("1234567890").success).toBe(false);
  });

  it("does not silently truncate, and does not accept an essay", () => {
    expect(PasswordSchema.safeParse("a1" + "x".repeat(198)).success).toBe(true);
    expect(PasswordSchema.safeParse("a1" + "x".repeat(199)).success).toBe(false);
  });

  it("keeps a password exactly as typed", () => {
    // Trimming would quietly change a password containing a leading space,
    // and the account would then reject the password its owner set.
    expect(PasswordSchema.parse(" pass word1 ")).toBe(" pass word1 ");
  });
});

describe("VerifyCodeSchema", () => {
  it("defaults to signing in", () => {
    expect(VerifyCodeSchema.parse({ email: "a@b.com", code: CODE }).purpose).toBe("signin");
  });

  it("accepts only the two flows that mint a code", () => {
    expect(VerifyCodeSchema.safeParse({ email: "a@b.com", code: CODE, purpose: "signup" }).success)
      .toBe(true);
    expect(VerifyCodeSchema.safeParse({ email: "a@b.com", code: CODE, purpose: "recovery" }).success)
      .toBe(false);
  });
});

describe("ResetPasswordSchema", () => {
  const base = { email: "a@b.com", code: CODE, password: STRONG, confirmPassword: STRONG };

  it("accepts a matching pair with a valid code", () => {
    expect(ResetPasswordSchema.safeParse(base).success).toBe(true);
  });

  it("reports a mismatch against the confirmation field", () => {
    const result = ResetPasswordSchema.safeParse({ ...base, confirmPassword: "somethingelse1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword?.[0]).toMatch(/do not match/);
    }
  });

  it("still enforces the password rules", () => {
    expect(
      ResetPasswordSchema.safeParse({ ...base, password: "weak", confirmPassword: "weak" }).success,
    ).toBe(false);
  });
});

describe("ChangePasswordSchema", () => {
  const base = { currentPassword: "oldpassword1", password: STRONG, confirmPassword: STRONG };

  it("accepts a real change", () => {
    expect(ChangePasswordSchema.safeParse(base).success).toBe(true);
  });

  it("refuses a change to the same password", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: STRONG,
      password: STRONG,
      confirmPassword: STRONG,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password?.[0]).toMatch(/different/);
    }
  });

  it("requires the current password to be given at all", () => {
    expect(ChangePasswordSchema.safeParse({ ...base, currentPassword: "" }).success).toBe(false);
  });
});

describe("RegisterSchema", () => {
  const base = {
    fullName: "Sunita Rao",
    email: "sunita@example.com",
    phone: "9876543210",
    password: STRONG,
    role: "customer" as const,
    acceptTerms: true as const,
  };

  it("accepts a complete registration", () => {
    expect(RegisterSchema.safeParse(base).success).toBe(true);
  });

  it("never lets an account ask to be an admin", () => {
    // The database trigger is the real guard, but nothing should get that far.
    expect(RegisterSchema.safeParse({ ...base, role: "admin" }).success).toBe(false);
  });

  it("rejects extra fields rather than passing them to auth metadata", () => {
    expect(RegisterSchema.safeParse({ ...base, isAdmin: true }).success).toBe(false);
  });

  it("requires the terms to be accepted, not merely present", () => {
    expect(RegisterSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });

  it("wants a real Indian mobile number", () => {
    expect(RegisterSchema.safeParse({ ...base, phone: "1234567890" }).success).toBe(false);
    expect(RegisterSchema.safeParse({ ...base, phone: "98765" }).success).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("does not impose the new-password rules on an existing password", () => {
    // Someone whose password predates the current policy must still be able to
    // sign in and change it.
    expect(LoginSchema.safeParse({ email: "a@b.com", password: "old" }).success).toBe(true);
  });
});
