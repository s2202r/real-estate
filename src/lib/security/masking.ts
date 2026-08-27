/**
 * Contact masking.
 *
 * Customer phone numbers and email addresses are the platform's most abused
 * asset in this market: leak them to the whole agent network and the customer
 * is cold-called for weeks, which destroys the trust the product is selling.
 *
 * So contact details are masked BY DEFAULT everywhere, and revealing them is an
 * explicit, authorised, rate-limited and logged action (see
 * lib/services/contact-access.ts). Pure functions, no I/O.
 */

/** "9810012001" -> "98••••••01" */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "Not provided";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  const head = digits.slice(0, 2);
  const tail = digits.slice(-2);
  return `${head}${"•".repeat(Math.max(4, digits.length - 4))}${tail}`;
}

/** "priya.nair@example.com" -> "p••••r@example.com" */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "Not provided";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "••••";
  if (local.length <= 2) return `${local[0] ?? "•"}••@${domain}`;
  return `${local[0]}${"•".repeat(Math.min(6, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

/** "Rahul Mehta" -> "Rahul M." — enough to hold a conversation, not to dox. */
export function maskName(name: string | null | undefined): string {
  if (!name) return "Customer";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] ?? "Customer";
  return `${parts[0]} ${parts[parts.length - 1]?.[0] ?? ""}.`;
}

export interface ContactDetails {
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

export interface MaskedContact {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly isMasked: boolean;
}

/**
 * Present a contact according to whether the viewer has been granted access.
 *
 * Callers pass `unlocked` only after a server-side authorisation check has
 * passed and the access has been logged.
 */
export function presentContact(contact: ContactDetails, unlocked: boolean): MaskedContact {
  if (unlocked) {
    return {
      name: contact.name ?? "Customer",
      phone: contact.phone ?? "Not provided",
      email: contact.email ?? "Not provided",
      isMasked: false,
    };
  }
  return {
    name: maskName(contact.name),
    phone: maskPhone(contact.phone),
    email: maskEmail(contact.email),
    isMasked: true,
  };
}

/**
 * Redact known-sensitive keys from an object before it enters a log or an audit
 * snapshot. Audit trails must be complete without becoming a second copy of the
 * PII database.
 */
const SENSITIVE_KEYS = [
  "phone", "email", "pan_number", "aadhaar", "bank_ifsc", "bank_account_name",
  "bank_account_last4", "otp_code_hash", "password", "token", "access_token",
  "refresh_token", "api_key", "key_hash", "service_role_key", "owner_contact",
  "seller_contact",
];

export function redactSensitive<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive))) {
      output[key] = value == null ? null : "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}
