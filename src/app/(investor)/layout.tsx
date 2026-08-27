import { notFound, redirect } from "next/navigation";
import {
  Briefcase,
  LayoutDashboard,
  LineChart,
  ShieldCheck,
  TrendingUp,
} from "@/components/layout/nav-icons";
import { requireUser } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/data/dashboard";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";
import { features } from "@/config/features";

/**
 * Investor workspace.
 *
 * The whole module is gated on ENABLE_INVESTOR_MODULE, which ships FALSE. When
 * the flag is off these routes return 404 rather than an "unavailable" page:
 * a disabled module should not advertise its own existence, and the legal
 * position (docs/LEGAL_REVIEW.md L1) is that this functionality does not
 * operate until counsel has signed off.
 */
export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  if (!features.ENABLE_INVESTOR_MODULE) notFound();

  const user = await requireUser("/investor/dashboard");
  if (!user.investorId) redirect("/unauthorized");

  const unread = await getUnreadNotificationCount();

  const nav: NavItem[] = [
    { href: "/investor/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/investor/opportunities", label: "Opportunities", icon: TrendingUp },
    { href: "/investor/exclusive", label: "Exclusive inventory", icon: ShieldCheck },
    { href: "/investor/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/investor/returns", label: "Returns", icon: LineChart },
  ];

  return (
    <DashboardShell
      user={user}
      nav={nav}
      unreadCount={unread}
      title="Investor workspace"
      description="Exclusive inventory arrangements and positions."
    >
      {children}
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
