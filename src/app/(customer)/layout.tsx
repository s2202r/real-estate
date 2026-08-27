import {
  Bell,
  CalendarClock,
  Heart,
  LayoutDashboard,
  ListChecks,
  Search,
  UserRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/data/dashboard";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

/**
 * Customer dashboard layout.
 *
 * The customer experience is deliberately the simplest of the four (§49): a
 * short navigation list and generous spacing. Anyone can use this without
 * being taught.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const unread = await getUnreadNotificationCount();

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/properties", label: "Recommended", icon: Search },
    { href: "/dashboard/favorites", label: "Saved", icon: Heart },
    { href: "/dashboard/requirements", label: "My requirements", icon: ListChecks },
    { href: "/dashboard/visits", label: "Site visits", icon: CalendarClock },
    { href: "/dashboard/messages", label: "Notifications", icon: Bell, badge: unread },
    { href: "/dashboard/profile", label: "Profile & privacy", icon: UserRound },
  ];

  return (
    <DashboardShell
      user={user}
      nav={nav}
      unreadCount={unread}
      title="My dashboard"
      description="Your searches, visits and enquiries in one place."
    >
      {children}
    </DashboardShell>
  );
}

export const dynamic = "force-dynamic";
