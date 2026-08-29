import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/config/env";
import { getSessionUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/permissions";

/**
 * Dashboard aggregates.
 *
 * Every count here is fetched with `head: true`, so Postgres returns a count
 * without materialising rows — a dashboard header should not pull a thousand
 * records to display the number nine.
 *
 * All of it runs under the caller's RLS, so "my leads" genuinely means the
 * caller's leads; there is no `where agent_id = ?` that a bug could omit.
 */

export interface CustomerDashboardData {
  readonly savedCount: number;
  readonly requirementCount: number;
  readonly enquiryCount: number;
  readonly upcomingVisitCount: number;
  readonly unreadNotifications: number;
}

export async function getCustomerDashboard(customerId: string): Promise<CustomerDashboardData> {
  const sessionUserId = (await getSessionUser())?.id ?? "";
  if (!isSupabaseConfigured()) {
    return {
      savedCount: 0,
      requirementCount: 0,
      enquiryCount: 0,
      upcomingVisitCount: 0,
      unreadNotifications: 0,
    };
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [saved, requirements, enquiries, visits, notifications] = await Promise.all([
    supabase.from("favorites").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    supabase
      .from("customer_requirements")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("status", "ACTIVE"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .gte("requested_date", today)
      .not("status", "in", "(CANCELLED,EXPIRED,REJECTED)"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sessionUserId)
      .is("read_at", null),
  ]);

  return {
    savedCount: saved.count ?? 0,
    requirementCount: requirements.count ?? 0,
    enquiryCount: enquiries.count ?? 0,
    upcomingVisitCount: visits.count ?? 0,
    unreadNotifications: notifications.count ?? 0,
  };
}

export interface AgentDashboardData {
  readonly activeListings: number;
  readonly draftListings: number;
  readonly pendingReview: number;
  readonly openLeads: number;
  readonly upcomingVisits: number;
  readonly visitOffers: number;
  readonly closedDeals: number;
  readonly pendingEarningsMinor: number;
  readonly paidEarningsMinor: number;
  readonly unreadNotifications: number;
  readonly shareRequests: number;
}

export async function getAgentDashboard(agentId: string): Promise<AgentDashboardData> {
  const sessionUserId = (await getSessionUser())?.id ?? "";
  const empty: AgentDashboardData = {
    activeListings: 0,
    draftListings: 0,
    pendingReview: 0,
    openLeads: 0,
    upcomingVisits: 0,
    visitOffers: 0,
    closedDeals: 0,
    pendingEarningsMinor: 0,
    paidEarningsMinor: 0,
    unreadNotifications: 0,
    shareRequests: 0,
  };
  if (!isSupabaseConfigured()) return empty;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    active,
    drafts,
    review,
    leads,
    visits,
    offers,
    ledger,
    notifications,
    shares,
  ] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("agent_id", agentId).eq("status", "VERIFIED"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("agent_id", agentId).eq("status", "DRAFT"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("agent_id", agentId).in("status", ["SUBMITTED", "UNDER_REVIEW"]),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("sales_agent_id", agentId)
      .not("stage", "in", "(CLOSED_WON,CLOSED_LOST)"),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("assigned_agent_id", agentId)
      .gte("requested_date", today)
      .in("status", ["ASSIGNED", "CONFIRMED", "IN_PROGRESS"]),
    supabase
      .from("visit_assignments")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("status", "OFFERED"),
    supabase
      .from("commission_ledger")
      .select("amount_minor, status")
      .eq("agent_id", agentId)
      .in("status", ["CALCULATED", "APPROVED", "PAYMENT_PROCESSING", "PAID"]),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sessionUserId)
      .is("read_at", null),
    supabase
      .from("listing_shares")
      .select("id", { count: "exact", head: true })
      .eq("owner_agent_id", agentId)
      .eq("status", "REQUESTED"),
  ]);

  const entries = ledger.data ?? [];
  const pendingEarningsMinor = entries
    .filter((entry) => entry.status !== "PAID")
    .reduce((acc, entry) => acc + entry.amount_minor, 0);
  const paidEarningsMinor = entries
    .filter((entry) => entry.status === "PAID")
    .reduce((acc, entry) => acc + entry.amount_minor, 0);

  const { count: closedDeals } = await supabase
    .from("deal_participants")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);

  return {
    activeListings: active.count ?? 0,
    draftListings: drafts.count ?? 0,
    pendingReview: review.count ?? 0,
    openLeads: leads.count ?? 0,
    upcomingVisits: visits.count ?? 0,
    visitOffers: offers.count ?? 0,
    closedDeals: closedDeals ?? 0,
    pendingEarningsMinor,
    paidEarningsMinor,
    unreadNotifications: notifications.count ?? 0,
    shareRequests: shares.count ?? 0,
  };
}

/** A figure an operator can act on: how much of it is the demo seed. */
export interface Tally {
  /** Everything in the table. */
  readonly total: number;
  /** The part of it planted by the demo seed (`is_demo`). */
  readonly demo: number;
  /** total − demo: the real business. */
  readonly real: number;
}

export interface ReadFailure {
  readonly source: string;
  readonly message: string;
}

export interface AdminDashboardData {
  /* Work queues. */
  readonly pendingListings: number;
  readonly pendingAgentVerifications: number;
  readonly duplicateCandidates: number;
  readonly openDisputes: number;
  readonly pendingReviews: number;
  readonly failedNotifications: number;

  /* Inventory and network, split real vs demo. */
  readonly properties: Tally;
  readonly activeListings: Tally;
  readonly customers: Tally;
  readonly agents: Tally;
  readonly investors: Tally;
  readonly leads: Tally;
  readonly visits: Tally;
  readonly deals: Tally;
  readonly closedDeals: Tally;

  /**
   * Counts that could not be read. A failed query used to return 0, which on
   * a dashboard is indistinguishable from "none" — the one reading an operator
   * must never be given by accident.
   */
  readonly errors: readonly ReadFailure[];
}

const EMPTY_TALLY: Tally = { total: 0, demo: 0, real: 0 };

const EMPTY_ADMIN_DASHBOARD: AdminDashboardData = {
  pendingListings: 0,
  pendingAgentVerifications: 0,
  duplicateCandidates: 0,
  openDisputes: 0,
  pendingReviews: 0,
  failedNotifications: 0,
  properties: EMPTY_TALLY,
  activeListings: EMPTY_TALLY,
  customers: EMPTY_TALLY,
  agents: EMPTY_TALLY,
  investors: EMPTY_TALLY,
  leads: EMPTY_TALLY,
  visits: EMPTY_TALLY,
  deals: EMPTY_TALLY,
  closedDeals: EMPTY_TALLY,
  errors: [],
};

interface CountReply {
  count: number | null;
  error: { message: string } | null;
}

/**
 * Platform-wide counts for the admin overview.
 *
 * READ THROUGH THE SERVICE-ROLE CLIENT, deliberately. Every count here is
 * meant to be the whole platform, and under RLS each one is filtered by a
 * per-row `is_admin()` check — so a role that has not been granted, or a
 * policy that misses a case, quietly turns "1,284 customers" into "0" with no
 * error anywhere. An overview that can silently under-report is worse than no
 * overview. The caller's admin status is asserted here first; the RLS client
 * remains the fallback when the service key is absent.
 *
 * Failures are collected rather than swallowed, and the demo seed is counted
 * separately, because "12 listings" means something quite different when eight
 * of them were planted by `seed.sql`.
 *
 * Wrapped in `cache()` because the admin layout and the overview page both
 * want these figures: without it one page load runs the whole set of counts
 * twice.
 */
export const getAdminDashboard = cache(async (): Promise<AdminDashboardData> => {
  if (!isSupabaseConfigured()) return EMPTY_ADMIN_DASHBOARD;

  // This client bypasses RLS, so authorisation is this check and nothing else.
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return EMPTY_ADMIN_DASHBOARD;

  const supabase = isAdminClientAvailable() ? createAdminClient() : await createClient();
  const head = { count: "exact" as const, head: true };

  const [
    pendingListings, verifications, duplicates, disputes, reviews, failedNotifications,
    properties, propertiesDemo,
    activeListings, activeListingsDemo,
    customers, customersDemo,
    agents, agentsDemo,
    investors, investorsDemo,
    leads, leadsDemo,
    visits, visitsDemo,
    deals, dealsDemo,
    closedDeals, closedDealsDemo,
  ] = await Promise.all([
    supabase.from("listings").select("id", head).in("status", ["SUBMITTED", "UNDER_REVIEW"]),
    supabase.from("agent_verifications").select("id", head).in("status", ["SUBMITTED", "UNDER_REVIEW"]),
    supabase.from("property_duplicate_candidates").select("id", head).eq("status", "PENDING"),
    supabase.from("disputes").select("id", head).in("status", ["OPEN", "UNDER_REVIEW", "ESCALATED"]),
    supabase.from("reviews").select("id", head).eq("moderation_status", "PENDING"),
    supabase.from("notifications").select("id", head).eq("status", "FAILED"),

    supabase.from("property_passports").select("id", head),
    supabase.from("property_passports").select("id", head).eq("is_demo", true),
    supabase.from("listings").select("id", head).eq("status", "VERIFIED"),
    supabase.from("listings").select("id", head).eq("status", "VERIFIED").eq("is_demo", true),
    supabase.from("customers").select("id", head),
    supabase.from("customers").select("id", head).eq("is_demo", true),
    supabase.from("agents").select("id", head),
    supabase.from("agents").select("id", head).eq("is_demo", true),
    supabase.from("investors").select("id", head),
    supabase.from("investors").select("id", head).eq("is_demo", true),
    supabase.from("leads").select("id", head),
    supabase.from("leads").select("id", head).eq("is_demo", true),
    supabase.from("visits").select("id", head),
    supabase.from("visits").select("id", head).eq("is_demo", true),
    supabase.from("deals").select("id", head),
    supabase.from("deals").select("id", head).eq("is_demo", true),
    supabase.from("deals").select("id", head).eq("status", "CLOSED_WON"),
    supabase.from("deals").select("id", head).eq("status", "CLOSED_WON").eq("is_demo", true),
  ]);

  const errors: ReadFailure[] = [];

  return {
    pendingListings: only("listings awaiting review", pendingListings, errors),
    pendingAgentVerifications: only("agent verifications", verifications, errors),
    duplicateCandidates: only("duplicate candidates", duplicates, errors),
    openDisputes: only("disputes", disputes, errors),
    pendingReviews: only("reviews", reviews, errors),
    failedNotifications: only("notifications", failedNotifications, errors),

    properties: tally("property passports", properties, propertiesDemo, errors),
    activeListings: tally("live listings", activeListings, activeListingsDemo, errors),
    customers: tally("customers", customers, customersDemo, errors),
    agents: tally("agents", agents, agentsDemo, errors),
    investors: tally("investors", investors, investorsDemo, errors),
    leads: tally("leads", leads, leadsDemo, errors),
    visits: tally("visits", visits, visitsDemo, errors),
    deals: tally("deals", deals, dealsDemo, errors),
    closedDeals: tally("closed deals", closedDeals, closedDealsDemo, errors),
    errors,
  };
});

/** One count, with a failure recorded rather than rendered as zero. */
function only(source: string, reply: CountReply, errors: ReadFailure[]): number {
  if (reply.error) {
    errors.push({ source, message: reply.error.message });
    return 0;
  }
  return reply.count ?? 0;
}

function tally(
  source: string,
  total: CountReply,
  demo: CountReply,
  errors: ReadFailure[],
): Tally {
  const totalCount = only(source, total, errors);
  const demoCount = demo.error ? 0 : (demo.count ?? 0);
  return { total: totalCount, demo: demoCount, real: Math.max(0, totalCount - demoCount) };
}

export interface MarketplaceTotals {
  /** Value of closed deals, in minor units. */
  readonly gmvMinor: number;
  readonly gmvDemoMinor: number;
  readonly commissionMinor: number;
  readonly commissionDemoMinor: number;
  readonly platformMinor: number;
}

/** Gross merchandise value and platform commission, for the admin overview. */
export async function getMarketplaceTotals(): Promise<MarketplaceTotals> {
  const empty: MarketplaceTotals = {
    gmvMinor: 0,
    gmvDemoMinor: 0,
    commissionMinor: 0,
    commissionDemoMinor: 0,
    platformMinor: 0,
  };
  if (!isSupabaseConfigured()) return empty;

  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return empty;

  const supabase = isAdminClientAvailable() ? createAdminClient() : await createClient();

  const [deals, ledger] = await Promise.all([
    supabase.from("deals").select("final_price, is_demo").eq("status", "CLOSED_WON"),
    // The ledger has no demo flag of its own; the deal it belongs to has one.
    supabase
      .from("commission_ledger")
      .select("amount_minor, role, deals!inner ( is_demo )")
      .eq("entry_type", "EARNING"),
  ]);

  const closed = deals.data ?? [];
  const gmvMinor = closed.reduce(
    (acc, deal) => acc + Math.round(Number(deal.final_price ?? 0) * 100),
    0,
  );
  const gmvDemoMinor = closed
    .filter((deal) => deal.is_demo)
    .reduce((acc, deal) => acc + Math.round(Number(deal.final_price ?? 0) * 100), 0);

  const entries = (ledger.data ?? []) as unknown as {
    amount_minor: number;
    role: string;
    deals: { is_demo: boolean } | { is_demo: boolean }[] | null;
  }[];

  const isDemoEntry = (entry: (typeof entries)[number]) =>
    Array.isArray(entry.deals) ? Boolean(entry.deals[0]?.is_demo) : Boolean(entry.deals?.is_demo);

  const commissionMinor = entries.reduce((acc, row) => acc + row.amount_minor, 0);
  const commissionDemoMinor = entries
    .filter(isDemoEntry)
    .reduce((acc, row) => acc + row.amount_minor, 0);
  const platformMinor = entries
    .filter((row) => row.role === "PLATFORM")
    .reduce((acc, row) => acc + row.amount_minor, 0);

  return { gmvMinor, gmvDemoMinor, commissionMinor, commissionDemoMinor, platformMinor };
}

export async function getUnreadNotificationCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  // Scoped to the caller explicitly. The policy on this table allows an
  // administrator to read everyone's notifications, so relying on RLS alone
  // would show an admin the whole platform's unread count in their own badge.
  const user = await getSessionUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  return count ?? 0;
}
