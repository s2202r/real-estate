import { BadgeCheck, CalendarCheck, Fingerprint, MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The hero's visual.
 *
 * Rather than a stock photograph of a building, it shows what a customer gets:
 * a property passport that accumulates history, and a site visit with a
 * verified agent and a recorded check-in.
 *
 * Deliberately NOT the commission split. Who is paid what out of a
 * transaction is information for the agents and investors it binds, not
 * something to put in front of a customer looking for a home — the network
 * guide that explains it is gated to those roles for the same reason.
 *
 * The panel is decoration in the layout sense, so it is hidden from assistive
 * technology: everything it says is stated in the copy beside it. Figures are
 * labelled as examples — they must never be mistakable for a real property.
 */

const VISIT_STEPS = [
  { label: "Slot confirmed", detail: "Sat, 11:00 AM", done: true },
  { label: "Verified agent assigned", detail: "RERA registered", done: true },
  { label: "Check-in recorded on site", detail: "Location confirmed", done: false },
] as const;

export function HeroShowcase({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      {/* Passport card */}
      <Card className="shadow-e3">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Fingerprint className="size-3.5 text-primary" />
              Property Passport
            </span>
            <Badge variant="success" size="sm">
              <BadgeCheck />
              Verified
            </Badge>
          </div>

          <p className="tabular mt-3 text-lg font-semibold tracking-tight">PROP-NCR-0001827</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            Sector 150, Noida
          </p>

          <dl className="mt-4 grid grid-cols-3 divide-x rounded-lg border bg-muted/40 py-3 text-center">
            {[
              { label: "Agents", value: "3" },
              { label: "Visits", value: "12" },
              { label: "Price points", value: "5" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="tabular text-sm font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Visit card, offset so the two read as one composition. */}
      <Card className="ml-6 mt-4 shadow-e3 sm:ml-10">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarCheck className="size-3.5 text-primary" />
              Site visit
            </span>
            <Badge variant="muted" size="sm">
              Example
            </Badge>
          </div>

          <ol className="mt-4 space-y-3">
            {VISIT_STEPS.map((step) => (
              <li key={step.label} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                    step.done
                      ? "bg-success text-success-foreground"
                      : "border-2 border-dashed border-muted-foreground/40",
                  )}
                >
                  {step.done && <BadgeCheck className="size-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium leading-tight">{step.label}</span>
                  <span className="block text-[0.7rem] text-muted-foreground">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-4 flex items-start gap-1.5 border-t pt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" />
            Your number stays with the agent taking the visit. It is never released to the network.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
