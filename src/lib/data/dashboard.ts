import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { getSessionUser } from "@/lib/auth/session";

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

export interface AdminDashboardData {
  readonly totalProperties: number;
  readonly activeListings: number;
  readonly pendingListings: number;
  readonly pendingAgentVerifications: number;
  readonly duplicateCandidates: number;
  readonly openDisputes: number;
  readonly pendingReviews: number;
  readonly customers: number;
  readonly agents: number;
  readonly investors: number;
  readonly leads: number;
  readonly visits: number;
  readonly deals: number;
  readonly closedDeals: number;
  readonly failedNotifications: number;
  readonly unreadNotifications: number;
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const empty: AdminDashboardData = {
    totalProperties: 0,
    activeListings: 0,
    pendingListings: 0,
    pendingAgentVerifications: 0,
    duplicateCandidates: 0,
    openDisputes: 0,
    pendingReviews: 0,
    customers: 0,
    agents: 0,
    investors: 0,
    leads: 0,
    visits: 0,
    deals: 0,
    closedDeals: 0,
    failedNotifications: 0,
    unreadNotifications: 0,
  };
  if (!isSupabaseConfigured()) return empty;

  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const [
    properties, activeListings, pendingListings, verifications, duplicates,
    disputes, reviews, customers, agents, investors, leads, visits, deals,
    closedDeals, failedNotifications, unread,
  ] = await Promise.all([
    supabase.from("property_passports").select("id", head),
    supabase.from("listings").select("id", head).eq("status", "VERIFIED"),
    supabase.from("listings").select("id", head).in("status", ["SUBMITTED", "UNDER_REVIEW"]),
    supabase.from("agent_verifications").select("id", head).in("status", ["SUBMITTED", "UNDER_REVIEW"]),
    supabase.from("property_duplicate_candidates").select("id", head).eq("status", "PENDING"),
    supabase.from("disputes").select("id", head).in("status", ["OPEN", "UNDER_REVIEW", "ESCALATED"]),
    supabase.from("reviews").select("id", head).eq("moderation_status", "PENDING"),
    supabase.from("customers").select("id", head),
    supabase.from("agents").select("id", head),
    supabase.from("investors").select("id", head),
    supabase.from("leads").select("id", head),
    supabase.from("visits").select("id", head),
    supabase.from("deals").select("id", head),
    supabase.from("deals").select("id", head).eq("status", "CLOSED_WON"),
    supabase.from("notifications").select("id", head).eq("status", "FAILED"),
    supabase.from("notifications").select("id", head).is("read_at", null),
  ]);

  return {
    totalProperties: properties.count ?? 0,
    activeListings: activeListings.count ?? 0,
    pendingListings: pendingListings.count ?? 0,
    pendingAgentVerifications: verifications.count ?? 0,
    duplicateCandidates: duplicates.count ?? 0,
    openDisputes: disputes.count ?? 0,
    pendingReviews: reviews.count ?? 0,
    customers: customers.count ?? 0,
    agents: agents.count ?? 0,
    investors: investors.count ?? 0,
    leads: leads.count ?? 0,
    visits: visits.count ?? 0,
    deals: deals.count ?? 0,
    closedDeals: closedDeals.count ?? 0,
    failedNotifications: failedNotifications.count ?? 0,
    unreadNotifications: unread.count ?? 0,
  };
}

/** Gross merchandise value and platform commission, for the admin overview. */
export async function getMarketplaceTotals() {
  if (!isSupabaseConfigured()) return { gmvMinor: 0, commissionMinor: 0, platformMinor: 0 };

  const supabase = await createClient();

  const [deals, ledger] = await Promise.all([
    supabase.from("deals").select("final_price").eq("status", "CLOSED_WON"),
    supabase.from("commission_ledger").select("amount_minor, role").eq("entry_type", "EARNING"),
  ]);

  const gmvMinor = (deals.data ?? []).reduce(
    (acc, deal) => acc + Math.round(Number(deal.final_price ?? 0) * 100),
    0,
  );
  const commissionMinor = (ledger.data ?? []).reduce((acc, row) => acc + row.amount_minor, 0);
  const platformMinor = (ledger.data ?? [])
    .filter((row) => row.role === "PLATFORM")
    .reduce((acc, row) => acc + row.amount_minor, 0);

  return { gmvMinor, commissionMinor, platformMinor };
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
