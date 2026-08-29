"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ChangePasswordSchema,
  EmailSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  VerifyCodeSchema,
} from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { defaultLandingPath } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/config/env";
import { appConfig } from "@/config/app";
import { getRateLimiter, rateLimitKey, clientIpFrom } from "@/lib/security/rate-limit";
import { headers } from "next/headers";
import type { ActionResult } from "./leads";
import { serviceUnavailable } from "./guards";

/**
 * Authentication actions.
 *
 * Three security properties worth stating explicitly:
 *
 *  1. The requested ROLE is passed as auth metadata and honoured by the
 *     `handle_new_user` database trigger, which accepts only customer, agent or
 *     investor. `admin` is not self-assignable through any code path.
 *  2. Sign-in errors are deliberately generic. "No account with that email"
 *     would let anyone enumerate the customer base one address at a time. The
 *     same rule governs every code-sending action below: they answer
 *     identically whether or not the address is registered, and they answer
 *     after the same work, so the response cannot be timed either.
 *  3. Sending a code and spending a code are throttled separately, per address
 *     as well as per IP. A six-digit code is a million guesses; unthrottled
 *     verification would make that a few minutes' work.
 */

export async function signIn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check your details.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Throttle by IP: credential stuffing is the reason this endpoint exists.
  const requestHeaders = await headers();
  const limit = await getRateLimiter().consume(
    rateLimitKey("signin", { ip: clientIpFrom(requestHeaders) }),
    10,
    300,
  );
  if (!limit.allowed) {
    return { ok: false, message: "Too many sign-in attempts. Please wait a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Generic on purpose: never confirm whether an address is registered.
    return { ok: false, message: "Incorrect email or password." };
  }

  revalidatePath("/", "layout");

  // Land on the workspace this account actually has. Sending every role to
  // /dashboard put agents and investors in the customer area, where the pages
  // have no profile to work with.
  if (parsed.data.next?.startsWith("/")) redirect(parsed.data.next);

  const user = await getSessionUser();
  redirect(user ? defaultLandingPath(user) : "/dashboard");
}

export interface SignUpOutcome {
  readonly email: string;
  /** True when Supabase is configured to confirm addresses before sign-in. */
  readonly needsVerification: boolean;
}

export async function signUp(
  _prev: ActionResult<SignUpOutcome> | null,
  formData: FormData,
): Promise<ActionResult<SignUpOutcome>> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const parsed = RegisterSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    role: formData.get("role") || "customer",
    acceptTerms: formData.get("acceptTerms") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const requestHeaders = await headers();
  const limit = await getRateLimiter().consume(
    rateLimitKey("signup", { ip: clientIpFrom(requestHeaders) }),
    5,
    3600,
  );
  if (!limit.allowed) {
    return { ok: false, message: "Too many sign-up attempts from this network. Try again later." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appConfig.url}/auth/callback`,
      // Consumed by handle_new_user(), which restricts the role to the three
      // self-serve values. There is no path from here to an admin account.
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        role: parsed.data.role,
      },
    },
  });

  if (error) {
    return {
      ok: false,
      message:
        error.message.toLowerCase().includes("already")
          ? "An account already exists for this email. Try signing in instead."
          : "Could not create your account. Please try again.",
    };
  }

  revalidatePath("/", "layout");

  // Supabase returns a session only when email confirmation is switched off.
  // Its absence is what tells the form to ask for the code.
  const needsVerification = !data.session;
  return {
    ok: true,
    message: needsVerification
      ? "Account created. Enter the 6-digit code we just emailed you."
      : "Account created.",
    data: { email: parsed.data.email, needsVerification },
  };
}


/* ------------------------------------------------------------------------ *
 * Email codes
 *
 * Supabase sends one email for each of these; which template it uses depends
 * on the `type`. All three templates must include `{{ .Token }}` for a code to
 * arrive at all — see docs/AUTH_EMAIL_SETUP.md. The magic link the default
 * templates carry keeps working through /auth/callback either way, so a
 * project that has not been updated degrades to links rather than to nothing.
 * ------------------------------------------------------------------------ */

/**
 * The one answer every code-sending action gives.
 *
 * Identical whether the address is registered, unregistered, already verified
 * or rate-limited by Supabase itself. Anything else turns this endpoint into a
 * membership oracle: "no account with that email" is all someone needs to test
 * an address list against the customer base.
 */
const CODE_SENT = "If that email address has an account, a 6-digit code is on its way.";

/**
 * Throttle a code send against BOTH the address and the caller's IP.
 *
 * Per-address alone lets one host walk an address list; per-IP alone lets a
 * botnet hammer one mailbox. The address limit is the tighter of the two
 * because the cost falls on somebody else's inbox.
 */
async function throttleCodeSend(scope: string, email: string): Promise<boolean> {
  const requestHeaders = await headers();
  const [byEmail, byIp] = await Promise.all([
    getRateLimiter().consume(`${scope}:email:${email}`, 5, 3600),
    getRateLimiter().consume(rateLimitKey(scope, { ip: clientIpFrom(requestHeaders) }), 15, 3600),
  ]);
  return byEmail.allowed && byIp.allowed;
}

/**
 * Sign in with a code instead of a password.
 *
 * `shouldCreateUser` is false, and that is load-bearing: with it true, typing
 * any address into this box would create an account — with no name, no phone,
 * no role and no acceptance of the terms. Registration is a separate act.
 */
export async function requestLoginCode(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check your details.",
      fieldErrors: { email: [parsed.error.issues[0]?.message ?? "Enter a valid email address."] },
    };
  }

  const email = parsed.data;
  if (!(await throttleCodeSend("otp-login", email))) {
    return { ok: false, message: "Too many codes requested. Please wait, then try again." };
  }

  const supabase = await createClient();
  // The error is deliberately not surfaced: an unregistered address must look
  // exactly like a registered one from out here.
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${appConfig.url}/auth/callback` },
  });

  return { ok: true, message: CODE_SENT, data: { email } };
}

/** Send the sign-up confirmation code again. */
export async function resendSignUpCode(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };

  const email = parsed.data;
  if (!(await throttleCodeSend("otp-signup", email))) {
    return { ok: false, message: "Too many codes requested. Please wait, then try again." };
  }

  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appConfig.url}/auth/callback` },
  });

  return { ok: true, message: CODE_SENT, data: { email } };
}

/**
 * Spend a code: sign in with it, or confirm an address with it.
 *
 * Throttled hard and separately from sending. Six digits is a million
 * possibilities, which is a great deal only if guesses are expensive.
 */
export async function verifyEmailCode(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const parsed = VerifyCodeSchema.safeParse({
      email: formData.get("email"),
      code: formData.get("code"),
      purpose: formData.get("purpose") || "signin",
      next: formData.get("next") || undefined,
    });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the code.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { email, code, purpose, next } = parsed.data;
  const requestHeaders = await headers();
  const [byEmail, byIp] = await Promise.all([
    getRateLimiter().consume(`otp-verify:email:${email}`, 10, 900),
    getRateLimiter().consume(rateLimitKey("otp-verify", { ip: clientIpFrom(requestHeaders) }), 30, 900),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    return { ok: false, message: "Too many attempts. Please request a new code in a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: purpose === "signup" ? "signup" : "email",
  });

  if (error) {
    return { ok: false, message: "That code is not valid or has expired. Request a new one." };
  }

  revalidatePath("/", "layout");

  if (next?.startsWith("/") && !next.startsWith("//")) redirect(next);

  const user = await getSessionUser();
  redirect(user ? defaultLandingPath(user) : "/dashboard");
}

/* ------------------------------------------------------------------------ *
 * Passwords
 * ------------------------------------------------------------------------ */

/** Start a reset: email a recovery code to an address that may not exist. */
export async function requestPasswordReset(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check your details.",
      fieldErrors: { email: [parsed.error.issues[0]?.message ?? "Enter a valid email address."] },
    };
  }

  const email = parsed.data;
  if (!(await throttleCodeSend("password-reset", email))) {
    return { ok: false, message: "Too many codes requested. Please wait, then try again." };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appConfig.url}/auth/callback?next=/account/password`,
  });

  return { ok: true, message: CODE_SENT, data: { email } };
}

/**
 * Finish a reset: spend the recovery code and set the new password together.
 *
 * Deliberately one step. Verifying the code first would leave a fully
 * authenticated session belonging to someone who has proved only that they can
 * read an inbox — and if they then closed the tab, that session would remain,
 * signed in and never asked for a password. Here the code buys exactly one
 * thing: this password change.
 */
export async function resetPasswordWithCode(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const parsed = ResetPasswordSchema.safeParse({
      email: formData.get("email"),
      code: formData.get("code"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { email, code, password } = parsed.data;
  const requestHeaders = await headers();
  const [byEmail, byIp] = await Promise.all([
    getRateLimiter().consume(`password-reset-verify:email:${email}`, 10, 900),
    getRateLimiter().consume(
      rateLimitKey("password-reset-verify", { ip: clientIpFrom(requestHeaders) }),
      30,
      900,
    ),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    return { ok: false, message: "Too many attempts. Please request a new code in a few minutes." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "recovery",
  });

  if (verifyError) {
    return { ok: false, message: "That code is not valid or has expired. Request a new one." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    // The code is spent either way; say so rather than leaving them guessing.
    return {
      ok: false,
      message: `Could not set the new password: ${updateError.message}. Request a fresh code and try again.`,
    };
  }

  revalidatePath("/", "layout");

  const user = await getSessionUser();
  redirect(user ? defaultLandingPath(user) : "/dashboard");
}

/**
 * Change the password of a signed-in account.
 *
 * The current password is required and is checked by actually signing in with
 * it. Supabase has no "verify this password" call, and skipping the check
 * would mean a borrowed laptop with an open session is a permanent account
 * takeover — the attacker sets a new password and the owner is locked out.
 */
export async function changePassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const parsed = ChangePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { data: session } = await supabase.auth.getUser();
  const email = session.user?.email;
  if (!session.user || !email) {
    return { ok: false, message: "You are not signed in. Sign in and try again." };
  }

  const requestHeaders = await headers();
  const limit = await getRateLimiter().consume(
    rateLimitKey("password-change", {
      userId: session.user.id,
      ip: clientIpFrom(requestHeaders),
    }),
    5,
    900,
  );
  if (!limit.allowed) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  }

  const { error: currentError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (currentError) {
    return {
      ok: false,
      message: "That is not your current password.",
      fieldErrors: { currentPassword: ["Incorrect password."] },
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, message: `Could not change the password: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Password changed. Use the new one next time you sign in." };
}

export async function signOut(): Promise<void> {
  // Nothing to sign out of when there is no database; still send the visitor
  // home rather than throwing a 500 at them.
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
