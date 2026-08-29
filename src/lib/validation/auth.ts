import { z } from "zod";

/**
 * Authentication input rules.
 *
 * Kept out of the actions so they can be tested directly: an action file is a
 * `"use server"` module that pulls in the Supabase server client, and a test
 * importing it drags half the runtime along. These are the rules; the actions
 * apply them.
 */

/** One place decides how long a code is, so every check agrees. */
export const OtpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your email.");

export const EmailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const PasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200)
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    message: "Include at least one letter and one number.",
  });

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const RegisterSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your name.").max(120),
    email: EmailSchema,
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
    password: PasswordSchema,
    role: z.enum(["customer", "agent", "investor"]).default("customer"),
    acceptTerms: z.literal(true, { message: "Please accept the terms to continue." }),
  })
  .strict();

export const VerifyCodeSchema = z.object({
  email: EmailSchema,
  code: OtpSchema,
  /** Which Supabase template minted the code, and so which flow spends it. */
  purpose: z.enum(["signin", "signup"]).default("signin"),
  next: z.string().optional(),
});

export const ResetPasswordSchema = z
  .object({
    email: EmailSchema,
    code: OtpSchema,
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  })
  // Setting a password to the one it already is looks like it worked and
  // achieves nothing — usually a sign somebody filled the wrong box.
  .refine((value) => value.password !== value.currentPassword, {
    message: "The new password must be different from the current one.",
    path: ["password"],
  });
