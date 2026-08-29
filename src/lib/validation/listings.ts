import { z } from "zod";
import { instagramCode, youTubeId } from "@/lib/domain/social";

/**
 * Listing creation and moderation schemas.
 *
 * Note what agents may NOT submit: verification score, review notes, exclusive
 * flags or any moderation field. Those are admin-owned, enforced by a database
 * trigger as well as by this schema's shape.
 */

const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount such as 8500000 or 8500000.00");

export const ListingDraftSchema = z
  .object({
    // Property passport — either an existing one, or the facts to create one.
    propertyId: z.string().uuid().optional(),

    title: z.string().trim().min(10, "Give the listing a descriptive title.").max(160),
    description: z.string().trim().max(5000).optional(),

    listingType: z.enum(["SALE", "RENT", "LEASE"]),
    propertyType: z.enum([
      "APARTMENT", "INDEPENDENT_HOUSE", "VILLA", "BUILDER_FLOOR", "PENTHOUSE", "STUDIO",
      "PLOT", "FARMHOUSE", "OFFICE", "SHOP", "SHOWROOM", "WAREHOUSE", "INDUSTRIAL",
      "CO_WORKING", "SERVICED_APARTMENT", "OTHER",
    ]),
    category: z.enum(["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "LAND"]).default("RESIDENTIAL"),

    price: money,
    isNegotiable: z.boolean().default(true),
    maintenanceCharge: money.optional(),
    securityDeposit: money.optional(),
    brokerageType: z.enum(["PERCENT", "FIXED", "NONE"]).default("PERCENT"),
    brokerageValue: z.coerce.number().min(0).max(100).default(1.5),

    bedrooms: z.coerce.number().int().min(0).max(30).optional(),
    bathrooms: z.coerce.number().int().min(0).max(30).optional(),
    balconies: z.coerce.number().int().min(0).max(30).optional(),
    builtUpArea: z.coerce.number().positive("Enter the built-up area.").max(1_000_000),
    carpetArea: z.coerce.number().positive().max(1_000_000).optional(),
    floor: z.coerce.number().int().min(-5).max(200).optional(),
    totalFloors: z.coerce.number().int().min(0).max(200).optional(),
    facing: z
      .enum(["NORTH", "SOUTH", "EAST", "WEST", "NORTH_EAST", "NORTH_WEST", "SOUTH_EAST", "SOUTH_WEST"])
      .optional(),
    furnishing: z.enum(["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"]).default("UNFURNISHED"),
    ageYears: z.coerce.number().int().min(0).max(200).optional(),
    possessionStatus: z
      .enum(["READY_TO_MOVE", "UNDER_CONSTRUCTION", "NEW_LAUNCH", "RESALE"])
      .default("READY_TO_MOVE"),
    availableFrom: z.string().optional(),

    coveredParking: z.coerce.number().int().min(0).max(20).default(0),
    openParking: z.coerce.number().int().min(0).max(20).default(0),

    city: z.string().trim().min(2).max(80),
    locality: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter a 6-digit PIN code.")
      .optional()
      .or(z.literal("")),
    addressLine1: z.string().trim().max(200).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),

    coverImageUrl: z.string().url().optional().or(z.literal("")),
    // Accepts a full video or a Short — both are YouTube URLs, and the gallery
    // reads the URL to decide how to frame it.
    youtubeUrl: z
      .string()
      .url()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || youTubeId(value) !== null, {
        message: "That is not a YouTube video or Short link.",
      }),
    instagramReelUrl: z
      .string()
      .url()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || instagramCode(value) !== null, {
        message: "Paste the link to a Reel, not a profile.",
      }),
    virtualTourUrl: z.string().url().optional().or(z.literal("")),

    tower: z.string().trim().max(50).optional(),
    unitNumber: z.string().trim().max(30).optional(),
    reraNumber: z.string().trim().max(60).optional(),

    amenities: z.array(z.string()).max(40).default([]),
    highlights: z.array(z.string().max(120)).max(8).default([]),

    isShareable: z.boolean().default(true),
    submit: z.boolean().default(false),
  })
  .refine(
    (value) =>
      value.carpetArea === undefined || value.carpetArea <= value.builtUpArea,
    { message: "Carpet area cannot exceed built-up area.", path: ["carpetArea"] },
  )
  .refine(
    (value) => value.totalFloors === undefined || value.floor === undefined || value.floor <= value.totalFloors,
    { message: "Floor cannot be above the total number of floors.", path: ["floor"] },
  )
  .refine(
    (value) => value.listingType !== "SALE" || value.securityDeposit === undefined,
    { message: "A security deposit applies to rentals only.", path: ["securityDeposit"] },
  );

export type ListingDraftInput = z.infer<typeof ListingDraftSchema>;

export const ModerationSchema = z.object({
  listingId: z.string().uuid(),
  decision: z.enum(["APPROVE", "REJECT", "SUSPEND"]),
  notes: z.string().trim().max(1000).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
  verificationScore: z.coerce.number().min(0).max(100).optional(),
}).refine(
  (value) => value.decision !== "REJECT" || Boolean(value.rejectionReason),
  { message: "Tell the agent why it was rejected so they can fix it.", path: ["rejectionReason"] },
);

export type ModerationInput = z.infer<typeof ModerationSchema>;

export const ShareRequestSchema = z.object({
  listingId: z.string().uuid(),
  message: z.string().trim().max(500).optional(),
});

export const ShareResponseSchema = z.object({
  shareId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  message: z.string().trim().max(500).optional(),
  agreedSharePercent: z.coerce.number().min(0).max(100).optional(),
});
