import { z } from "zod";
import { withApi } from "@/lib/api/handler";
import { getAiProvider } from "@/lib/providers/ai";
import { features } from "@/config/features";
import { ApiError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/listings/draft
 *
 * Drafts listing copy for an agent to review. The response always carries
 * `requiresApproval: true` — nothing here publishes anything, and the agent
 * remains the author of record (§31).
 */
const BodySchema = z.object({
  propertyType: z.string().min(2).max(40),
  bedrooms: z.number().int().min(0).max(30).nullable().optional(),
  bathrooms: z.number().int().min(0).max(30).nullable().optional(),
  area: z.number().positive().max(1_000_000).nullable().optional(),
  locality: z.string().min(1).max(80),
  city: z.string().min(1).max(80),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  listingType: z.enum(["SALE", "RENT", "LEASE"]),
  furnishing: z.string().max(40).nullable().optional(),
  amenities: z.array(z.string().max(60)).max(40).optional(),
});

export const POST = withApi(
  {
    auth: true,
    bodySchema: BodySchema,
    rateLimit: { scope: "api:listing-draft", limit: 30, windowSeconds: 300 },
  },
  async ({ body, user }) => {
    if (!features.ENABLE_AI_LISTING_ASSISTANT) {
      throw new ApiError(403, "feature_disabled", "The listing assistant is disabled.");
    }
    if (!user?.agentId) {
      throw new ApiError(403, "forbidden", "Only agents can draft listings.");
    }

    const draft = await getAiProvider().draftListing({
      propertyType: body.propertyType,
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      area: body.area ?? null,
      locality: body.locality,
      city: body.city,
      price: body.price,
      listingType: body.listingType,
      furnishing: body.furnishing ?? null,
      amenities: body.amenities ?? [],
    });

    return { data: draft };
  },
);
