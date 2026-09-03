import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Logo } from "@/components/brand/logo";
import { appConfig } from "@/config/app";
import { signOut } from "@/lib/actions/auth";
import { initialsOf } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";
import { DashboardNav, type NavItem } from "./dashboard-nav";
import { LinkPending } from "./link-pending";

export type { NavItem };

/**
 * Dashboard shell.
 *
 * One shell for all four audiences, because they are the same product viewed
 * through different permissions — maintaining four near-identical layouts would
 * guarantee they drift apart.
 *
 * Density differs by audience (§70): customer views stay airy, agent CRM is
 * information-dense, admin is optimised for throughput.
 */
export function DashboardShell({
  user,
  nav,
  title,
  description,
  actions,
  unreadCount = 0,
  children,
}: {
  user: SessionUser;
  nav: readonly NavItem[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label={`${appConfig.name} home`}>
            <Logo size={28} showWordmark={false} className="sm:hidden" />
            <Logo size={28} wordmarkClassName="text-sm" className="hidden sm:inline-flex" />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="relative">
              <Link href="/dashboard/messages" aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}>
                <Bell />
                {unreadCount > 0 && (
                  <span className="tabular absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.625rem] font-semibold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <Avatar className="size-7">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                    <AvatarFallback className="text-[0.625rem]">
                      {initialsOf(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm sm:inline">
                    {user.displayName ?? user.fullName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">{user.fullName}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="muted" size="sm">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/" className="flex w-full items-center justify-between gap-2">
                    Back to site
                    <LinkPending />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/account/password"
                    className="flex w-full items-center justify-between gap-2"
                  >
                    Change password
                    <LinkPending />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={signOut} className="w-full">
                    <button type="submit" className="flex w-full items-center gap-2 text-left">
                      <LogOut className="size-4" aria-hidden />
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-background lg:block">
          <div className="sticky top-14 p-3">
            <DashboardNav items={nav} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b bg-background px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {/* Mobile navigation lives in a sheet so it never crowds the page. */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="lg:hidden">
                        Menu
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xs">
                      <DialogHeader>
                        <DialogTitle>Navigation</DialogTitle>
                      </DialogHeader>
                      <DashboardNav items={nav} />
                    </DialogContent>
                  </Dialog>
                  <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
                </div>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
          </div>

          <main id="main" className="p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export type { LucideIcon };
