/**
 * Feature flags.
 *
 * Two layers, checked in this order:
 *   1. Environment variables — the deployment-level switch, available during
 *      build and in Server Components without a database round trip.
 *   2. The `feature_flags` table — lets an admin toggle a module at runtime.
 *
 * A flag that is OFF in the environment can never be turned ON from the
 * database. That direction matters: an admin UI must not be able to enable a
 * module the deployment has not been cleared to run.
 *
 * NOT EVERY FLAG HAS SOMETHING BEHIND IT. Some were declared ahead of the work
 * they name, and `FEATURE_STATUS` below records which. That distinction is not
 * pedantry: the admin console was reporting modules as "Blocked by
 * environment", which reads as a working feature withheld by configuration,
 * when there was no implementation to withhold. A toggle that goes green and
 * changes nothing is worse than one honestly greyed out.
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
  /*
   * ON at the operator's instruction.
   *
   * It shipped false because of docs/LEGAL_REVIEW.md L1: a structure where
   * capital is placed against a property and an exit spread is captured can be
   * characterised as an unregistered collective investment scheme. That item
   * is still open — enabling the module does not close it.
   *
   * What does NOT depend on this flag: no exclusive-inventory agreement can
   * reach ACTIVE without a recorded human legal review. That is the CHECK
   * constraint `agreements_active_requires_legal_review`, enforced by the
   * database, and it holds whatever this flag says.
   *
   * Set ENABLE_INVESTOR_MODULE=false to turn the module off again.
   */
  ENABLE_INVESTOR_MODULE: envFlag(process.env.ENABLE_INVESTOR_MODULE, true),
  ENABLE_AI_SEARCH: envFlag(process.env.ENABLE_AI_SEARCH, true),
  ENABLE_AI_LISTING_ASSISTANT: envFlag(process.env.ENABLE_AI_LISTING_ASSISTANT, true),
  ENABLE_VIRTUAL_TOURS: envFlag(process.env.ENABLE_VIRTUAL_TOURS, true),
  ENABLE_WHATSAPP: envFlag(process.env.ENABLE_WHATSAPP, false),
  ENABLE_SMS: envFlag(process.env.ENABLE_SMS, false),
  ENABLE_PUSH: envFlag(process.env.ENABLE_PUSH, false),
  ENABLE_DOCUMENT_AI: envFlag(process.env.ENABLE_DOCUMENT_AI, false),
  // Both ON at the operator's instruction, and both now have code behind
  // them. Valuation surfaces an indicative RANGE from verified comparables and
  // never a figure; NRI mode is display-only — a second currency, visit times
  // on the buyer's clock, and the guidance page.
  ENABLE_PROPERTY_VALUATION: envFlag(process.env.ENABLE_PROPERTY_VALUATION, true),
  ENABLE_NRI_MODE: envFlag(process.env.ENABLE_NRI_MODE, true),
  ENABLE_MARKETING_KIT: envFlag(process.env.ENABLE_MARKETING_KIT, true),
};

/**
 * Whether a flag actually gates anything.
 *
 *  - `live`      the flag is read by code, and turning it off removes a feature.
 *  - `always-on` the feature exists but does not consult the flag. Virtual
 *                tours are built — the gallery, the embed allowlist, the search
 *                filter — and are simply always available.
 *  - `unbuilt`   nothing is implemented. The flag names an intention.
 *
 * Kept beside the flags rather than in the admin page, so the two cannot
 * disagree, and checked by a test that greps the source: a flag that gains its
 * first caller should stop claiming to be unbuilt.
 */
export type FeatureStatus = "live" | "always-on" | "unbuilt";

export const FEATURE_STATUS: Record<FeatureKey, FeatureStatus> = {
  ENABLE_INVESTOR_MODULE: "live",
  ENABLE_AI_SEARCH: "live",
  ENABLE_AI_LISTING_ASSISTANT: "live",
  ENABLE_WHATSAPP: "live",
  ENABLE_SMS: "live",
  ENABLE_PUSH: "live",
  ENABLE_VIRTUAL_TOURS: "always-on",
  ENABLE_PROPERTY_VALUATION: "live",
  ENABLE_NRI_MODE: "live",
  ENABLE_DOCUMENT_AI: "unbuilt",
  ENABLE_MARKETING_KIT: "unbuilt",
};

export function featureStatus(key: string): FeatureStatus | null {
  return (FEATURE_STATUS as Record<string, FeatureStatus>)[key] ?? null;
}

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
