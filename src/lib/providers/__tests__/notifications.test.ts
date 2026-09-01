import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The regression these cover:
 *
 * Resend was configured — API key and from-address both set — and no OTP email
 * was ever sent. The console provider reported `isConfigured() === true`, so
 * whenever EMAIL_PROVIDER was anything other than exactly "resend" (unset,
 * misspelled, or rejected by validation) the registry installed it, the send
 * "succeeded" into a log line, and the person was told a code was on its way.
 *
 * Worse, it also suppressed the fallback: because the app believed it could
 * send, it never let Supabase send instead. One wrong environment variable,
 * two silent failures.
 */
async function load() {
  vi.resetModules();
  return {
    providers: await import("../notifications"),
    authEmail: await import("@/lib/services/auth-email"),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the email provider", () => {
  it("is Resend when asked for, and reaches a real inbox", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_PROVIDER_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "GetMeSpace <no-reply@example.com>");

    const { providers } = await load();
    const email = providers.getNotificationProvider("EMAIL");

    expect(email?.name).toBe("resend");
    expect(email?.isConfigured()).toBe(true);
    expect(email?.deliversExternally).toBe(true);
  });

  it("is not configured when Resend is chosen without credentials", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_PROVIDER_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    const { providers } = await load();
    expect(providers.getNotificationProvider("EMAIL")?.isConfigured()).toBe(false);
  });

  it("falls back to the console provider, which delivers nothing", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "console");

    const { providers } = await load();
    const email = providers.getNotificationProvider("EMAIL");

    // Configured, because it always works. But it reaches nobody, and the two
    // are different questions.
    expect(email?.name).toBe("console");
    expect(email?.isConfigured()).toBe(true);
    expect(email?.deliversExternally).toBe(false);
  });

  it("treats a misspelled provider as unset rather than as Resend", async () => {
    // The exact shape of the reported failure: "Resend" is not "resend".
    vi.stubEnv("EMAIL_PROVIDER", "Resend");
    vi.stubEnv("EMAIL_PROVIDER_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "GetMeSpace <no-reply@example.com>");

    const { providers } = await load();
    expect(providers.getNotificationProvider("EMAIL")?.deliversExternally).toBe(false);
  });
});

describe("canSendAuthCode", () => {
  it("is false in production when only the console provider is available", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("EMAIL_PROVIDER", "console");

    const { authEmail } = await load();
    // False means the flow falls back to letting Supabase send — which is a
    // working outcome. True would mean codes vanish into a log.
    expect(authEmail.canSendAuthCode()).toBe(false);
  });

  it("is true in production with a provider that delivers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_PROVIDER_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "GetMeSpace <no-reply@example.com>");

    const { authEmail } = await load();
    expect(authEmail.canSendAuthCode()).toBe(true);
  });

  it("accepts the console provider outside production, where the point is to print the code", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("EMAIL_PROVIDER", "console");

    const { authEmail } = await load();
    expect(authEmail.canSendAuthCode()).toBe(true);
  });

  it("is false without the service-role key, whatever the email provider is", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_PROVIDER_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "GetMeSpace <no-reply@example.com>");

    const { authEmail } = await load();
    // Codes are minted with the admin API; without it there is nothing to send.
    expect(authEmail.canSendAuthCode()).toBe(false);
  });
});
