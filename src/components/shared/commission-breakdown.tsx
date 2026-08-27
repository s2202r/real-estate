import { Calculator, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MoneyRow } from "./price-display";
import { formatMoney, fromMajor } from "@/lib/domain/money";
import type { CurrencyCode } from "@/lib/domain/money";

/**
 * Commission breakdown.
 *
 * The brief's §67 requirement: "The UI must show exactly how every amount was
 * calculated." This component renders the engine's OWN explanation trace rather
 * than re-deriving anything, so what an agent reads is literally what the
 * engine did. If the two ever disagreed, that would be a bug in the engine, not
 * a formatting difference here.
 */

export interface DistributionView {
  readonly role: string;
  readonly agentName?: string | null;
  readonly amount: string;
  readonly sharePercent?: number | null;
  readonly tier?: string | null;
  readonly contributionScore?: number | null;
  readonly basis?: string | null;
  readonly isYou?: boolean;
}

export interface ExplanationView {
  readonly step: string;
  readonly detail: string;
  readonly amount: string;
}

export function CommissionBreakdown({
  dealReference,
  transactionValue,
  commissionPool,
  currency = "INR",
  distributions,
  explanation,
  policyName,
  engineVersion,
  className,
}: {
  dealReference: string;
  transactionValue: string;
  commissionPool: string;
  currency?: CurrencyCode;
  distributions: readonly DistributionView[];
  explanation?: readonly ExplanationView[];
  policyName?: string | null;
  engineVersion?: string | null;
  className?: string;
}) {
  const roleRows = distributions.filter((row) => row.role !== "VISITING_AGENT");
  const visitRows = distributions.filter((row) => row.role === "VISITING_AGENT");

  const visitPoolTotal = visitRows.reduce(
    (acc, row) => acc + fromMajor(row.amount, currency).amountMinor,
    0,
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4" aria-hidden />
            Commission breakdown
          </CardTitle>
          <span className="tabular text-xs text-muted-foreground">{dealReference}</span>
        </div>
      </CardHeader>

      <CardContent>
        <dl className="space-y-1">
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-sm text-muted-foreground">Transaction value</dt>
            <dd className="tabular text-sm font-medium">
              {formatMoney(fromMajor(transactionValue, currency))}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1">
            <dt className="text-sm text-muted-foreground">Commission pool</dt>
            <dd className="tabular text-base font-semibold">
              {formatMoney(fromMajor(commissionPool, currency))}
            </dd>
          </div>
        </dl>

        <Separator className="my-4" />

        <div>
          {roleRows.map((row, index) => (
            <MoneyRow
              key={`${row.role}-${index}`}
              label={humanise(row.role)}
              sublabel={
                [
                  row.agentName,
                  row.sharePercent != null ? `${row.sharePercent}% of pool` : null,
                  row.isYou ? "You" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              amount={row.amount}
              currency={currency}
            />
          ))}

          {visitRows.length > 0 && (
            <>
              <MoneyRow
                label="Visit pool"
                sublabel={`${visitRows.length} qualifying ${visitRows.length === 1 ? "visit" : "visits"}`}
                amount={(visitPoolTotal / 100).toFixed(2)}
                currency={currency}
              />
              {visitRows.map((row, index) => (
                <MoneyRow
                  key={`visit-${index}`}
                  indent={1}
                  label={tierLabel(row.tier)}
                  sublabel={
                    [
                      row.agentName,
                      row.contributionScore != null
                        ? `contribution ${Number(row.contributionScore).toFixed(2)}`
                        : null,
                      row.isYou ? "You" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  amount={row.amount}
                  currency={currency}
                />
              ))}
            </>
          )}

          <MoneyRow label="Total distributed" amount={commissionPool} currency={currency} emphasis />
        </div>

        {explanation && explanation.length > 0 && (
          <>
            <Separator className="my-4" />
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium">
                How this was calculated
              </summary>
              <ol className="mt-3 space-y-2">
                {explanation.map((step, index) => (
                  <li key={index} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="min-w-0 text-muted-foreground">
                      <Badge variant="muted" size="sm" className="mr-2">
                        {step.step}
                      </Badge>
                      {step.detail}
                    </span>
                    <span className="tabular shrink-0 font-medium">
                      {formatMoney(fromMajor(step.amount, currency))}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          </>
        )}

        <p className="mt-4 flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Calculated by {engineVersion ?? "the commission engine"}
          {policyName ? ` using policy ${policyName}` : ""}. The policy in force was snapshotted
          into this calculation, so a later change to commission rules cannot alter these figures.
          Amounts are gross of taxes and statutory deductions.
        </p>
      </CardContent>
    </Card>
  );
}

function humanise(role: string): string {
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function tierLabel(tier: string | null | undefined): string {
  switch (tier) {
    case "LATEST":
      return "Latest meaningful visit";
    case "PREVIOUS":
      return "Previous visit";
    case "EARLIER":
      return "Earlier qualifying visit";
    default:
      return "Qualifying visit";
  }
}
