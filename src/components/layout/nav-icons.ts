"use client";

/**
 * Navigation icons, re-exported across the client boundary.
 *
 * The dashboard layouts are Server Components that build a nav array and hand
 * it to `DashboardNav`, a Client Component. React can only serialise data and
 * *client references* across that boundary — and lucide-react ships without a
 * `"use client"` directive, so importing an icon there yields a plain function,
 * which is neither. The result was a hard render failure on every dashboard
 * route for every signed-in user:
 *
 *     Error: Functions cannot be passed directly to Client Components unless
 *     you explicitly expose it by marking it with "use server".
 *
 * The `"use client"` directive above makes this module a client boundary, so
 * every icon re-exported from it is a client reference and crosses safely.
 *
 * Import nav icons from HERE, never from lucide-react directly, in any Server
 * Component that passes them onward as props. Icons a server component only
 * renders itself can still come straight from lucide-react.
 */
export {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  Handshake,
  Heart,
  IndianRupee,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Network,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
