import { Gauge, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MINIMUM_COMPARABLES,
  describeRange,
  type IndicativeValuation,
} from "@/lib/domain/valuation";

/**
 * The indicative range.
 *
 * Presented as a range and never as a figure, with the sample size next to it,
 * because "₹1.6–2.1 Cr across 14 comparable listings" is a claim somebody can
 * weigh and "estimated value: ₹1.84 Cr" is one they will simply believe.
 *
 * When there are too few comparables it says so plainly rather than widening
 * the range and hoping — a number on screen is remembered long after the
 * caveat beside it is forgotten.
 */
export function ValuationCard({
  valuation,
  locality,
}: {
  valuation: IndicativeValuation;
  locality: string;
}) {
  const range = describeRange(valuation);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4" aria-hidden />
          What comparable listings ask
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {!valuation.available || !range ? (
          <p className="text-sm text-muted-foreground">
            {valuation.sampleSize === 0
              ? `No comparable verified listings in ${locality} yet.`
              : `Only ${valuation.sampleSize} comparable listing${
                  valuation.sampleSize === 1 ? "" : "s"
                } in ${locality} — too few to draw a range from. It needs at least ${MINIMUM_COMPARABLES}.`}
          </p>
        ) : (
          <>
            <p className="tabular text-2xl font-bold tracking-tight">{range}</p>
            <p className="text-sm text-muted-foreground">
              From {valuation.sampleSize} verified listings in {locality}, at ₹
              {valuation.perSqftLow?.toLocaleString("en-IN")}–
              {valuation.perSqftHigh?.toLocaleString("en-IN")} per sq ft. The middle half of the
              market; the cheapest and dearest quarter are left out.
            </p>

            <Badge
              variant={
                valuation.askingPosition === "INSIDE"
                  ? "info"
                  : valuation.askingPosition === "BELOW"
                    ? "success"
                    : "warning"
              }
            >
              {valuation.askingPosition === "INSIDE"
                ? "The asking price sits inside this range"
                : valuation.askingPosition === "BELOW"
                  ? "The asking price is below this range"
                  : "The asking price is above this range"}
            </Badge>
          </>
        )}

        <p className="flex items-start gap-2 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {valuation.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
