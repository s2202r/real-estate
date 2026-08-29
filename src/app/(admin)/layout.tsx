import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarClock,
  Handshake,
  IndianRupee,
  LayoutDashboard,
  ListChecks,
  Settings,
  TrendingUp,
  Users,
} from "@/components/layout/nav-icons";
import { requireUser } from "@/lib/auth/session";
import { isAdminClientAvailable } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/permissions";
import { getAdminDashboard, getUnreadNotificationCount } from "@/lib/data/dashboard";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";
import { features } from "@/config/features";

/**
 * Admin console layout.
 *
 * Optimised for operational throughput (§70): queue counts sit in the
 * navigation so an operator can see what needs attention without opening
 * anything.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  if (!isAdmin(user)) redirect("/unauthorized");

  const [stats, unread] = await Promise.all([getAdminDashboard(), getUnreadNotificationCount()]);

  const nav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, section: "Operations" },
    {
      href: "/admin/listings",
      label: "Listing moderation",
      icon: ListChecks,
      section: "Operations",
      badge: stats.pendingListings,
    },
    {
      href: "/admin/verifications",
      label: "Verifications",
      icon: BadgeCheck,
      section: "Operations",
      badge: stats.pendingAgentVerifications,
    },
    {
      href: "/admin/properties",
      label: "Properties & duplicates",
      icon: Building2,
      section: "Operations",
      badge: stats.duplicateCandidates,
    },
    { href: "/admin/visits", label: "Visits", icon: CalendarClock, section: "Operations" },
    { href: "/admin/users", label: "Users", icon: Users, section: "Network" },
    { href: "/admin/agents", label: "Agents", icon: Users, section: "Network" },
    { href: "/admin/deals", label: "Deals", icon: Handshake, section: "Commerce" },
    { href: "/admin/commissions", label: "Commissions", icon: IndianRupee, section: "Commerce" },
    ...(features.ENABLE_INVESTOR_MODULE
      ? [{ href: "/admin/investors", label: "Investors", icon: TrendingUp, section: "Commerce" }]
      : []),
    {
      href: "/admin/disputes",
      label: "Disputes & reviews",
      icon: AlertTriangle,
      section: "Support",
      badge: stats.openDisputes + stats.pendingReviews,
    },
    { href: "/admin/settings", label: "Settings", icon: Settings, section: "Support" },
  ];

  return (
    <DashboardShell
      user={user}
      nav={nav}
      unreadCount={unread}
      title="Admin console"
      description={`Signed in as ${user.adminRole ? humanise(user.adminRole) : "administrator"}.`}
    >
      {/* Every privileged operation in this console runs through the
          service-role client. Without its key they all fail at the moment they
          are clicked, one at a time, with no hint of a shared cause — so say it
          once, up front, where an operator sees it before trying. */}
      {!isAdminClientAvailable() && (
        <div className="mb-6 flex gap-3 rounded-lg border border-warning/40 bg-warning-muted p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Privileged actions are disabled on this deployment.</p>
            <p className="mt-1 text-muted-foreground">
              Moderation, verification, suspension, commission approval and standing recomputation
              all need <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>, which
              is not set. Add it to the hosting environment as a private variable — never with the{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_</code> prefix, which would publish it
              to every browser — and redeploy. Reading is unaffected.
            </p>
          </div>
        </div>
      )}

      {children}
    </DashboardShell>
  );
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export const dynamic = "force-dynamic";
