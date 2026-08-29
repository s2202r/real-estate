import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

/**
 * Localities and projects, for the location picker.
 *
 * Both come from live inventory rather than a fixed list: offering a locality
 * with nothing in it would send the visitor to an empty page, which reads as a
 * broken site rather than an empty market.
 */

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly city: string;
  readonly locality: string;
  readonly developerName: string | null;
}

/** Localities in a city that actually have published listings. */
export const getLocalitiesForCity = cache(async (city: string): Promise<string[]> => {
  if (!isSupabaseConfigured() || !city) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("locality")
    .eq("status", "VERIFIED")
    .eq("city", city)
    .limit(1000);

  return [...new Set((data ?? []).map((row) => row.locality))].sort((a, b) =>
    a.localeCompare(b, "en-IN"),
  );
});

/** Projects, optionally narrowed by city and a name search. */
export const searchProjects = cache(
  async (city?: string, query?: string, limit = 20): Promise<ProjectSummary[]> => {
    if (!isSupabaseConfigured()) return [];

    const supabase = await createClient();
    let request = supabase
      .from("projects")
      .select("id, name, slug, city, locality, developer_name")
      .order("name", { ascending: true })
      .limit(limit);

    if (city) request = request.eq("city", city);

    const term = query?.trim().replace(/[%,()]/g, " ");
    if (term) request = request.ilike("name", `%${term}%`);

    const { data } = await request;

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      city: row.city,
      locality: row.locality,
      developerName: row.developer_name,
    }));
  },
);
