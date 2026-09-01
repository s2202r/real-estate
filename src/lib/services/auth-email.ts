import "server-only";

import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { getNotificationProvider } from "@/lib/providers/notifications";
import { renderAuthEmail, type AuthCodePurpose } from "./auth-email-template";

/**
 * Authentication codes, minted here and delivered by our own email provider.
 *
 * WHY NOT LET SUPABASE SEND THEM
 * ------------------------------
 * Supabase's built-in SMTP is shared and rate-limited to a handful of messages
 * an hour. That is fine while building and useless the moment real people sign
 * up: codes simply stop arriving, with nothing in the product to show why. The
 * emails are also templated in a dashboard, which means the wording that
 * greets a new customer lives outside the repository and outside review.
 *
 * WHAT THIS DOES AND DOES NOT REPLACE
 * -----------------------------------
 * It replaces DELIVERY, not identity. Supabase Auth still owns accounts,
 * passwords, sessions and the JWT that every row-level-security policy in the
 * database reads through `auth.uid()`. Replacing that would mean hand-rolling
 * sessions and rewriting some sixty policies — a much larger and much riskier
 * change than the one being asked for.
 *
 * `admin.generateLink` is the hinge: it mints a real, verifiable one-time code
 * and returns it WITHOUT sending anything. We put that code in our own email
 * and send it through the configured provider (Resend). Verification is
 * unchanged — `auth.verifyOtp` — so sessions and RLS carry on exactly as
 * before.
 *
 * FALLBACK
 * --------
 * If the service-role key or the email provider is missing, `canSendAuthCode()`
 * is false and callers fall back to letting Supabase send. A deployment that
 * has not been configured yet degrades to the old behaviour rather than to
 * silence.
 */

export type { AuthCodePurpose } from "./auth-email-template";

export interface SendAuthCodeResult {
  readonly sent: boolean;
  /** Never shown to the sender; for logs and for deciding a fallback. */
  readonly reason?: string;
}

/** True when we can mint a code AND deliver it ourselves. */
export function canSendAuthCode(): boolean {
  if (!isAdminClientAvailable()) return false;
  return getNotificationProvider("EMAIL")?.isConfigured() ?? false;
}

/**
 * Mint a code for an address and email it.
 *
 * `signin` is deliberately narrow: the caller must already have established
 * that the account exists. Supabase's magiclink generation CREATES a user for
 * an unknown address, and a sign-in box that quietly creates accounts — with
 * no name, no phone, no role and no acceptance of the terms — is exactly what
 * the previous implementation went out of its way to prevent.
 */
export async function sendAuthCode(input: {
  email: string;
  purpose: AuthCodePurpose;
  /** Shown in the greeting when we know it. */
  name?: string | null;
}): Promise<SendAuthCodeResult> {
  if (!canSendAuthCode()) return { sent: false, reason: "not_configured" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink(
    input.purpose === "recovery"
      ? { type: "recovery", email: input.email }
      : { type: "magiclink", email: input.email },
  );

  const code = data?.properties?.email_otp;
  if (error || !code) {
    return { sent: false, reason: error?.message ?? "no_code_generated" };
  }

  const provider = getNotificationProvider("EMAIL");
  if (!provider) return { sent: false, reason: "no_email_provider" };

  const content = renderAuthEmail({ code, purpose: input.purpose, name: input.name ?? null });

  const result = await provider.send({
    // The account may not exist as a profile yet, and this message is
    // addressed by email rather than by user.
    to: { userId: "", email: input.email },
    subject: content.subject,
    body: content.text,
    html: content.html,
    metadata: { kind: "auth_code", purpose: input.purpose },
  });

  return { sent: result.delivered, reason: result.error ?? result.skippedReason };
}
