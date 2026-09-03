import { formatMoney, fromMajor, type CurrencyCode } from "@/lib/domain/money";
import { convert, describeRate, type ExchangeRate } from "@/lib/domain/fx";
import { cn } from "@/lib/utils";

/**
 * A rupee price, also shown in the currency the viewer thinks in.
 *
 * Renders NOTHING unless an administrator has published a rate for the pair.
 * That is the whole design: a converted figure with no rate behind it would
 * have to be invented, and an invented one is indistinguishable on screen from
 * a real one. Silence is the honest failure.
 *
 * The label always carries two things — that the figure is indicative, and the
 * date of the rate. A number without its age invites reliance it cannot bear,
 * and a rate nobody has refreshed for months looks exactly like a fresh one.
 */
export function SecondCurrency({
  amount,
  currency,
  rate,
  className,
}: {
  /** Major-unit rupee string, straight from the database. */
  amount: string;
  currency: CurrencyCode | null;
  rate: ExchangeRate | null;
  className?: string;
}) {
  if (!currency || !rate) return null;

  let converted;
  try {
    converted = convert(fromMajor(amount, "INR"), rate, new Date());
  } catch {
    // A rate that has gone bad in the database must not take a property page
    // down over a courtesy figure.
    return null;
  }

  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      <span className="tabular font-medium text-foreground">
        ≈ {formatMoney(converted.amount, { locale: "en-US" })}
      </span>{" "}
      <span className={converted.stale ? "text-warning-foreground" : undefined}>
        · {describeRate(converted)}
      </span>
    </p>
  );
}
