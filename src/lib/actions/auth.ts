"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/config/app";
import { getRateLimiter, rateLimitKey, clientIpFrom } from "@/lib/security/rate-limit";
import { headers } from "next/headers";
import type { ActionResult } from "./leads";

/**
 * Authentication actions.
 *
 * Two security properties worth stating explicitly:
 *
 *  1. The requested ROLE is passed as auth metadata and honoured by the
 *     `handle_new_user` database trigger, which accepts only customer, agent or
 *     investor. `admin` is not self-assignable through any code path.
 *  2. Sign-in errors are deliberately generic. "No account with that email"
 *     would let anyone enumerate the customer base one address at a time.
 */

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

const RegisterSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(200)
      .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
        message: "Include at least one letter and one number.",
      }),
    role: z.enum(["customer", "agent", "investor"]).default("customer"),
    acceptTerms: z.literal(true, { message: "Please accept the terms to continue." }),
  })
  .strict();

export async function signIn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
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
  redirect(parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/dashboard");
}

export async function signUp(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
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
  const { error } = await supabase.auth.signUp({
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
  return {
    ok: true,
    message: "Account created. Check your inbox if email confirmation is enabled.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
