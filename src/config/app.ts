/**
 * Application-level branding and defaults.
 *
 * The product name is deliberately NOT hard-coded across the codebase. Import
 * `appConfig.name` (or `APP_NAME`) instead of typing the name into components,
 * so a deployment can be rebranded from environment configuration alone.
 */

import { clientEnv } from "./env";

export const APP_NAME = clientEnv.NEXT_PUBLIC_APP_NAME || "GetMeSpace";

export const appConfig = {
  name: APP_NAME,
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE || "The verified real-estate inventory network",
  description:
    `${APP_NAME} is a verified property inventory network where customers, agents and ` +
    `investors collaborate through shared property passports, transparent site visits ` +
    `and an auditable commission engine.`,
  // Through the validated value, never the raw variable: this string is fed to
  // `new URL()` for metadataBase and to every canonical link, and a hostname
  // pasted without its scheme would throw there — on every page that declares
  // a canonical URL, which is most of them.
  url: clientEnv.NEXT_PUBLIC_APP_URL || "https://getmespace.in",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@getmespace.in",

  /** The company that operates the product. Shown in the footer. */
  legalEntity: process.env.NEXT_PUBLIC_LEGAL_ENTITY || "BUILTFORBUSINESS LLP",

  locale: process.env.DEFAULT_LOCALE || "en-IN",
  currency: process.env.DEFAULT_CURRENCY || "INR",
  country: process.env.DEFAULT_COUNTRY || "IN",
  timezone: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",

  /** Pagination default used across search and dashboards. */
  pageSize: 12,
} as const;

/**
 * Particulars the legal pages have to state.
 *
 * These are NOT hard-coded into the prose, for two reasons. A registered
 * address or a grievance officer's name invented by whoever wrote the page is
 * worse than no address at all — it is a false statement in a document people
 * are asked to rely on. And Indian law requires several of them to be
 * published and kept current (the IT Rules require a named grievance officer
 * with contact details; the DPDP Act requires a route for data-principal
 * requests), so they must be changeable without a code edit.
 *
 * Anything unset renders as a visible gap rather than as a plausible-looking
 * placeholder, and `missingLegalParticulars()` reports it through the health
 * endpoint so the gap is findable before a regulator finds it.
 */
export const legalEntityDetails = {
  name: appConfig.legalEntity,
  /** LLPIN / CIN as issued by the MCA. */
  registrationNumber: process.env.NEXT_PUBLIC_LEGAL_REGISTRATION_NUMBER || "",
  gstin: process.env.NEXT_PUBLIC_LEGAL_GSTIN || "",
  registeredAddress: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "",
  /** Required by the IT (Intermediary Guidelines) Rules, 2021. */
  grievanceOfficerName: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || "",
  grievanceEmail: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || appConfig.supportEmail,
  /** Where data-principal requests under the DPDP Act, 2023 are received. */
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || appConfig.supportEmail,
  governingLaw: process.env.NEXT_PUBLIC_GOVERNING_LAW || "India",
  /** Courts of which city have jurisdiction. */
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION || "",
} as const;

/**
 * Which required particulars are still unpublished. Names only — every value
 * here is public by design, but the list is what makes the gap actionable.
 */
export function missingLegalParticulars(): string[] {
  const required: [string, string][] = [
    ["NEXT_PUBLIC_LEGAL_REGISTRATION_NUMBER", legalEntityDetails.registrationNumber],
    ["NEXT_PUBLIC_LEGAL_ADDRESS", legalEntityDetails.registeredAddress],
    ["NEXT_PUBLIC_GRIEVANCE_OFFICER", legalEntityDetails.grievanceOfficerName],
    ["NEXT_PUBLIC_LEGAL_JURISDICTION", legalEntityDetails.jurisdiction],
  ];
  return required.filter(([, value]) => !value).map(([name]) => name);
}

/**
 * Operational limits. These have environment overrides because they are tuned
 * per market, but they always have a safe default so the app boots without a
 * fully populated environment.
 */
export const platformLimits = {
  contactRevealDailyLimit: Number(process.env.CONTACT_REVEAL_DAILY_LIMIT ?? 25),
  /** Minimum notice before a site visit, so an agent can confirm and travel. */
  visitMinLeadTimeHours: Number(process.env.VISIT_MIN_LEAD_TIME_HOURS ?? 12),
  visitGeofenceRadiusMeters: Number(process.env.VISIT_GEOFENCE_RADIUS_METERS ?? 200),
  visitMinDurationMinutes: Number(process.env.VISIT_MIN_DURATION_MINUTES ?? 10),
  rateLimitWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 60),
} as const;

/** Cities the platform is live in. India first; the shape supports expansion. */
export const supportedCities = [
  { name: "Noida", state: "Uttar Pradesh", region: "NCR", slug: "noida" },
  { name: "Greater Noida", state: "Uttar Pradesh", region: "NCR", slug: "greater-noida" },
  { name: "Ghaziabad", state: "Uttar Pradesh", region: "NCR", slug: "ghaziabad" },
  { name: "Gurgaon", state: "Haryana", region: "NCR", slug: "gurgaon" },
  { name: "Delhi", state: "Delhi", region: "NCR", slug: "delhi" },
  { name: "Lucknow", state: "Uttar Pradesh", region: "LKO", slug: "lucknow" },
  { name: "Bengaluru", state: "Karnataka", region: "BLR", slug: "bengaluru" },
  { name: "Mumbai", state: "Maharashtra", region: "MUM", slug: "mumbai" },
  { name: "Pune", state: "Maharashtra", region: "PNQ", slug: "pune" },
  { name: "Hyderabad", state: "Telangana", region: "HYD", slug: "hyderabad" },
] as const;

export type SupportedCity = (typeof supportedCities)[number];
