"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer, requireUserOrThrow } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/services/audit";
import { isKnownTimeZone } from "@/lib/domain/timezones";
import { appConfig } from "@/config/app";
import type { ActionResult } from "./leads";
import { serviceUnavailable } from "./guards";

/**
 * Buying-from-abroad preferences.
 *
 * All three are DISPLAY preferences and nothing more. The currency does not
 * change what anything costs — every transaction on this platform is in rupees
 * — and the timezone does not change when a visit happens, only the clock it is
 * shown on. Saying so in the UI matters as much as storing it correctly.
 */
const NriPreferencesSchema = z.object({
  isNri: z.boolean(),
  // Validated against the formatter that will render the dates, not against a
  // list. See lib/domain/timezones.ts for why an abbreviation is refused.
  timeZone: z
    .string()
    .trim()
    .refine(isKnownTimeZone, "Choose a timezone from the list."),
  displayCurrency: z.enum(["INR", "USD", "AED", "GBP", "EUR", "SGD"]),
});

export async function saveNriPreferences(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let customer;
  try {
    customer = await requireCustomer();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const parsed = NriPreferencesSchema.safeParse({
    isNri: formData.get("isNri") === "on",
    timeZone: formData.get("timeZone") || appConfig.timezone,
    displayCurrency: formData.get("displayCurrency") || "INR",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      is_nri: parsed.data.isNri,
      preferred_timezone: parsed.data.timeZone,
      display_currency: parsed.data.displayCurrency,
    })
    .eq("id", customer.customerId);

  if (error) return { ok: false, message: `Could not save your preferences: ${error.message}` };

  // Prices and visit times change across the whole site, not just this page.
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: parsed.data.isNri
      ? "Saved. Prices now show a second currency and visit times appear on your clock too."
      : "Saved. Everything is shown in rupees, on India time.",
  };
}

/* ------------------------------------------------------------------------ *
 * Exchange rates (admin)
 * ------------------------------------------------------------------------ */

const ExchangeRateSchema = z
  .object({
    quoteCurrency: z.enum(["USD", "AED", "GBP", "EUR", "SGD"]),
    // A string, then parsed: a number input arrives as text and `0.0120` must
    // survive without a float round-trip through the form.
    rate: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,8})?$/, "Enter a rate such as 0.0120.")
      .refine((value) => Number(value) > 0, "The rate must be greater than zero."),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Give the date this rate is for."),
    source: z.string().trim().max(120).optional(),
  })
  .refine((value) => Date.parse(value.asOf) <= Date.now() + 86_400_000, {
    message: "A rate cannot be dated in the future.",
    path: ["asOf"],
  });

/**
 * Publish an indicative rate for one currency pair.
 *
 * Rates are stored INR → quote, one row per pair, replaced rather than
 * appended: there is one current rate for a pair, and a history of superseded
 * display rates is not worth a table. The audit log records each change, which
 * is where the history lives.
 *
 * The date is entered by hand rather than defaulted to today, because the rate
 * being copied in is the rate FOR a particular day and pretending otherwise is
 * how a figure ends up looking fresher than it is.
 */
export async function saveExchangeRate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireUserOrThrow();
    assertCan(user, "commission.configure");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const parsed = ExchangeRateSchema.safeParse({
    quoteCurrency: formData.get("quoteCurrency"),
    rate: formData.get("rate"),
    asOf: formData.get("asOf"),
    source: formData.get("source") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the rate.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("exchange_rates")
    .select("rate, as_of")
    .eq("base_currency", appConfig.currency)
    .eq("quote_currency", parsed.data.quoteCurrency)
    .maybeSingle();

  const { error } = await supabase.from("exchange_rates").upsert(
    {
      base_currency: appConfig.currency,
      quote_currency: parsed.data.quoteCurrency,
      rate: parsed.data.rate,
      as_of: parsed.data.asOf,
      source: parsed.data.source ?? null,
      updated_by: user.id,
    },
    { onConflict: "base_currency,quote_currency" },
  );

  if (error) return { ok: false, message: `Could not save the rate: ${error.message}` };

  await recordAudit({
    action: "admin.setting_changed",
    entityType: "EXCHANGE_RATE",
    entityCode: `${appConfig.currency}->${parsed.data.quoteCurrency}`,
    actorId: user.id,
    actorRole: "admin",
    before: before ? { rate: before.rate, asOf: before.as_of } : null,
    after: { rate: parsed.data.rate, asOf: parsed.data.asOf },
    reason: parsed.data.source ?? "Indicative display rate updated.",
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `1 ${appConfig.currency} = ${parsed.data.rate} ${parsed.data.quoteCurrency}, as of ${parsed.data.asOf}.`,
  };
}

/** Remove a pair, so the second currency stops being offered for it. */
export async function deleteExchangeRate(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const unavailable = serviceUnavailable();
  if (unavailable) return unavailable;

  let user;
  try {
    user = await requireUserOrThrow();
    assertCan(user, "commission.configure");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Not authorised." };
  }

  const quote = String(formData.get("quoteCurrency") ?? "");
  if (!/^[A-Z]{3}$/.test(quote)) return { ok: false, message: "No currency given." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("exchange_rates")
    .delete()
    .eq("base_currency", appConfig.currency)
    .eq("quote_currency", quote);

  if (error) return { ok: false, message: `Could not remove the rate: ${error.message}` };

  await recordAudit({
    action: "admin.setting_changed",
    entityType: "EXCHANGE_RATE",
    entityCode: `${appConfig.currency}->${quote}`,
    actorId: user.id,
    actorRole: "admin",
    after: { removed: true },
    reason: "Indicative display rate removed.",
  });

  revalidatePath("/", "layout");
  return { ok: true, message: `Prices will no longer be shown in ${quote}.` };
}
