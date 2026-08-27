import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "@/lib/domain/geo";
import type { LocationScore as LocationScoreResult } from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";

/**
 * Location score.
 *
 * The headline number is always shown with the factors behind it. A bare
 * "Location score: 87" that a customer cannot interrogate is not a trust
 * signal, it is a claim.
 */
export function LocationScoreCard({
  score,
  className,
}: {
  score: LocationScoreResult;
  className?: string;
}) {
  const known = score.factors.filter((factor) => factor.nearest !== null);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Location score</CardTitle>
          <div className="flex items-center gap-2">
            <span className="tabular text-2xl font-bold">{score.score}</span>
            <Badge variant={score.score >= 70 ? "success" : score.score >= 50 ? "info" : "muted"}>
              {score.grade}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {known.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No nearby landmarks recorded for this property yet.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {known.map((factor) => (
              <li key={factor.key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{factor.label}</span>
                  </span>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {factor.nearest ? formatDistance(factor.nearest.distanceKm) : "—"}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      factor.score >= 70 ? "bg-success" : factor.score >= 40 ? "bg-warning" : "bg-muted-foreground/40",
                    )}
                    style={{ width: `${factor.score}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {score.coverage < 0.6 && known.length > 0 && (
          <p className="border-t pt-3 text-xs text-muted-foreground">
            Based on partial landmark data for this property, so treat it as indicative.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
