import {
  BarChart3,
  Building2,
  CalendarClock,
  IndianRupee,
  LayoutDashboard,
  Network,
  Users,
  UserRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getAgentDashboard, getUnreadNotificationCount } from "@/lib/data/dashboard";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

/**
 * Agent workspace layout.
 *
 * Unlike the customer dashboard, this one is deliberately information-dense
 * (§70): agents work in it all day and want counts, queues and pipelines
 * visible without navigating.
 */
export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/agent/dashboard");

  // An account without an agent profile has no business here, whatever the
  // middleware allowed through.
  if (!user.agentId) redirect("/unauthorized");

  const [stats, unread] = await Promise.all([
    getAgentDashboard(user.agentId),
    getUnreadNotificationCount(),
  ]);

  const nav: NavItem[] = [
    { href: "/agent/dashboard", label: "Overview", icon: LayoutDashboard, section: "Workspace" },
    { href: "/agent/properties", label: "My listings", icon: Building2, section: "Inventory", badge: stats.pendingReview },
    { href: "/agent/inventory", label: "Network inventory", icon: Network, section: "Inventory", badge: stats.shareRequests },
    { href: "/agent/leads", label: "Leads", icon: Users, section: "CRM", badge: stats.openLeads },
    { href: "/agent/customers", label: "Contacts", icon: UserRound, section: "CRM" },
    { href: "/agent/visits", label: "Visits", icon: CalendarClock, section: "CRM", badge: stats.visitOffers },
    { href: "/agent/commissions", label: "Earnings", icon: IndianRupee, section: "Business" },
    { href: "/agent/analytics", label: "Performance", icon: BarChart3, section: "Business" },
    { href: "/agent/profile", label: "Profile & verification", icon: UserRound, section: "Business" },
  ];

  return (
    <DashboardShell
      user={user}
      nav={nav}
      unreadCount={unread}
      title="Agent workspace"
      description="Your inventory, pipeline, visits and earnings."
    >
      {children}
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
