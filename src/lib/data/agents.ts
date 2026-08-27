import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import type { Enums } from "@/types/database";
import {
  LIST_COLUMNS,
  toListingSummary,
  type ListingRow,
  type ListingSummary,
} from "./listings";

/**
 * Agent queries.
 *
 * The public surface reads from the `public_agents` VIEW, never from `agents`.
 * That view is a hand-picked column list: it exposes specialisation, badges and
 * ratings, and deliberately omits trust score, response rate, conversion rate,
 * complaint count and risk score (§13) — internal metrics that would be gamed
 * the moment they were published, and that customers cannot interpret fairly.
 */

export interface PublicAgent {
  readonly id: string;
  readonly slug: string;
  readonly fullName: string;
  readonly displayName: string | null;
  readonly agencyName: string | null;
  readonly headline: string | null;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly city: string | null;
  readonly experienceYears: number;
  readonly languages: readonly string[];
  readonly specializations: readonly Enums["property_type"][];
  readonly serviceCities: readonly string[];
  readonly serviceLocalities: readonly string[];
  readonly verificationLevel: Enums["verification_level"];
  readonly badges: readonly Enums["agent_badge"][];
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly closedDealCount: number;
  readonly joinedAt: string;
}

interface PublicAgentRow {
  id: string;
  slug: string;
  full_name: string;
  display_name: string | null;
  agency_name: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  experience_years: number;
  languages: string[];
  specializations: Enums["property_type"][];
  service_cities: string[];
  service_localities: string[];
  verification_level: Enums["verification_level"];
  badges: Enums["agent_badge"][];
  rating_average: string;
  rating_count: number;
  closed_deal_count: number;
  joined_at: string;
}

function toAgent(row: PublicAgentRow): PublicAgent {
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.full_name,
    displayName: row.display_name,
    agencyName: row.agency_name,
    headline: row.headline,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    city: row.city,
    experienceYears: row.experience_years,
    languages: row.languages ?? [],
    specializations: row.specializations ?? [],
    serviceCities: row.service_cities ?? [],
    serviceLocalities: row.service_localities ?? [],
    verificationLevel: row.verification_level,
    badges: row.badges ?? [],
    ratingAverage: Number(row.rating_average ?? 0),
    ratingCount: row.rating_count ?? 0,
    closedDealCount: row.closed_deal_count ?? 0,
    joinedAt: row.joined_at,
  };
}

export interface AgentSearchFilters {
  readonly city?: string;
  readonly locality?: string;
  readonly language?: string;
  readonly propertyType?: Enums["property_type"];
  readonly verifiedOnly?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
}

export async function searchAgents(filters: AgentSearchFilters = {}) {
  if (!isSupabaseConfigured()) {
    return { agents: [] as PublicAgent[], total: 0, page: 1, pageSize: 12, totalPages: 0 };
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, filters.pageSize ?? 12);
  const from = (page - 1) * pageSize;

  const supabase = await createClient();
  let request = supabase.from("public_agents").select("*", { count: "exact" });

  if (filters.city) request = request.contains("service_cities", [filters.city]);
  if (filters.locality) request = request.contains("service_localities", [filters.locality]);
  if (filters.language) request = request.contains("languages", [filters.language]);
  if (filters.propertyType) request = request.contains("specializations", [filters.propertyType]);
  if (filters.verifiedOnly) request = request.contains("badges", ["RERA_VERIFIED"]);

  const { data, count, error } = await request
    .order("rating_average", { ascending: false })
    .order("closed_deal_count", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) {
    console.error("[agents] search failed", error.message);
    return { agents: [] as PublicAgent[], total: 0, page, pageSize, totalPages: 0 };
  }

  const agents = ((data ?? []) as unknown as PublicAgentRow[]).map(toAgent);
  const total = count ?? agents.length;

  return { agents, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const getAgentBySlug = cache(async (slug: string): Promise<PublicAgent | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("public_agents").select("*").eq("slug", slug).maybeSingle();

  return data ? toAgent(data as unknown as PublicAgentRow) : null;
});

/** An agent's live inventory, for their public profile. */
export async function getAgentListings(agentId: string, limit = 9): Promise<ListingSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(LIST_COLUMNS)
    .eq("agent_id", agentId)
    .eq("status", "VERIFIED")
    .order("published_at", { ascending: false })
    .limit(limit);

  // Through the shared mapper, never a cast: the rows are snake_case and
  // ListingSummary is camelCase, so casting silently produces undefined fields.
  return (data ?? []).map((row) => toListingSummary(row as unknown as ListingRow));
}

/** Approved public reviews of an agent. Pending ones are never shown. */
export async function getAgentReviews(agentId: string, limit = 10) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, title, body, created_at, agent_response, agent_responded_at, is_verified_interaction")
    .eq("agent_id", agentId)
    .eq("moderation_status", "APPROVED")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
