import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { appConfig } from "@/config/app";
import { supportedCities } from "@/config/app";
import { getSessionUser } from "@/lib/auth/session";
import { canViewNetworkGuide } from "@/lib/auth/permissions";

interface FooterLink {
  readonly href: string;
  readonly label: string;
}

const PLATFORM_LINKS: readonly FooterLink[] = [
  { href: "/properties", label: "Browse properties" },
  { href: "/agents", label: "Find an agent" },
  { href: "/register?role=agent", label: "Join as an agent" },
];

/** Shown only to the network members it is written for. */
const NETWORK_LINK: FooterLink = { href: "/how-it-works", label: "How it works" };

const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: PLATFORM_LINKS,
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/grievance-redressal", label: "Grievance redressal" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/cookies", label: "Cookies" },
      { href: "/legal", label: "All policies" },
    ],
  },
] as const;

export async function SiteFooter() {
  const year = new Date().getFullYear();
  const user = await getSessionUser();
  const showNetworkLink = user !== null && canViewNetworkGuide(user);

  return (
    <footer className="mt-20 border-t bg-muted/30">
      {/* Extra bottom room on small screens so a floating action button — the
          Filters FAB on search pages — never sits on top of the disclaimer. */}
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-12 sm:px-6 lg:px-8 lg:pb-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <div className="md:col-span-1">
            <Link href="/" aria-label={`${appConfig.name} home`}>
              <Logo size={32} />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">{appConfig.tagline}.</p>
            <p className="mt-3 text-xs font-medium tracking-wide text-muted-foreground">
              A product of {appConfig.legalEntity}
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <ul className="mt-3 space-y-2">
                {[
                  ...section.links,
                  ...(section.title === "Platform" && showNetworkLink ? [NETWORK_LINK] : []),
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="text-sm font-semibold">Cities</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {supportedCities.slice(0, 8).map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/locations/${city.slug}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {appConfig.legalEntity}. All rights reserved.
          </p>
          <p className="max-w-2xl">
            Property information is submitted by verified agents and reviewed by the platform before
            publication. Verification confirms the completeness and consistency of the information
            provided; it is not a legal opinion on title or ownership. See the{" "}
            <Link href="/disclaimer" className="underline underline-offset-4">
              full disclaimer
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
