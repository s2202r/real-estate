/**
 * Application-level branding and defaults.
 *
 * The product name is deliberately NOT hard-coded across the codebase. Import
 * `appConfig.name` (or `APP_NAME`) instead of typing the name into components,
 * so a deployment can be rebranded from environment configuration alone.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "GetMeSpace";

export const appConfig = {
  name: APP_NAME,
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE || "The verified real-estate inventory network",
  description:
    `${APP_NAME} is a verified property inventory network where customers, agents and ` +
    `investors collaborate through shared property passports, transparent site visits ` +
    `and an auditable commission engine.`,
  url: process.env.NEXT_PUBLIC_APP_URL || "https://getmespace.in",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@getmespace.in",

  locale: process.env.DEFAULT_LOCALE || "en-IN",
  currency: process.env.DEFAULT_CURRENCY || "INR",
  country: process.env.DEFAULT_COUNTRY || "IN",
  timezone: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",

  /** Pagination default used across search and dashboards. */
  pageSize: 12,
} as const;

/**
 * Operational limits. These have environment overrides because they are tuned
 * per market, but they always have a safe default so the app boots without a
 * fully populated environment.
 */
export const platformLimits = {
  contactRevealDailyLimit: Number(process.env.CONTACT_REVEAL_DAILY_LIMIT ?? 25),
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
