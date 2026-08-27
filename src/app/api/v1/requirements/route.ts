import { z } from "zod";
import { withApi, ApiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/customer-requirements
 *
 * The demand marketplace.
 *
 * Note what this NEVER returns: the customer's name, phone or email. RLS lets a
 * verified agent discover an ACTIVE, discoverable requirement, but the customer
 * identity lives in tables the agent cannot read. Discovery exposes the demand,
 * never the person.
 */
const QuerySchema = z.object({
  city: z.string().max(80).optional(),
  listingType: z.enum(["SALE", "RENT", "LEASE"]).optional(),
  budgetMax: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApi(
  {
    auth: true,
    querySchema: QuerySchema,
    rateLimit: { scope: "api:requirements", limit: 60, windowSeconds: 60 },
  },
  async ({ query }) => {
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, "not_configured", "Database is not configured.");
    }

    const supabase = await createClient();
    const from = (query.page - 1) * query.pageSize;

    let request = supabase
      .from("customer_requirements")
      .select(
        `id, reference_code, title, listing_type, property_type, category, city, localities,
         budget_min, budget_max, currency, min_area, bedrooms_min, bedrooms_max,
         possession, amenities, preferences, required_by, created_at`,
        { count: "exact" },
      )
      .eq("status", "ACTIVE");

    if (query.city) request = request.eq("city", query.city);
    if (query.listingType) request = request.eq("listing_type", query.listingType);
    if (query.budgetMax) request = request.lte("budget_max", query.budgetMax);

    const { data, count } = await request
      .order("created_at", { ascending: false })
      .range(from, from + query.pageSize - 1);

    return {
      data: data ?? [],
      meta: { total: count ?? 0, page: query.page, pageSize: query.pageSize },
    };
  },
);
