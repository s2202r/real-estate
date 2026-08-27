import { describe, expect, it } from "vitest";
import {
  maskEmail,
  maskName,
  maskPhone,
  presentContact,
  redactSensitive,
} from "../masking";

describe("contact masking", () => {
  it("masks a phone number but keeps it recognisable to its owner", () => {
    const masked = maskPhone("9810012001");
    expect(masked).toBe("98••••••01");
    expect(masked).not.toContain("100120");
  });

  it("strips separators and country codes before masking", () => {
    // 12 digits once normalised, so 8 of them are hidden.
    const masked = maskPhone("+91 98100-12001");
    expect(masked).toBe("91••••••••01");
    expect(masked).not.toContain("9810012");
  });

  it("does not leak anything for short or missing input", () => {
    expect(maskPhone(null)).toBe("Not provided");
    expect(maskPhone("12")).toBe("••••");
  });

  it("masks an email while keeping the domain", () => {
    const masked = maskEmail("priya.nair@example.com");
    expect(masked).toMatch(/^p•+r@example\.com$/);
    expect(masked).not.toContain("riya.nai");
  });

  it("masks a very short local part without exposing it", () => {
    expect(maskEmail("ab@example.com")).toBe("a••@example.com");
  });

  it("shortens a name to first name plus initial", () => {
    expect(maskName("Rahul Mehta")).toBe("Rahul M.");
    expect(maskName("Anjali")).toBe("Anjali");
    expect(maskName(null)).toBe("Customer");
  });
});

describe("presentContact", () => {
  const contact = {
    name: "Rahul Mehta",
    phone: "9810012001",
    email: "rahul@example.com",
  };

  it("masks by default", () => {
    const presented = presentContact(contact, false);
    expect(presented.isMasked).toBe(true);
    expect(presented.phone).not.toBe(contact.phone);
    expect(presented.email).not.toBe(contact.email);
  });

  it("reveals only when explicitly unlocked", () => {
    const presented = presentContact(contact, true);
    expect(presented.isMasked).toBe(false);
    expect(presented.phone).toBe(contact.phone);
    expect(presented.email).toBe(contact.email);
  });

  it("handles missing values without throwing", () => {
    const presented = presentContact({ name: null, phone: null, email: null }, true);
    expect(presented.name).toBe("Customer");
    expect(presented.phone).toBe("Not provided");
  });
});

describe("redactSensitive", () => {
  it("redacts known-sensitive keys before they reach an audit log", () => {
    const redacted = redactSensitive({
      id: "abc",
      status: "ACTIVE",
      phone: "9810012001",
      email: "a@b.com",
      pan_number: "ABCDE1234F",
      bank_ifsc: "HDFC0001234",
      otp_code_hash: "hash",
    });

    expect(redacted.id).toBe("abc");
    expect(redacted.status).toBe("ACTIVE");
    expect(redacted.phone).toBe("[redacted]");
    expect(redacted.email).toBe("[redacted]");
    expect(redacted.pan_number).toBe("[redacted]");
    expect(redacted.bank_ifsc).toBe("[redacted]");
    expect(redacted.otp_code_hash).toBe("[redacted]");
  });

  it("recurses into nested objects", () => {
    const redacted = redactSensitive({
      customer: { name: "Rahul", phone: "9810012001" },
    }) as { customer: Record<string, unknown> };

    expect(redacted.customer.name).toBe("Rahul");
    expect(redacted.customer.phone).toBe("[redacted]");
  });

  it("preserves nulls rather than replacing them with a redaction marker", () => {
    const redacted = redactSensitive({ phone: null });
    expect(redacted.phone).toBeNull();
  });

  it("catches sensitive keys by substring, so seller_contact is covered too", () => {
    const redacted = redactSensitive({ seller_contact_masked: "+91 98••••••44" });
    expect(redacted.seller_contact_masked).toBe("[redacted]");
  });
});
