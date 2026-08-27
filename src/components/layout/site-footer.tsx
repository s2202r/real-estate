import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { appConfig } from "@/config/app";
import { supportedCities } from "@/config/app";

const FOOTER_SECTIONS = [
  {
    title: "Platform",
    links: [
      { href: "/properties", label: "Browse properties" },
      { href: "/agents", label: "Find an agent" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/register?role=agent", label: "Join as an agent" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link href="/" aria-label={`${appConfig.name} home`}>
              <Logo size={32} />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">{appConfig.tagline}.</p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
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
            © {year} {appConfig.name}. All rights reserved.
          </p>
          <p className="max-w-2xl">
            Property information is submitted by verified agents and reviewed by the platform before
            publication. Verification confirms the completeness and consistency of the information
            provided; it is not a legal opinion on title or ownership.
          </p>
        </div>
      </div>
    </footer>
  );
}
