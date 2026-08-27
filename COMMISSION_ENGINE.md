# Commission Engine

The commission engine is the most consequential code in this platform. It decides
who gets paid. It is therefore **pure, deterministic, auditable and unit-tested**,
and it is deliberately isolated from the UI, the database and any AI.

```ts
calculateCommission(input: CommissionInput): CommissionResult
```

Same input → same output, byte for byte, forever. No `Date.now()`, no random, no
network, no floating point.

---

## 1. Non-negotiable rules

1. **No floats.** All arithmetic is in integer **paise**. `0.1 + 0.2` problems do
   not exist here by construction.
2. **The split always sums to the pool.** Largest-remainder distribution with a
   stable tie-break. Not "within a rupee" — *exactly*.
3. **Percentages are data.** Rules live in `commission_rules`, not in code.
4. **Policies are snapshotted.** The resolved policy is stored inside the
   calculation. Editing a rule tomorrow cannot alter yesterday's payout.
5. **History is immutable.** Corrections are `ADJUSTMENT` / `REVERSAL` ledger
   entries. A `PAID` row is never rewritten.
6. **AI is not involved.** Ever.
7. **Only qualified visits earn.** A visit that fails the qualification predicate
   receives zero, regardless of who conducted it.

---

## 2. Inputs

```ts
type CommissionInput = {
  deal: {
    id, referenceCode,
    transactionValue: Money,      // final agreed consideration
    commissionPool?: Money,       // if absent, derived from policy
    currency: "INR",
  };
  policy: CommissionPolicy;       // resolved, versioned, snapshotted
  participants: DealParticipant[];// listing / sales / referral / investor
  visits: QualifiedVisit[];       // only QUALIFIED visits are passed in
  investorAgreement?: InvestorAgreement | null;
};
```

## 3. Algorithm

```text
STEP 1  Determine the pool
        pool = policy.poolMode === "PERCENT_OF_TRANSACTION"
               ? transactionValue × poolPercent
               : explicit pool amount
        clamp(pool, policy.minPool, policy.maxPool)

STEP 2  Split the pool across ROLES using policy.roleShares
        LISTING_AGENT · SALES_AGENT · VISIT_POOL · REFERRAL_AGENT
        · INVESTOR · PLATFORM
        Largest-remainder distribution → sums exactly to pool.
        Roles with no eligible participant are dropped and their share
        is REDISTRIBUTED per policy.unallocatedStrategy
        ("PLATFORM" | "PRORATA" | "SALES_AGENT").

STEP 3  Split VISIT_POOL across qualifying visiting agents
        using policy.visitModel (see §4).

STEP 4  Apply per-participant floors and caps, then re-balance the
        residual so the total still equals the pool exactly.

STEP 5  Emit distributions + a human-readable explanation trace.
```

Every step appends to an `explanation[]` array. The UI renders that array
verbatim — the agent sees the same reasoning the engine used, not a re-derivation.

## 4. Visit-pool models

All four are data-driven; none is hard-coded as *the* model.

### `LATEST_WEIGHTED` (default)

The brief's model. The latest meaningful visit takes the headline share; earlier
qualifying visits share the remainder.

```text
latestShare        = 50%   (configurable)
previousShare      = 25%   (configurable, most-recent-but-one)
earlierPoolShare   = 25%   (configurable, split among the rest by score)
```

Worked example — visit pool ₹75,000, three qualifying visits:

```text
Latest meaningful visit   50%   ₹37,500
Previous visit            25%   ₹18,750
Earlier qualifying        25%   ₹18,750
                                ────────
                                ₹75,000
```

If only one qualifying visit exists, the unfilled tiers collapse into the latest
agent — the pool is never left short and never over-distributed.

### `WEIGHTED_SCORE`

Each visit gets a **contribution score** (§5); the pool is split in proportion.

### `EQUAL`

Equal split across distinct qualifying visiting agents.

### `CUSTOM`

Admin supplies explicit ordinal weights.

## 5. Visit contribution score

Deterministic, transparent, weighted — never opaque:

| Factor | Default weight | Basis |
| --- | --- | --- |
| Recency | 0.35 | rank among qualifying visits, most recent highest |
| Customer confirmation | 0.20 | OTP/in-app confirmation present |
| Duration | 0.15 | dwell time, capped at the policy target |
| Outcome | 0.15 | `INTERESTED` > `NEEDS_FOLLOW_UP` > `NOT_INTERESTED` |
| Customer interest rating | 0.10 | 1–5 recorded by the agent, confirmed by customer |
| Negotiation involvement | 0.05 | agent participated in negotiation events |

Scores are computed in `lib/domain/attribution.ts`, are inspectable in the UI, and
are stored with the calculation.

## 6. Worked end-to-end example

```text
Deal: DEAL-NCR-000456
Transaction Value:      ₹1,10,00,000
Policy:                 default-sale v1
Commission Pool:        ₹5,00,000   (agreed manually for this deal, so the
                                     policy's percentage formula is bypassed)

Role split
  Listing Agent    20%  ₹1,00,000
  Sales Agent      40%  ₹2,00,000
  Visit Pool       15%  ₹  75,000
  Platform         25%  ₹1,25,000
                        ──────────
                        ₹5,00,000

Visit pool (LATEST_WEIGHTED, 3 qualifying visits)
  Latest meaningful visit   — Agent C   ₹37,500
  Previous visit            — Agent D   ₹18,750
  Earlier qualifying        — Agent E   ₹18,750
                                        ────────
                                        ₹75,000
```

The UI (`<CommissionBreakdown />`) renders exactly this, including the derivation
of each figure. An agent who disputes a number can see the arithmetic before
raising a dispute.

## 7. Ledger lifecycle

```text
PENDING → CALCULATED → APPROVED → PAYMENT_PROCESSING → PAID
                   ↘ DISPUTED ↗
                   ↘ CANCELLED
```

Transitions are validated server-side by `assertLedgerTransition`. Illegal
transitions (e.g. `PAID → CALCULATED`) throw. Recalculating a deal supersedes the
previous calculation with a new version and writes reversal entries for anything
already recorded — it never edits in place.

## 8. Testing

`src/lib/domain/__tests__/commission.test.ts` covers: exact-sum invariance across
randomised pools, the brief's worked example to the paisa, all four visit models,
floors/caps, zero-visit and single-visit collapse, unallocated redistribution,
investor participation, and ledger transition legality. `money.test.ts` covers
minor-unit conversion, rounding and largest-remainder distribution.
