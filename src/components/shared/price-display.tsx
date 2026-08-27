import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyCompact, fromMajor, pricePerSqft } from "@/lib/domain/money";
import type { CurrencyCode } from "@/lib/domain/money";

/**
 * Money display.
 *
 * Always renders through lib/domain/money, so a price shown on screen is the
 * same value the engine computed — no ad-hoc `toLocaleString` drift, and no
 * float ever constructed from a `numeric` column.
 *
 * Indian short form (₹1.1 Cr) is the default because that is how prices are
 * actually read here; a card showing "₹11,000,000" reads as a foreign product.
 */

export function PriceDisplay({
  amount,
  currency = "INR",
  areaSqft,
  compact = true,
  size = "default",
  className,
}: {
  /** Major-unit string straight from the database. */
  amount: string;
  currency?: CurrencyCode;
  areaSqft?: number | null;
  compact?: boolean;
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
}) {
  const money = fromMajor(amount, currency);
  const perSqft = areaSqft ? pricePerSqft(money, areaSqft) : null;

  const sizeClasses = {
    sm: "text-sm font-semibold",
    default: "text-lg font-semibold",
    lg: "text-2xl font-bold",
    xl: "text-3xl font-bold sm:text-4xl",
  }[size];

  return (
    <div className={cn("tabular", className)}>
      <span className={cn(sizeClasses, "tracking-tight")}>
        {compact ? formatMoneyCompact(money) : formatMoney(money)}
      </span>
      {perSqft && (
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {formatMoney(perSqft)}/sq ft
        </span>
      )}
    </div>
  );
}

/** Rent needs a period suffix or the number is meaningless. */
export function RentDisplay({
  amount,
  currency = "INR",
  className,
}: {
  amount: string;
  currency?: CurrencyCode;
  className?: string;
}) {
  return (
    <div className={cn("tabular", className)}>
      <span className="text-lg font-semibold tracking-tight">
        {formatMoneyCompact(fromMajor(amount, currency))}
      </span>
      <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
    </div>
  );
}

/** A single labelled money row, used in commission and deal breakdowns. */
export function MoneyRow({
  label,
  amount,
  currency = "INR",
  sublabel,
  emphasis = false,
  indent = 0,
}: {
  label: string;
  amount: string;
  currency?: CurrencyCode;
  sublabel?: string;
  emphasis?: boolean;
  indent?: number;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2",
        emphasis && "border-t font-semibold",
      )}
      style={{ paddingLeft: indent * 16 }}
    >
      <div className="min-w-0">
        <p className={cn("truncate text-sm", emphasis ? "font-semibold" : "font-medium")}>{label}</p>
        {sublabel && <p className="truncate text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <span className={cn("tabular shrink-0 text-sm", emphasis && "text-base")}>
        {formatMoney(fromMajor(amount, currency))}
      </span>
    </div>
  );
}
