import { z } from "zod";
import { CityField } from "./geo";

/**
 * What a person may change about themselves.
 *
 * The shape of this schema is the security boundary as much as the RLS policy
 * is: a field absent from here cannot be written by the form that uses it. So
 * the omissions are deliberate and worth naming.
 *
 * NOT HERE, for customers: email (it is the account identifier and changing it
 * needs a fresh verification round), and every `*_verified_at` column.
 *
 * NOT HERE, for agents: badges, verification level, trust score, ratings,
 * response and conversion rates, complaint and deal counts, risk score and
 * account status. Those are the platform's judgement of an agent, not an
 * agent's description of themselves (§10, §13). A BEFORE UPDATE trigger in the
 * database reverts them too, so this is the second of two locks rather than
 * the only one.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const CustomerProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(120),
  displayName: optionalText(60),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  city: CityField.optional().or(z.literal("").transform(() => undefined)),
});

export type CustomerProfileInput = z.infer<typeof CustomerProfileSchema>;

/** The languages the directory filters on, so free text would not be findable. */
export const AGENT_LANGUAGES = [
  "English", "Hindi", "Marathi", "Gujarati", "Bengali", "Tamil", "Telugu",
  "Kannada", "Malayalam", "Punjabi", "Odia", "Assamese", "Urdu",
] as const;

export const AgentProfileSchema = z.object({
  agencyName: optionalText(120),
  headline: optionalText(160),
  bio: optionalText(2000),
  experienceYears: z.coerce.number().int().min(0).max(70),
  // Capped because these are stored as arrays and rendered on a public page;
  // an agent claiming forty cities is not serving forty cities.
  languages: z.array(z.enum(AGENT_LANGUAGES)).min(1, "Choose at least one language.").max(10),
  serviceCities: z
    .array(CityField)
    .min(1, "Add at least one city you work in.")
    .max(12, "Twelve cities is the limit — list where you actually operate."),
  acceptsVisitRequests: z.boolean().default(true),
  maxVisitDistanceKm: z.coerce
    .number()
    .positive("Enter a distance greater than zero.")
    .max(200, "200 km is the limit for a visit radius."),
});

export type AgentProfileInput = z.infer<typeof AgentProfileSchema>;
