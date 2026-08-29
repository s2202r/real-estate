"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgent } from "@/lib/auth/session";
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
