"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgent } from "@/lib/auth/session";
import { AgentProfileSchema } from "@/lib/validation/profile";
import {
  normaliseSocialUrl,
  PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/domain/social";
import type { ActionResult } from "./leads";
import { serviceUnavailable } from "./guards";

type SocialColumn =
  | "website_url"
  | "instagram_url"
  | "youtube_url"
  | "linkedin_url"
  | "facebook_url";

const COLUMNS: Record<SocialPlatform, SocialColumn> = {
  website: "website_url",
  instagram: "instagram_url",
  youtube: "youtube_url",
  linkedin: "linkedin_url",
  facebook: "facebook_url",
};

/**
 * Save the links an agent publishes on their own profile.
 *
 * Every value is re-validated here, not just in the form: a field labelled
 * "Instagram" that accepts any URL is a way to launder an arbitrary link
 * through a trusted-looking label, and the form's check is a convenience the
 * server must never rely on.
 *
 * These links are NOT a verification signal, and nothing in this action
 * touches `badges` or `verification_level` — those are granted by an admin
 * after review and can never be set from an agent's own form (§13).
 */
export async function updateAgentSocialLinks(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  const user = await requireAgent();

  // Named columns rather than a computed key, so the update stays typed
  // against the table and a typo cannot silently write nothing.
  const patch: Partial<Record<SocialColumn, string | null>> = {};
  const fieldErrors: Record<string, string[]> = {};

  for (const platform of SOCIAL_PLATFORMS) {
    const raw = String(formData.get(platform) ?? "").trim();
    const url = normaliseSocialUrl(platform, raw);

    if (raw && !url) {
      fieldErrors[platform] = [
        platform === "website"
          ? "Enter a valid web address."
          : `That is not a ${PLATFORM_LABELS[platform]} link.`,
      ];
      continue;
    }

    patch[COLUMNS[platform]] = url;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Please check the links below.", fieldErrors };
  }

  const supabase = await createClient();
  // The anon client under RLS: an agent can only update their own row, which
  // is the policy doing the work rather than this code trusting itself.
  const { error } = await supabase.from("agents").update(patch).eq("id", user.agentId);

  if (error) {
    return { ok: false, message: "Could not save those links. Please try again." };
  }

  revalidatePath("/agent/profile");
  revalidatePath("/agents");

  return { ok: true, message: "Links saved. They appear on your public profile." };
}

/**
 * Edit the public half of an agent's profile.
 *
 * Everything here is an agent's DESCRIPTION OF THEMSELVES. Nothing here is the
 * platform's judgement OF them: badges, verification level, trust score,
 * ratings, response and conversion rates, complaint count, risk score and
 * account status are all absent, and a BEFORE UPDATE trigger in the database
 * reverts them if a write ever reaches the table with them set (§10, §13).
 * That trigger is the guarantee; this is the part a reviewer can read.
 *
 * The row is chosen by the caller's own agent id, never by an id in the form.
 */
export async function updateAgentProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireAgent();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const parsed = AgentProfileSchema.safeParse({
    agencyName: formData.get("agencyName") ?? undefined,
    headline: formData.get("headline") ?? undefined,
    bio: formData.get("bio") ?? undefined,
    experienceYears: formData.get("experienceYears") ?? 0,
    languages: formData.getAll("languages").map(String),
    // Sent as one field per city so an empty list is distinguishable from a
    // list containing an empty string.
    serviceCities: formData.getAll("serviceCities").map(String).filter(Boolean),
    acceptsVisitRequests: formData.get("acceptsVisitRequests") === "on",
    maxVisitDistanceKm: formData.get("maxVisitDistanceKm") ?? 15,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the fields below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("agents")
    .update({
      agency_name: input.agencyName ?? null,
      headline: input.headline ?? null,
      bio: input.bio ?? null,
      experience_years: input.experienceYears,
      languages: input.languages,
      // De-duplicated: the same city twice is a filter that matches twice.
      service_cities: [...new Set(input.serviceCities)],
      accepts_visit_requests: input.acceptsVisitRequests,
      max_visit_distance_km: String(input.maxVisitDistanceKm),
    })
    .eq("id", user.agentId);

  if (error) return { ok: false, message: `Could not save your profile: ${error.message}` };

  revalidatePath("/agent/profile");
  revalidatePath("/agents");
  return { ok: true, message: "Profile saved. Customers see the change immediately." };
}
