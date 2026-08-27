import { describe, expect, it } from "vitest";
import {
  calculateCommission,
  CommissionError,
  contributionScore,
  DEFAULT_COMMISSION_POLICY,
  summariseCommission,
  totalForAgent,
  type CommissionInput,
  type CommissionPolicy,
  type QualifiedVisitInput,
} from "../commission";
import { fromMajor, toMajorString } from "../money";

const AGENT_A = "agent-a-listing";
const AGENT_C = "agent-c-sales-and-visit";
const AGENT_E = "agent-e-latest-visit";

function visit(
  overrides: Partial<QualifiedVisitInput> & Pick<QualifiedVisitInput, "id" | "agentId" | "endedAt">,
): QualifiedVisitInput {
  return {
    durationMinutes: 45,
    customerConfirmed: true,
    outcome: "INTERESTED",
    interestLevel: 4,
    involvedInNegotiation: false,
    ...overrides,
  };
}

/**
 * The exact scenario documented in COMMISSION_ENGINE.md and created by
 * supabase/seed.sql. If the engine and the documentation ever disagree, this
 * test fails.
 */
function workedExample(overrides: Partial<CommissionInput> = {}): CommissionInput {
  return {
    deal: {
      id: "deal-1",
      referenceCode: "DEAL-NCR-000456",
      transactionValue: "11000000.00",
      commissionPool: "500000.00",
      currency: "INR",
    },
    policy: DEFAULT_COMMISSION_POLICY,
    participants: [
      { id: "p1", role: "LISTING_AGENT", agentId: AGENT_A },
      { id: "p2", role: "SALES_AGENT", agentId: AGENT_C },
      { id: "p4", role: "PLATFORM" },
    ],
    visits: [
      visit({ id: "visit-2", agentId: AGENT_E, endedAt: "2026-08-18T11:30:00Z", outcome: "NEGOTIATION_STARTED", interestLevel: 5, durationMinutes: 55, involvedInNegotiation: true }),
      visit({ id: "visit-1", agentId: AGENT_C, endedAt: "2026-08-07T16:42:00Z", durationMinutes: 42 }),
      visit({ id: "visit-3", agentId: AGENT_A, endedAt: "2026-07-28T10:28:00Z", outcome: "NEEDS_FOLLOW_UP", interestLevel: 3, durationMinutes: 28 }),
    ],
    ...overrides,
  };
}

describe("the documented worked example", () => {
  const result = calculateCommission(workedExample());

  it("produces the documented pool", () => {
    expect(result.commissionPool).toBe("500000.00");
  });

  it("produces the documented role split, to the rupee", () => {
    const byRole = Object.fromEntries(
      result.distributions
        .filter((d) => d.role !== "VISITING_AGENT")
        .map((d) => [d.role, d.amount]),
    );
    expect(byRole).toEqual({
      LISTING_AGENT: "100000.00",
      SALES_AGENT: "200000.00",
      PLATFORM: "125000.00",
    });
  });

  it("produces the documented visit-pool split, to the rupee", () => {
    const visits = result.distributions.filter((d) => d.role === "VISITING_AGENT");
    expect(visits.map((v) => [v.tier, v.agentId, v.amount])).toEqual([
      ["LATEST", AGENT_E, "37500.00"],
      ["PREVIOUS", AGENT_C, "18750.00"],
      ["EARLIER", AGENT_A, "18750.00"],
    ]);
  });

  it("sums exactly to the pool", () => {
    const total = result.distributions.reduce((acc, d) => acc + d.amountMinor, 0);
    expect(total).toBe(50_000_000);
  });

  it("attributes both of an agent's roles to that agent", () => {
    // Agent C is the sales agent AND conducted the previous qualifying visit.
    expect(toMajorString(totalForAgent(result, AGENT_C))).toBe("218750.00");
    // Agent A is the listing agent AND conducted the earliest qualifying visit.
    expect(toMajorString(totalForAgent(result, AGENT_A))).toBe("118750.00");
  });

  it("explains every figure it produced", () => {
    expect(result.explanation.length).toBeGreaterThanOrEqual(8);
    expect(result.explanation.map((e) => e.step)).toContain("pool");
    expect(result.explanation.map((e) => e.step)).toContain("role");
    expect(result.explanation.map((e) => e.step)).toContain("visit");
    // Every step carries the amount it justifies.
    expect(result.explanation.every((e) => /^\d+\.\d{2}$/.test(e.amount))).toBe(true);
  });

  it("snapshots the policy it applied", () => {
    expect(result.policySnapshot).toEqual(DEFAULT_COMMISSION_POLICY);
  });

  it("is deterministic across repeated evaluation", () => {
    for (let i = 0; i < 25; i += 1) {
      expect(calculateCommission(workedExample())).toEqual(result);
    }
  });

  it("is order-independent: shuffling the visit input changes nothing", () => {
    const base = workedExample();
    const shuffled = calculateCommission({
      ...base,
      visits: [base.visits[2]!, base.visits[0]!, base.visits[1]!],
    });
    expect(shuffled.distributions).toEqual(result.distributions);
  });

  it("renders a readable summary", () => {
    const summary = summariseCommission(result);
    expect(summary).toContain("DEAL-NCR-000456");
    expect(summary).toContain("Latest meaningful visit");
  });
});

describe("pool derivation from a rule", () => {
  it("derives the pool as a percentage of the transaction value", () => {
    const result = calculateCommission(
      workedExample({
        deal: {
          id: "deal-2",
          referenceCode: "DEAL-NCR-000457",
          transactionValue: "11000000.00",
          commissionPool: null,
          currency: "INR",
        },
        poolRule: { mode: "PERCENT_OF_TRANSACTION", percent: 2, ruleCode: "default-sale" },
      }),
    );
    expect(result.commissionPool).toBe("220000.00");
  });

  it("applies a minimum pool", () => {
    const result = calculateCommission(
      workedExample({
        deal: {
          id: "deal-3",
          referenceCode: "DEAL-NCR-000458",
          transactionValue: "500000.00",
          commissionPool: null,
          currency: "INR",
        },
        poolRule: {
          mode: "PERCENT_OF_TRANSACTION",
          percent: 2,
          minAmount: "25000.00",
          ruleCode: "default-sale",
        },
      }),
    );
    // 2% of 5,00,000 = 10,000, raised to the 25,000 floor.
    expect(result.commissionPool).toBe("25000.00");
    expect(result.explanation.some((e) => e.detail.includes("minimum pool"))).toBe(true);
  });

  it("applies a maximum pool", () => {
    const result = calculateCommission(
      workedExample({
        deal: {
          id: "deal-4",
          referenceCode: "DEAL-NCR-000459",
          transactionValue: "500000000.00",
          commissionPool: null,
          currency: "INR",
        },
        poolRule: {
          mode: "PERCENT_OF_TRANSACTION",
          percent: 2,
          maxAmount: "1000000.00",
        },
      }),
    );
    expect(result.commissionPool).toBe("1000000.00");
  });

  it("supports a fixed pool", () => {
    const result = calculateCommission(
      workedExample({
        deal: {
          id: "deal-5",
          referenceCode: "DEAL-NCR-000460",
          transactionValue: "600000.00",
          commissionPool: null,
          currency: "INR",
        },
        poolRule: { mode: "FIXED_AMOUNT", fixedAmount: "50000.00" },
      }),
    );
    expect(result.commissionPool).toBe("50000.00");
  });

  it("refuses to calculate without a pool or a rule", () => {
    expect(() =>
      calculateCommission(
        workedExample({
          deal: {
            id: "d",
            referenceCode: "DEAL-X",
            transactionValue: "100.00",
            commissionPool: null,
            currency: "INR",
          },
        }),
      ),
    ).toThrow(CommissionError);
  });

  it("refuses a non-positive transaction value", () => {
    expect(() =>
      calculateCommission(
        workedExample({
          deal: {
            id: "d",
            referenceCode: "DEAL-X",
            transactionValue: "0.00",
            commissionPool: "1000.00",
            currency: "INR",
          },
        }),
      ),
    ).toThrow(CommissionError);
  });
});

describe("visit distribution models", () => {
  const base = workedExample();

  function withModel(model: CommissionPolicy["visitModel"], extra: Partial<CommissionPolicy> = {}) {
    return calculateCommission({
      ...base,
      policy: { ...DEFAULT_COMMISSION_POLICY, visitModel: model, ...extra },
    }).distributions.filter((d) => d.role === "VISITING_AGENT");
  }

  it("LATEST_WEIGHTED matches the documented tiers", () => {
    expect(withModel("LATEST_WEIGHTED").map((d) => d.amount)).toEqual([
      "37500.00",
      "18750.00",
      "18750.00",
    ]);
  });

  it("EQUAL splits evenly and still sums exactly", () => {
    const parts = withModel("EQUAL");
    expect(parts.map((d) => d.amount)).toEqual(["25000.00", "25000.00", "25000.00"]);
    expect(parts.reduce((a, d) => a + d.amountMinor, 0)).toBe(7_500_000);
  });

  it("WEIGHTED_SCORE rewards the higher-contribution visit and still sums exactly", () => {
    const parts = withModel("WEIGHTED_SCORE");
    expect(parts.reduce((a, d) => a + d.amountMinor, 0)).toBe(7_500_000);
    // The latest visit involved negotiation and a 5/5 interest level.
    expect(parts[0]!.amountMinor).toBeGreaterThan(parts[1]!.amountMinor);
    expect(parts[1]!.amountMinor).toBeGreaterThan(parts[2]!.amountMinor);
  });

  it("CUSTOM honours admin-defined weights", () => {
    const parts = withModel("CUSTOM", { customVisitWeights: [70, 20, 10] });
    expect(parts.map((d) => d.amount)).toEqual(["52500.00", "15000.00", "7500.00"]);
  });

  it("CUSTOM does not drop visits beyond the supplied weights", () => {
    const withFourVisits = calculateCommission({
      ...base,
      policy: { ...DEFAULT_COMMISSION_POLICY, visitModel: "CUSTOM", customVisitWeights: [50, 30] },
      visits: [
        ...base.visits,
        visit({ id: "visit-4", agentId: "agent-z", endedAt: "2026-07-01T09:00:00Z" }),
      ],
    }).distributions.filter((d) => d.role === "VISITING_AGENT");
    expect(withFourVisits).toHaveLength(4);
    expect(withFourVisits.reduce((a, d) => a + d.amountMinor, 0)).toBe(7_500_000);
  });
});

describe("visit-count edge cases", () => {
  const base = workedExample();

  it("collapses tiers when only one visit qualifies", () => {
    const result = calculateCommission({ ...base, visits: [base.visits[0]!] });
    const visits = result.distributions.filter((d) => d.role === "VISITING_AGENT");
    expect(visits).toHaveLength(1);
    // The single agent takes the whole visit pool; nothing is left stranded.
    expect(visits[0]!.amount).toBe("75000.00");
  });

  it("splits sensibly across exactly two visits", () => {
    const result = calculateCommission({ ...base, visits: base.visits.slice(0, 2) });
    const visits = result.distributions.filter((d) => d.role === "VISITING_AGENT");
    expect(visits.reduce((a, d) => a + d.amountMinor, 0)).toBe(7_500_000);
    expect(visits[0]!.amountMinor).toBeGreaterThan(visits[1]!.amountMinor);
  });

  it("redistributes the visit pool when NO visit qualifies", () => {
    const result = calculateCommission({ ...base, visits: [] });
    expect(result.distributions.some((d) => d.role === "VISITING_AGENT")).toBe(false);
    // 15% had nowhere to go, so under the PLATFORM strategy it lands there:
    // 25% + 15% of the 500000 pool = 200000.
    const platform = result.distributions.find((d) => d.role === "PLATFORM");
    expect(platform?.amount).toBe("200000.00");
    expect(result.warnings.some((w) => w.includes("VISIT_POOL"))).toBe(true);
    expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(50_000_000);
  });

  it("distributes many qualifying visits without losing a paisa", () => {
    const many = Array.from({ length: 17 }, (_, i) =>
      visit({
        id: `visit-${String(i).padStart(2, "0")}`,
        agentId: `agent-${i}`,
        endedAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      }),
    );
    const result = calculateCommission({ ...base, visits: many });
    const visitRows = result.distributions.filter((d) => d.role === "VISITING_AGENT");
    expect(visitRows).toHaveLength(17);
    expect(visitRows.reduce((a, d) => a + d.amountMinor, 0)).toBe(7_500_000);
  });
});

describe("unallocated-share strategies", () => {
  const base = workedExample();
  const noSalesAgent = {
    ...base,
    participants: [
      { id: "p1", role: "LISTING_AGENT" as const, agentId: AGENT_A },
      { id: "p4", role: "PLATFORM" as const },
    ],
  };

  it("PLATFORM sends the orphaned share to the platform", () => {
    const result = calculateCommission(noSalesAgent);
    // Platform 25% + orphaned Sales 40% = 65% of 500000.
    expect(result.distributions.find((d) => d.role === "PLATFORM")?.amount).toBe("325000.00");
    expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(50_000_000);
  });

  it("PRORATA spreads the orphaned share across the remaining roles", () => {
    const result = calculateCommission({
      ...noSalesAgent,
      policy: { ...DEFAULT_COMMISSION_POLICY, unallocatedStrategy: "PRORATA" },
    });
    expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(50_000_000);
    // Listing agent gains proportionally rather than the platform taking it all.
    const listing = result.distributions.find((d) => d.role === "LISTING_AGENT");
    expect(listing!.amountMinor).toBeGreaterThan(10_000_000);
  });

  it("falls back to PRORATA when the targeted role is itself missing", () => {
    const result = calculateCommission({
      ...noSalesAgent,
      policy: { ...DEFAULT_COMMISSION_POLICY, unallocatedStrategy: "SALES_AGENT" },
    });
    expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(50_000_000);
  });

  it("throws rather than paying out when nobody is eligible", () => {
    expect(() =>
      calculateCommission({
        ...base,
        visits: [],
        participants: [],
        policy: {
          ...DEFAULT_COMMISSION_POLICY,
          roleShares: { LISTING_AGENT: 100 },
        },
      }),
    ).toThrow(CommissionError);
  });
});

describe("floors and caps", () => {
  const base = workedExample();

  it("raises a distribution to its floor and settles the residual", () => {
    const result = calculateCommission({
      ...base,
      policy: { ...DEFAULT_COMMISSION_POLICY, floors: { LISTING_AGENT: "150000.00" } },
    });
    expect(result.distributions.find((d) => d.role === "LISTING_AGENT")?.amount).toBe("150000.00");
    expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(50_000_000);
    expect(result.explanation.some((e) => e.step === "adjustment")).toBe(true);
  });

  it("caps a distribution and settles the residual", () => {
    const result = calculateCommission({
      ...base,
      policy: { ...DEFAULT_COMMISSION_POLICY, caps: { SALES_AGENT: "120000.00" } },
    });
    expect(result.distributions.find((d) => d.role === "SALES_AGENT")?.amount).toBe("120000.00");
    expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(50_000_000);
  });
});

describe("investor and referral participation", () => {
  it("pays an investor and a referral agent when the policy allocates to them", () => {
    const base = workedExample();
    const result = calculateCommission({
      ...base,
      policy: {
        ...DEFAULT_COMMISSION_POLICY,
        roleShares: {
          LISTING_AGENT: 15,
          SALES_AGENT: 30,
          VISIT_POOL: 15,
          REFERRAL_AGENT: 10,
          INVESTOR: 10,
          PLATFORM: 20,
        },
      },
      participants: [
        ...base.participants,
        { id: "p5", role: "REFERRAL_AGENT", agentId: "agent-referrer" },
        { id: "p6", role: "INVESTOR", investorId: "investor-1" },
      ],
    });

    expect(result.distributions.find((d) => d.role === "REFERRAL_AGENT")?.amount).toBe("50000.00");
    expect(result.distributions.find((d) => d.role === "INVESTOR")?.amount).toBe("50000.00");
    expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(50_000_000);
  });
});

describe("contribution score", () => {
  const policy = DEFAULT_COMMISSION_POLICY;

  it("stays within [0, 1]", () => {
    const best = contributionScore(
      visit({ id: "v", agentId: "a", endedAt: "2026-01-01T00:00:00Z", durationMinutes: 500, outcome: "NEGOTIATION_STARTED", interestLevel: 5, involvedInNegotiation: true }),
      0,
      1,
      policy,
    );
    const worst = contributionScore(
      visit({ id: "v", agentId: "a", endedAt: "2026-01-01T00:00:00Z", durationMinutes: 0, outcome: "NOT_INTERESTED", customerConfirmed: false, interestLevel: 0, involvedInNegotiation: false }),
      9,
      10,
      policy,
    );
    expect(best).toBeLessThanOrEqual(1);
    expect(best).toBeGreaterThan(0.9);
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThan(0.2);
  });

  it("rewards customer confirmation, the anti-fraud signal", () => {
    const args = { id: "v", agentId: "a", endedAt: "2026-01-01T00:00:00Z" } as const;
    const confirmed = contributionScore(visit({ ...args, customerConfirmed: true }), 0, 2, policy);
    const unconfirmed = contributionScore(visit({ ...args, customerConfirmed: false }), 0, 2, policy);
    expect(confirmed - unconfirmed).toBeCloseTo(policy.scoreWeights.customerConfirmation, 6);
  });

  it("saturates the duration factor rather than rewarding absurdly long visits", () => {
    const args = { id: "v", agentId: "a", endedAt: "2026-01-01T00:00:00Z" } as const;
    const target = contributionScore(visit({ ...args, durationMinutes: 30 }), 0, 1, policy);
    const absurd = contributionScore(visit({ ...args, durationMinutes: 6000 }), 0, 1, policy);
    expect(absurd).toBe(target);
  });
});

describe("multi-currency", () => {
  it("calculates in a non-INR currency", () => {
    const result = calculateCommission({
      ...workedExample(),
      deal: {
        id: "deal-usd",
        referenceCode: "DEAL-USD-1",
        transactionValue: "250000.00",
        commissionPool: "10000.00",
        currency: "USD",
      },
    });
    expect(result.currency).toBe("USD");
    expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(1_000_000);
  });
});

describe("randomised invariant sweep", () => {
  it("never creates or destroys money, across many pool sizes and visit counts", () => {
    const base = workedExample();
    for (let poolRupees = 1; poolRupees <= 2_000_001; poolRupees += 37_037) {
      for (const visitCount of [0, 1, 2, 3, 5, 8]) {
        const visits = Array.from({ length: visitCount }, (_, i) =>
          visit({
            id: `v${i}`,
            agentId: `agent-${i}`,
            endedAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
          }),
        );
        const result = calculateCommission({
          ...base,
          deal: { ...base.deal, commissionPool: `${poolRupees}.00` },
          visits,
        });
        expect(result.distributions.reduce((a, d) => a + d.amountMinor, 0)).toBe(
          fromMajor(`${poolRupees}.00`).amountMinor,
        );
      }
    }
  });
});
