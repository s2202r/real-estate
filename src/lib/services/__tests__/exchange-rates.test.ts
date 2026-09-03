import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The refresh has one job beyond fetching: REFUSING.
 *
 * A stale rate is visibly stale — the label carries its date — but a wrong one
 * looks exactly like a right one and misprices every property on the site. So
 * these cover what happens when a provider hands back something wrong, which
 * is the case that actually costs something.
 */

const upserts: Record<string, unknown>[] = [];
let storedRows: { quote_currency: string; rate: string; as_of: string }[] = [];
let upsertError: { message: string } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  isAdminClientAvailable: () => true,
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: async () => ({ data: storedRows }) }),
      upsert: async (row: Record<string, unknown>) => {
        if (upsertError) return { error: upsertError };
        upserts.push(row);
        return { error: null };
      },
    }),
  }),
}));

vi.mock("@/lib/services/audit", () => ({ recordAudit: async () => undefined }));

const { setRateProviderForTests } = await import("@/lib/providers/fx");
const { refreshExchangeRates, QUOTE_CURRENCIES } = await import("../exchange-rates");

function providerReturning(
  rates: { quote: string; rate: number; asOf: string }[],
  error?: string,
) {
  return {
    name: "stub",
    isConfigured: () => true,
    fetchRates: async () => ({ rates, provider: "stub", ...(error ? { error } : {}) }),
  };
}

const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  upserts.length = 0;
  storedRows = [];
  upsertError = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setRateProviderForTests(null);
  vi.restoreAllMocks();
});

describe("refreshExchangeRates", () => {
  it("stores a plausible rate", async () => {
    setRateProviderForTests(
      providerReturning([{ quote: "USD", rate: 0.012, asOf: TODAY }]) as never,
    );

    const outcome = await refreshExchangeRates({ trigger: "cron" });

    expect(outcome.updated).toEqual(["USD"]);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ quote_currency: "USD", as_of: TODAY });
  });

  it("keeps the provider's date rather than stamping today", async () => {
    // The ECB publishes on business days; on a Sunday the rate is Friday's and
    // the label has to say so.
    setRateProviderForTests(
      providerReturning([{ quote: "USD", rate: 0.012, asOf: "2026-08-28" }]) as never,
    );

    await refreshExchangeRates({ trigger: "cron" });
    expect(upserts[0]).toMatchObject({ as_of: "2026-08-28" });
  });

  it("refuses an inverted pair and leaves the stored rate alone", async () => {
    storedRows = [{ quote_currency: "USD", rate: "0.012", as_of: "2026-08-01" }];
    setRateProviderForTests(
      providerReturning([{ quote: "USD", rate: 83.15, asOf: TODAY }]) as never,
    );

    const outcome = await refreshExchangeRates({ trigger: "cron" });

    expect(outcome.updated).toEqual([]);
    expect(outcome.rejected[0]?.pair).toBe("INR->USD");
    // Nothing written: the old rate survives, which is the point.
    expect(upserts).toHaveLength(0);
  });

  it("refuses an implausible first rate, with nothing to compare against", async () => {
    setRateProviderForTests(
      providerReturning([{ quote: "USD", rate: 83.15, asOf: TODAY }]) as never,
    );

    const outcome = await refreshExchangeRates({ trigger: "cron" });
    expect(outcome.rejected[0]?.reason).toMatch(/plausible range/);
    expect(upserts).toHaveLength(0);
  });

  it("updates the good pairs even when one is refused", async () => {
    storedRows = [{ quote_currency: "USD", rate: "0.012", as_of: "2026-08-01" }];
    setRateProviderForTests(
      providerReturning([
        { quote: "USD", rate: 83.15, asOf: TODAY }, // inverted
        { quote: "AED", rate: 0.044, asOf: TODAY }, // fine
      ]) as never,
    );

    const outcome = await refreshExchangeRates({ trigger: "cron" });

    expect(outcome.updated).toEqual(["AED"]);
    expect(outcome.rejected).toHaveLength(1);
  });

  it("reports pairs the provider did not return", async () => {
    setRateProviderForTests(
      providerReturning([{ quote: "USD", rate: 0.012, asOf: TODAY }]) as never,
    );

    const outcome = await refreshExchangeRates({ trigger: "cron" });
    expect(outcome.missing).toEqual(QUOTE_CURRENCIES.filter((q) => q !== "USD"));
  });

  it("writes nothing when the rate is already current", async () => {
    storedRows = [{ quote_currency: "USD", rate: "0.012", as_of: TODAY }];
    setRateProviderForTests(
      providerReturning([{ quote: "USD", rate: 0.012, asOf: TODAY }]) as never,
    );

    const outcome = await refreshExchangeRates({ trigger: "cron" });
    expect(outcome.updated).toEqual([]);
    expect(upserts).toHaveLength(0);
  });

  it("surfaces a provider outage rather than reporting an empty success", async () => {
    setRateProviderForTests(providerReturning([], "Provider responded 503") as never);

    const outcome = await refreshExchangeRates({ trigger: "cron" });
    expect(outcome.error).toMatch(/503/);
    expect(outcome.updated).toEqual([]);
  });

  it("reports a write failure as a refusal rather than as success", async () => {
    upsertError = { message: "permission denied" };
    setRateProviderForTests(
      providerReturning([{ quote: "USD", rate: 0.012, asOf: TODAY }]) as never,
    );

    const outcome = await refreshExchangeRates({ trigger: "cron" });
    expect(outcome.updated).toEqual([]);
    expect(outcome.rejected[0]?.reason).toMatch(/permission denied/);
  });

  it("does nothing when no provider is configured", async () => {
    setRateProviderForTests({
      name: "none",
      isConfigured: () => false,
      fetchRates: async () => ({ rates: [], provider: "none" }),
    } as never);

    const outcome = await refreshExchangeRates({ trigger: "cron" });
    expect(outcome.error).toMatch(/FX_PROVIDER/);
    expect(upserts).toHaveLength(0);
  });
});
