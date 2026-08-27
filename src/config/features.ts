/**
 * Feature flags.
 *
 * Two layers, checked in this order:
 *   1. Environment variables — the deployment-level switch, available during
 *      build and in Server Components without a database round trip.
 *   2. The `feature_flags` table — lets an admin toggle a module at runtime.
 *
 * A flag that is OFF in the environment can never be turned ON from the
 * database. That direction matters: `ENABLE_INVESTOR_MODULE` is legally gated
 * (docs/LEGAL_REVIEW.md L1), and an admin UI must not be able to enable a
 * module that the deployment has not been cleared to run.
 */

export const FEATURE_KEYS = [
  "ENABLE_INVESTOR_MODULE",
  "ENABLE_AI_SEARCH",
  "ENABLE_AI_LISTING_ASSISTANT",
  "ENABLE_VIRTUAL_TOURS",
  "ENABLE_WHATSAPP",
  "ENABLE_SMS",
  "ENABLE_PUSH",
  "ENABLE_DOCUMENT_AI",
  "ENABLE_PROPERTY_VALUATION",
  "ENABLE_NRI_MODE",
  "ENABLE_MARKETING_KIT",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

/**
 * Compile-time flag values. `process.env.X` is referenced literally (not via a
 * computed key) so that Next.js can statically inline the public ones.
 */
export const features: Record<FeatureKey, boolean> = {
  // Defaults to false. Do not change this default without a legal sign-off.
  ENABLE_INVESTOR_MODULE: envFlag(process.env.ENABLE_INVESTOR_MODULE, false),
  ENABLE_AI_SEARCH: envFlag(process.env.ENABLE_AI_SEARCH, true),
  ENABLE_AI_LISTING_ASSISTANT: envFlag(process.env.ENABLE_AI_LISTING_ASSISTANT, true),
  ENABLE_VIRTUAL_TOURS: envFlag(process.env.ENABLE_VIRTUAL_TOURS, true),
  ENABLE_WHATSAPP: envFlag(process.env.ENABLE_WHATSAPP, false),
  ENABLE_SMS: envFlag(process.env.ENABLE_SMS, false),
  ENABLE_PUSH: envFlag(process.env.ENABLE_PUSH, false),
  ENABLE_DOCUMENT_AI: envFlag(process.env.ENABLE_DOCUMENT_AI, false),
  ENABLE_PROPERTY_VALUATION: envFlag(process.env.ENABLE_PROPERTY_VALUATION, false),
  ENABLE_NRI_MODE: envFlag(process.env.ENABLE_NRI_MODE, false),
  ENABLE_MARKETING_KIT: envFlag(process.env.ENABLE_MARKETING_KIT, true),
};

export function isFeatureEnabled(key: FeatureKey): boolean {
  return features[key];
}

/**
 * Combines the environment flag with a database override. The environment acts
 * as a ceiling: the database can only ever narrow, never widen.
 */
export function resolveFeature(key: FeatureKey, databaseValue: boolean | undefined): boolean {
  if (!features[key]) return false;
  return databaseValue ?? true;
}
