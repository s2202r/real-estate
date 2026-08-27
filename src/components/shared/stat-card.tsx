import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A single dashboard metric.
 *
 * Numbers use tabular figures so a column of stat cards lines up, and the
 * optional trend is rendered as text rather than a lone coloured arrow, which
 * is meaningless to a screen reader.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  accent = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  accent?: "default" | "success" | "warning" | "info";
  className?: string;
}) {
  const accentClasses = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success-muted text-success",
    warning: "bg-warning-muted text-warning-foreground",
    info: "bg-info-muted text-info",
  }[accent];

  return (
    <Card className={className}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="tabular mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <p
              className={cn(
                "mt-2 text-xs font-medium",
                trend.direction === "up" && "text-success",
                trend.direction === "down" && "text-destructive",
                trend.direction === "flat" && "text-muted-foreground",
              )}
            >
              {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "■"}{" "}
              {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", accentClasses)}>
            <Icon className="size-5" aria-hidden />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
