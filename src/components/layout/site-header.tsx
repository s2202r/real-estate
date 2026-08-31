import Link from "next/link";
import { LayoutDashboard, LogIn, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { LocationPicker } from "@/components/layout/location-picker";
import { supportedCities } from "@/config/app";
import { describeScope } from "@/lib/location/scope";
import { getLocationScope } from "@/lib/location/server";
import { getLocalitiesForCity, searchProjects } from "@/lib/data/places";
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
  const [user, scope] = await Promise.all([getSessionUser(), getLocationScope()]);
  const navLinks =
    user && canViewNetworkGuide(user) ? [...NAV_LINKS, NETWORK_LINK] : [...NAV_LINKS];

  // Only fetched once a city is chosen: there is no useful locality or project
  // list for "everywhere", and this runs on every page.
  const [localities, projects] = scope.city
    ? await Promise.all([getLocalitiesForCity(scope.city), searchProjects(scope.city)])
    : [[], []];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {/* `gap-2` on small screens, not `gap-4`: at 360px — the width of most
          budget Android phones — the extra spacing was enough to push the
          right-hand cluster past the viewport, and a header that overflows
          makes the WHOLE PAGE scroll sideways. */}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-1.5 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label={`${appConfig.name} home`}>
          {/* One mark, not a responsive pair: the wordmark hides below `sm` so
              the header never wraps, and the mark alone still identifies us. */}
          <Logo size={32} wordmarkClassName="hidden text-lg sm:inline" />
        </Link>

        <LocationPicker
          scope={scope}
          cities={supportedCities.map((city) => ({ name: city.name, state: city.state }))}
          localities={localities}
          projects={projects}
          label={describeScope(scope)}
        />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        {/* Never compressed: these are the actions. Everything to the left of
            them gives way first. */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
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

          <MobileNav
            links={navLinks}
            signedIn={user !== null}
            accountHref={user ? defaultLandingPath(user) : "/login"}
            accountLabel={user ? "Go to dashboard" : "Sign in"}
          />
        </div>
      </div>
    </header>
  );
}
