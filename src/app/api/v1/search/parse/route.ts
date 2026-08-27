import { z } from "zod";
import { withApi } from "@/lib/api/handler";
import { getAiProvider } from "@/lib/providers/ai";
import { features } from "@/config/features";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/search/parse
 *
 * Turns a natural-language query into structured filters, and returns the
 * INTERPRETATION alongside them so the UI can show "here's what I understood"
 * before running the search (§35). The customer gets to correct a misreading
 * instead of silently receiving the wrong results.
 */
const BodySchema = z.object({
  query: z.string().trim().min(2).max(300),
});

interface ParseResult {
  interpretation: string | null;
  confidence: number;
  filters: Record<string, string>;
  note?: string;
}

export const POST = withApi<z.infer<typeof BodySchema>, unknown, ParseResult>(
  {
    bodySchema: BodySchema,
    rateLimit: { scope: "api:search-parse", limit: 30, windowSeconds: 60 },
  },
  async ({ body }) => {
    if (!features.ENABLE_AI_SEARCH) {
      return {
        data: {
          interpretation: null,
          filters: {},
          confidence: 0,
          note: "Natural-language search is disabled for this deployment.",
        },
      };
    }

    const parsed = await getAiProvider().parseSearchQuery(body.query);

    // Flatten to the same URL parameter names the search page reads, so the
    // client can apply them without a translation layer.
    const filters: Record<string, string> = {};
    if (parsed.city) filters.city = parsed.city;
    if (parsed.localities?.length) filters.locality = parsed.localities[0]!;
    if (parsed.listingType) filters.listingType = parsed.listingType;
    if (parsed.propertyTypes?.length) filters.type = parsed.propertyTypes.join(",");
    if (parsed.bedroomsMin) filters.bedrooms = String(parsed.bedroomsMin);
    if (parsed.priceMin) filters.priceMin = String(parsed.priceMin);
    if (parsed.priceMax) filters.priceMax = String(parsed.priceMax);
    if (parsed.readyToMove) filters.possession = "READY_TO_MOVE";

    return {
      data: {
        interpretation: parsed.interpretation,
        confidence: parsed.confidence,
        filters,
      },
    };
  },
);
