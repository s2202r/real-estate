import { BadgeCheck, Fingerprint, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The hero's visual.
 *
 * Rather than a stock photograph of a building, it shows the two things this
 * product has that a listing portal does not: a property passport that
 * accumulates history, and a commission split computed by a deterministic
 * engine. Both panels are labelled as examples — illustrative figures must
 * never be mistakable for a real property or a real payout.
 *
 * It is decoration in the layout sense only, so it is hidden from assistive
 * technology: everything it says is stated in the copy beside it.
 */

const SPLIT = [
  { role: "Listing agent", share: 45 },
  { role: "Visiting agent", share: 25 },
  { role: "Sourcing agent", share: 20 },
  { role: "Platform", share: 10 },
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

      {/* Commission card, overlapped so the two read as one composition. */}
      <Card className="ml-6 mt-4 shadow-e3 sm:ml-10">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5 text-primary" />
              Commission split
            </span>
            <Badge variant="muted" size="sm">
              Example
            </Badge>
          </div>

          <ul className="mt-3 space-y-2">
            {SPLIT.map((entry) => (
              <li key={entry.role} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{entry.role}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${entry.share}%` }}
                  />
                </span>
                <span className="tabular w-9 text-right text-xs font-semibold">
                  {entry.share}%
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 border-t pt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
            Computed by a deterministic engine from the rates on the deal — never estimated, never
            decided by a model.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
