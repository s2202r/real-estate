"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUserOrThrow } from "@/lib/auth/session";
import { CustomerProfileSchema } from "@/lib/validation/profile";
import type { ActionResult } from "./leads";
import { serviceUnavailable } from "./guards";

/**
 * Edit your own details.
 *
 * Scoped to `auth.uid()` rather than to an id from the form. An action that
 * took the row to update from its own input would let anyone edit anyone, and
 * the RLS policy on `profiles` would be the only thing standing in the way —
 * one lock where there should be two.
 */
export async function updateMyProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireUserOrThrow();
  } catch {
    return { ok: false, message: "You are not signed in. Sign in and try again." };
  }

  const parsed = CustomerProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    displayName: formData.get("displayName") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    city: formData.get("city") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the fields below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("profiles")
    .select("phone, phone_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  const phoneChanged = (before?.phone ?? null) !== (parsed.data.phone ?? null);

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      display_name: parsed.data.displayName ?? null,
      phone: parsed.data.phone ?? null,
      city: parsed.data.city ?? null,
      // A verified number is verified because a code reached THAT number.
      // Carrying the verification across to a different one would make the
      // badge a lie, so a change resets it.
      ...(phoneChanged ? { phone_verified_at: null } : {}),
    })
    .eq("id", user.id);

  if (error) return { ok: false, message: `Could not save your details: ${error.message}` };

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: phoneChanged
      ? "Saved. Your mobile number needs verifying again before it counts as confirmed."
      : "Saved.",
  };
}
