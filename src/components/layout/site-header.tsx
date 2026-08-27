import Link from "next/link";
import { LayoutDashboard, LogIn, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";
import { appConfig } from "@/config/app";
import { getSessionUser } from "@/lib/auth/session";
import { canViewNetworkGuide, defaultLandingPath } from "@/lib/auth/permissions";
import { initialsOf } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/properties", label: "Properties" },
  { href: "/agents", label: "Agents" },
  { href: "/about", label: "About" },
] as const;

/** Shown only to the network members it is written for. */
const NETWORK_LINK = { href: "/how-it-works", label: "How it works" } as const;

export async function SiteHeader() {
  const user = await getSessionUser();
  const navLinks =
    user && canViewNetworkGuide(user) ? [...NAV_LINKS, NETWORK_LINK] : [...NAV_LINKS];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label={`${appConfig.name} home`}>
          {/* Wordmark hides on the narrowest screens so the header never wraps. */}
          <Logo size={32} showWordmark={false} className="sm:hidden" />
          <Logo size={32} className="hidden sm:inline-flex" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="md:hidden">
            <Link href="/properties" aria-label="Search properties">
              <Search />
            </Link>
          </Button>

          {user ? (
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href={defaultLandingPath(user)}>
                <Avatar className="size-6">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                  <AvatarFallback>{initialsOf(user.fullName)}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">Dashboard</span>
                <LayoutDashboard className="sm:hidden" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">
                  <LogIn />
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Logo size={26} />
                </DialogTitle>
              </DialogHeader>
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {navLinks.map((link) => (
                  <Button key={link.href} asChild variant="ghost" className="justify-start">
                    <Link href={link.href}>{link.label}</Link>
                  </Button>
                ))}
                <Button asChild variant="ghost" className="justify-start">
                  <Link href={user ? defaultLandingPath(user) : "/login"}>
                    {user ? "Dashboard" : "Sign in"}
                  </Link>
                </Button>
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
