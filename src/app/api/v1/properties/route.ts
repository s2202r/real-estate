import { z } from "zod";
import { withApi } from "@/lib/api/handler";
import { searchListings } from "@/lib/data/listings";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/properties
 *
 * Public property search. Runs under the caller's RLS, so an unauthenticated
 * request sees verified listings only — the same rows the website shows.
 */
const QuerySchema = z.object({
  q: z.string().max(120).optional(),
  city: z.string().max(80).optional(),
  locality: z.string().max(80).optional(),
  listingType: z.enum(["SALE", "RENT", "LEASE"]).optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  bedroomsMin: z.coerce.number().int().min(0).max(20).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["newest", "price_asc", "price_desc", "area_desc"]).default("newest"),
});

export const GET = withApi(
  {
    querySchema: QuerySchema,
    rateLimit: { scope: "api:properties", limit: 120, windowSeconds: 60 },
  },
  async ({ query }) => {
    const result = await searchListings({
      query: query.q,
      city: query.city,
      locality: query.locality,
      listingType: query.listingType,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      bedroomsMin: query.bedroomsMin,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      data: result.listings,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    };
  },
);
