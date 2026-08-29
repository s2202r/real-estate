"use client";

import { useActionState, useMemo, useState } from "react";
import { Loader2, Pause, Pencil, Play, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CityPicker } from "@/components/shared/city-picker";
import { saveCommissionRule, setCommissionRuleActive } from "@/lib/actions/admin";
import { DEFAULT_COMMISSION_POLICY, PARTICIPANT_ROLES } from "@/lib/domain/commission";
import type { ActionResult } from "@/lib/actions/leads";

export interface EditableRule {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly version: number;
  readonly listing_type: string | null;
  readonly city: string | null;
  readonly pool_mode: string;
  readonly pool_percent: string | null;
  readonly pool_fixed_amount: string | null;
  readonly min_pool_amount: string | null;
  readonly max_pool_amount: string | null;
  readonly priority: number;
  readonly is_active: boolean;
  readonly policy: unknown;
}

const ROLE_LABELS: Record<string, string> = {
  LISTING_AGENT: "Listing agent",
  SALES_AGENT: "Sales agent",
  VISIT_POOL: "Visiting agents (pool)",
  REFERRAL_AGENT: "Referral agent",
  INVESTOR: "Investor",
  PLATFORM: "Platform",
};

const WEIGHT_LABELS: Record<string, string> = {
  recency: "Recency",
  customerConfirmation: "Customer confirmed",
  duration: "Visit duration",
  outcome: "Outcome",
  interest: "Interest shown",
  negotiation: "Negotiation",
};

/**
 * Publish a commission rule, new or as a new version of an existing one.
 *
 * Every percentage the engine uses comes from here. Nothing is computed by a
 * model and nothing is hard-coded: the form writes a policy document, the
 * engine reads it, and each calculation keeps a copy of the document it used.
 *
 * Saving an edit publishes a NEW VERSION rather than overwriting, which is why
 * the button says "Publish" — deals already calculated keep the terms they
 * were calculated under.
 */
export function CommissionRuleEditor({ rule }: { rule?: EditableRule }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={rule ? "outline" : "default"} size="sm">
          {rule ? <Pencil aria-hidden /> : <Plus aria-hidden />}
          {rule ? "Edit" : "New rule"}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rule ? `Edit ${rule.code} (v${rule.version})` : "New commission rule"}
          </DialogTitle>
          <DialogDescription>
            {rule
              ? "Saving publishes v" +
                (rule.version + 1) +
                " and closes this version. Deals already calculated keep the terms they were calculated under."
              : "Percentages live here as data. The engine reads this policy and snapshots it into every calculation it makes."}
          </DialogDescription>
        </DialogHeader>

        <RuleForm rule={rule} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RuleForm({ rule, onDone }: { rule?: EditableRule; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string; version: number }> | null,
    FormData
  >(saveCommissionRule, null);

  const policy = readPolicy(rule?.policy);

  const [poolMode, setPoolMode] = useState(rule?.pool_mode ?? "PERCENT_OF_TRANSACTION");
  const [visitModel, setVisitModel] = useState<string>(policy.visitModel);
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PARTICIPANT_ROLES.map((role) => [role, String(policy.roleShares[role] ?? 0)]),
    ),
  );

  // Shares are relative weights, not absolute percentages: the engine hands
  // the whole pool out in proportion to them. Showing what they actually work
  // out to stops "20 / 40 / 15 / 25" being read as "and 0% left over" when it
  // is not.
  const effective = useMemo(() => {
    const values = PARTICIPANT_ROLES.map((role) => Math.max(0, Number(shares[role]) || 0));
    const total = values.reduce((sum, value) => sum + value, 0);
    return { total, values };
  }, [shares]);

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-success-muted p-3 text-sm text-success">{state.message}</p>
        <Button variant="outline" onClick={onDone}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {rule && <input type="hidden" name="ruleId" value={rule.id} />}

      <Section title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" name="code" defaultValue={rule?.code} state={state}>
            <Input
              id="code"
              name="code"
              required
              readOnly={Boolean(rule)}
              defaultValue={rule?.code ?? ""}
              placeholder="ncr-sale-default"
              className={rule ? "bg-muted" : undefined}
            />
          </Field>
          <Field label="Name" name="name" state={state}>
            <Input
              id="name"
              name="name"
              required
              defaultValue={rule?.name ?? ""}
              placeholder="NCR sale — standard"
            />
          </Field>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            maxLength={600}
            defaultValue={rule?.description ?? ""}
          />
        </div>
      </Section>

      <Section
        title="Scope"
        hint="Leave a field empty to apply everywhere. The most specific matching rule wins; priority breaks a tie, lowest first."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Listing type" name="listingType" state={state}>
            <select
              id="listingType"
              name="listingType"
              defaultValue={rule?.listing_type ?? ""}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Any</option>
              <option value="SALE">Sale</option>
              <option value="RENT">Rent</option>
              <option value="LEASE">Lease</option>
            </select>
          </Field>

          <CityPicker
            id="rule-city"
            label="City (optional)"
            defaultValue={rule?.city ?? ""}
            placeholder="Any city"
            error={state?.fieldErrors?.city}
          />

          <Field label="Priority" name="priority" state={state}>
            <Input
              id="priority"
              name="priority"
              type="number"
              min={1}
              max={1000}
              defaultValue={rule?.priority ?? 100}
            />
          </Field>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={rule?.is_active ?? true}
                className="size-4 rounded border-input"
              />
              Apply this rule to new deals
            </label>
          </div>
        </div>
      </Section>

      <Section title="Commission pool" hint="What the platform charges on the transaction.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pool" name="poolMode" state={state}>
            <select
              id="poolMode"
              name="poolMode"
              value={poolMode}
              onChange={(event) => setPoolMode(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="PERCENT_OF_TRANSACTION">Percent of transaction</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
            </select>
          </Field>

          {poolMode === "PERCENT_OF_TRANSACTION" ? (
            <Field label="Percent of transaction" name="poolPercent" state={state}>
              <Input
                id="poolPercent"
                name="poolPercent"
                type="number"
                step="0.01"
                min={0}
                max={100}
                required
                defaultValue={rule?.pool_percent ?? "2"}
              />
            </Field>
          ) : (
            <Field label="Fixed amount (₹)" name="poolFixedAmount" state={state}>
              <Input
                id="poolFixedAmount"
                name="poolFixedAmount"
                required
                inputMode="decimal"
                defaultValue={rule?.pool_fixed_amount ?? ""}
                placeholder="50000.00"
              />
            </Field>
          )}

          <Field label="Minimum pool (₹)" name="minPoolAmount" state={state}>
            <Input
              id="minPoolAmount"
              name="minPoolAmount"
              inputMode="decimal"
              defaultValue={rule?.min_pool_amount ?? ""}
              placeholder="Optional"
            />
          </Field>
          <Field label="Maximum pool (₹)" name="maxPoolAmount" state={state}>
            <Input
              id="maxPoolAmount"
              name="maxPoolAmount"
              inputMode="decimal"
              defaultValue={rule?.max_pool_amount ?? ""}
              placeholder="Optional"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Who the pool is divided between"
        hint="Relative weights, not absolute percentages: the whole pool is always distributed in proportion to them. A role with nobody in it has its weight redistributed by the strategy below."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {PARTICIPANT_ROLES.map((role, index) => (
            <div key={role} className="space-y-1.5">
              <Label htmlFor={`share-${role}`}>{ROLE_LABELS[role] ?? role}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`share-${role}`}
                  name={`share.${role}`}
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={shares[role] ?? "0"}
                  onChange={(event) =>
                    setShares((current) => ({ ...current, [role]: event.target.value }))
                  }
                />
                <span className="tabular w-16 shrink-0 text-right text-xs text-muted-foreground">
                  {effective.total > 0
                    ? `${(((effective.values[index] ?? 0) / effective.total) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
        {effective.total === 0 && (
          <p className="text-xs text-destructive">At least one role must receive a share.</p>
        )}
        {state?.fieldErrors?.policy && (
          <p className="text-xs text-destructive">{state.fieldErrors.policy[0]}</p>
        )}
      </Section>

      <Section title="How the visit pool is split">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Model" name="visitModel" state={state}>
            <select
              id="visitModel"
              name="visitModel"
              value={visitModel}
              onChange={(event) => setVisitModel(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="LATEST_WEIGHTED">Latest visit weighted</option>
              <option value="WEIGHTED_SCORE">Weighted by contribution score</option>
              <option value="EQUAL">Equal between visits</option>
              <option value="CUSTOM">Custom weights</option>
            </select>
          </Field>

          <Field label="Unallocated share goes to" name="unallocatedStrategy" state={state}>
            <select
              id="unallocatedStrategy"
              name="unallocatedStrategy"
              defaultValue={policy.unallocatedStrategy}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="PLATFORM">The platform</option>
              <option value="PRORATA">Everyone, pro rata</option>
              <option value="SALES_AGENT">The sales agent</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Latest visit %" name="tier.latest" state={state}>
            <Input
              id="tier-latest"
              name="tier.latest"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={policy.visitTiers.latest}
            />
          </Field>
          <Field label="Previous visit %" name="tier.previous" state={state}>
            <Input
              id="tier-previous"
              name="tier.previous"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={policy.visitTiers.previous}
            />
          </Field>
          <Field label="Earlier visits %" name="tier.earlier" state={state}>
            <Input
              id="tier-earlier"
              name="tier.earlier"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={policy.visitTiers.earlier}
            />
          </Field>
          <Field label="Full-credit visit (min)" name="targetVisitMinutes" state={state}>
            <Input
              id="targetVisitMinutes"
              name="targetVisitMinutes"
              type="number"
              min={1}
              max={600}
              defaultValue={policy.targetVisitMinutes}
            />
          </Field>
        </div>

        <details className="rounded-lg border p-3" open={visitModel === "WEIGHTED_SCORE"}>
          <summary className="cursor-pointer text-sm font-medium">
            Contribution score weights
            <span className="ml-2 font-normal text-muted-foreground">
              — used by the weighted-score model
            </span>
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {Object.entries(policy.scoreWeights).map(([key, value]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`weight-${key}`}>{WEIGHT_LABELS[key] ?? key}</Label>
                <Input
                  id={`weight-${key}`}
                  name={`weight.${key}`}
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  defaultValue={value}
                />
              </div>
            ))}
          </div>
        </details>
      </Section>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Why is this changing?</Label>
        <Textarea
          id="reason"
          name="reason"
          rows={2}
          maxLength={500}
          required
          placeholder="Recorded against this version in the audit log."
        />
        {state?.fieldErrors?.reason && (
          <p className="text-xs text-destructive">{state.fieldErrors.reason[0]}</p>
        )}
      </div>

      {state && !state.ok && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        {rule ? `Publish v${rule.version + 1}` : "Publish rule"}
      </Button>
    </form>
  );
}

/** Switch a rule on or off without forking its history. */
export function RuleActiveControl({ rule }: { rule: EditableRule }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setCommissionRuleActive,
    null,
  );
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          {rule.is_active ? <Pause aria-hidden /> : <Play aria-hidden />}
          {rule.is_active ? "Stop applying" : "Apply again"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {rule.is_active ? "Stop applying" : "Apply again"}: {rule.code} v{rule.version}
          </DialogTitle>
          <DialogDescription>
            {rule.is_active
              ? "Deals closing from now on will fall to the next matching rule — or to none, if there is no other. Calculations already made are untouched."
              : "This rule will be considered again for deals closing from now on."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="ruleId" value={rule.id} />
          <input type="hidden" name="active" value={rule.is_active ? "0" : "1"} />

          <div className="space-y-1.5">
            <Label htmlFor={`reason-${rule.id}`}>Reason</Label>
            <Textarea id={`reason-${rule.id}`} name="reason" rows={2} maxLength={500} required />
          </div>

          {state && !state.ok && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.message}
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {rule.is_active ? "Stop applying it" : "Apply it again"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  state,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  state: ActionResult<{ id: string; version: number }> | null;
  children: React.ReactNode;
}) {
  const error = state?.fieldErrors?.[name];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}

/**
 * Read a stored policy, falling back to the engine's default for anything a
 * row does not carry. A rule written before a policy field existed must still
 * open in the editor rather than crashing it.
 */
function readPolicy(raw: unknown) {
  const stored = (raw ?? {}) as Partial<typeof DEFAULT_COMMISSION_POLICY>;
  return {
    ...DEFAULT_COMMISSION_POLICY,
    ...stored,
    roleShares: { ...DEFAULT_COMMISSION_POLICY.roleShares, ...(stored.roleShares ?? {}) },
    visitTiers: { ...DEFAULT_COMMISSION_POLICY.visitTiers, ...(stored.visitTiers ?? {}) },
    scoreWeights: { ...DEFAULT_COMMISSION_POLICY.scoreWeights, ...(stored.scoreWeights ?? {}) },
  };
}
