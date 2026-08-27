import { BellOff, BadgePercent, ShieldCheck, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { appConfig } from "@/config/app";

/**
 * The four promises the product is positioned on.
 *
 * Each headline is a customer-facing claim, so each carries a line saying what
 * the platform actually does to honour it — a claim nobody can check is worth
 * less than a claim with a mechanism behind it, and "verified" in particular
 * has a specific, limited meaning here (see the footer disclaimer).
 */
const PROMISES = [
  {
    icon: BellOff,
    title: "No spam",
    body: "Your number is never sold, and never broadcast to a panel of agents. You decide who gets to call you.",
  },
  {
    icon: BadgePercent,
    title: "No brokerage",
    body: `${appConfig.name} charges you nothing to search, enquire or book a site visit. Any agent brokerage is stated on the listing, upfront.`,
  },
  {
    icon: UserCheck,
    title: "Verified agents",
    body: "Identity and RERA registration are checked by the platform. No agent can mark themselves verified.",
  },
  {
    icon: ShieldCheck,
    title: "Verified properties",
    body: "Every listing is reviewed against its property passport before it is published. No expired ads, no bait pricing.",
  },
] as const;

/**
 * The promises as a highlighted band. Used directly below the hero, where it
 * answers the question a first-time visitor actually has.
 */
export function TrustStrip({ className }: { className?: string }) {
  return (
    <section
      aria-label="Our promises"
      className={cn("border-y bg-primary/[0.04] dark:bg-primary/[0.07]", className)}
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((promise) => (
            <li key={promise.title} className="flex gap-4">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
                aria-hidden
              >
                <promise.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold tracking-tight">{promise.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {promise.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * The same promises as a compact row of chips, for pages where they are a
 * reassurance rather than the message — search results, a property page.
 */
export function TrustChips({ className }: { className?: string }) {
  return (
    <ul aria-label="Our promises" className={cn("flex flex-wrap gap-2", className)}>
      {PROMISES.map((promise) => (
        <li
          key={promise.title}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-medium text-primary dark:bg-primary/[0.12]"
        >
          <promise.icon className="size-3.5" aria-hidden />
          {promise.title}
        </li>
      ))}
    </ul>
  );
}
