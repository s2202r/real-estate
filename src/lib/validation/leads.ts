import { z } from "zod";
import { CityField } from "./geo";
import { checkVisitSlot } from "@/lib/domain/visits";
import { appConfig, platformLimits } from "@/config/app";

/**
 * Lead, enquiry and visit input schemas.
 *
 * These are the schemas the SERVER validates with. The same objects drive
 * client-side form feedback, but the server never trusts that the client ran
 * them — validation happens again in the action, every time.
 */

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.");

export const EnquirySchema = z.object({
  listingId: z.string().uuid(),
  message: z
    .string()
    .trim()
    .max(1000, "Keep the message under 1000 characters.")
    .optional(),
  requestCallback: z.boolean().default(false),
  source: z
    .enum([
      "ORGANIC_WEBSITE",
      "CUSTOMER_SEARCH",
      "DIRECT_ENQUIRY",
      "AGENT_INVENTORY_SHARE",
      "SOCIAL_MEDIA",
      "REQUIREMENT_MATCH",
    ])
    .default("CUSTOMER_SEARCH"),
});

export type EnquiryInput = z.infer<typeof EnquirySchema>;

export const VisitRequestSchema = z
  .object({
    listingId: z.string().uuid(),
    visitType: z.enum(["PHYSICAL", "VIRTUAL", "LIVE_VIDEO"]).default("PHYSICAL"),
    requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
    requestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time."),
    notes: z.string().trim().max(500).optional(),
    preferredAgentId: z.string().uuid().optional(),
  })
  // Date and time are checked TOGETHER: the rule is about an instant, not a
  // calendar day. Checking the date alone would accept 9am today at 8:55am.
  .superRefine((value, ctx) => {
    const check = checkVisitSlot(
      value.requestedDate,
      value.requestedTime,
      new Date(),
      platformLimits.visitMinLeadTimeHours,
      appConfig.timezone,
    );
    if (check.ok) return;

    // Reported on both inputs, because either one can be the thing to change.
    for (const path of ["requestedDate", "requestedTime"] as const) {
      ctx.addIssue({ code: "custom", message: check.reason ?? "Choose a later slot.", path: [path] });
    }
  });

export type VisitRequestInput = z.infer<typeof VisitRequestSchema>;

export const RequirementSchema = z
  .object({
    title: z.string().trim().min(5).max(160).optional(),
    listingType: z.enum(["SALE", "RENT", "LEASE"]),
    propertyTypes: z.array(z.string()).min(1, "Choose at least one property type.").max(8),
    city: CityField,
    localities: z.array(z.string().trim().max(80)).max(10).default([]),
    budgetMin: z.coerce.number().nonnegative().optional(),
    budgetMax: z.coerce.number().positive("Enter a maximum budget."),
    minArea: z.coerce.number().positive().optional(),
    bedroomsMin: z.coerce.number().int().min(0).max(20).optional(),
    bedroomsMax: z.coerce.number().int().min(0).max(20).optional(),
    requiredBy: z.string().optional(),
    preferences: z.string().trim().max(1000).optional(),
    amenities: z.array(z.string()).max(20).default([]),
    isDiscoverable: z.boolean().default(true),
  })
  .refine(
    (value) => value.budgetMin === undefined || value.budgetMax >= value.budgetMin,
    { message: "The maximum budget must be at least the minimum.", path: ["budgetMax"] },
  )
  .refine(
    (value) =>
      value.bedroomsMin === undefined ||
      value.bedroomsMax === undefined ||
      value.bedroomsMax >= value.bedroomsMin,
    { message: "The bedroom range is inverted.", path: ["bedroomsMax"] },
  );

export type RequirementInput = z.infer<typeof RequirementSchema>;
