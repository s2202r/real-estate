import { z } from "zod";

/**
 * Zod schemas for commission configuration.
 *
 * The commission policy is stored as `jsonb`, which means the database cannot
 * validate its shape. This schema is the gate: a policy is validated here
 * before it is written, and again when it is read back, so a malformed
 * document can never reach the engine and silently change a payout.
 */

const percentage = z.number().min(0).max(100);

export const VisitTierSharesSchema = z.object({
  latest: percentage,
  previous: percentage,
  earlier: percentage,
});

export const ContributionScoreWeightsSchema = z.object({
  recency: z.number().min(0).max(1),
  customerConfirmation: z.number().min(0).max(1),
  duration: z.number().min(0).max(1),
  outcome: z.number().min(0).max(1),
  interest: z.number().min(0).max(1),
  negotiation: z.number().min(0).max(1),
});

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal amount such as 25000.00");

export const CommissionPolicySchema = z.object({
  roleShares: z
    .object({
      LISTING_AGENT: percentage.optional(),
      SALES_AGENT: percentage.optional(),
      VISIT_POOL: percentage.optional(),
      REFERRAL_AGENT: percentage.optional(),
      INVESTOR: percentage.optional(),
      PLATFORM: percentage.optional(),
    })
    .refine(
      (shares) => Object.values(shares).some((value) => (value ?? 0) > 0),
      "At least one role must receive a share.",
    ),
  visitModel: z.enum(["LATEST_WEIGHTED", "WEIGHTED_SCORE", "EQUAL", "CUSTOM"]),
  visitTiers: VisitTierSharesSchema,
  scoreWeights: ContributionScoreWeightsSchema,
  unallocatedStrategy: z.enum(["PLATFORM", "PRORATA", "SALES_AGENT"]),
  targetVisitMinutes: z.number().int().positive().max(600),
  floors: z.record(z.string(), moneyString).optional(),
  caps: z.record(z.string(), moneyString).optional(),
  customVisitWeights: z.array(z.number().min(0)).optional(),
});

export type CommissionPolicyInput = z.infer<typeof CommissionPolicySchema>;

export const CommissionRuleFormSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(60)
      .regex(/^[a-z0-9-]+$/, "Use lowercase letters, digits and hyphens."),
    name: z.string().min(3).max(120),
    description: z.string().max(600).optional(),
    listingType: z.enum(["SALE", "RENT", "LEASE"]).optional(),
    city: z.string().max(80).optional(),
    poolMode: z.enum(["PERCENT_OF_TRANSACTION", "FIXED_AMOUNT"]),
    poolPercent: percentage.optional(),
    poolFixedAmount: moneyString.optional(),
    minPoolAmount: moneyString.optional(),
    maxPoolAmount: moneyString.optional(),
    priority: z.number().int().min(1).max(1000).default(100),
    isActive: z.boolean().default(true),
    policy: CommissionPolicySchema,
  })
  .refine(
    (value) =>
      value.poolMode === "PERCENT_OF_TRANSACTION"
        ? value.poolPercent !== undefined
        : value.poolFixedAmount !== undefined,
    { message: "A percentage pool needs a percentage; a fixed pool needs an amount.", path: ["poolPercent"] },
  )
  .refine(
    (value) =>
      !value.minPoolAmount ||
      !value.maxPoolAmount ||
      Number(value.maxPoolAmount) >= Number(value.minPoolAmount),
    { message: "The maximum pool must be at least the minimum.", path: ["maxPoolAmount"] },
  );

export type CommissionRuleFormInput = z.input<typeof CommissionRuleFormSchema>;
