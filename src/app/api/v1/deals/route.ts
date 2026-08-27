import { z } from "zod";
import { withApi, ApiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/deals
 *
 * Deals the caller participates in. RLS restricts rows to participants, the
 * customer and admins.
 */
const QuerySchema = z.object({
  status: z.string().max(30).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApi(
  {
    auth: true,
    querySchema: QuerySchema,
    rateLimit: { scope: "api:deals", limit: 60, windowSeconds: 60 },
  },
  async ({ query }) => {
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, "not_configured", "Database is not configured.");
    }

    const supabase = await createClient();
    const from = (query.page - 1) * query.pageSize;

    let request = supabase
      .from("deals")
      .select(
        `id, reference_code, status, listing_type, asking_price, negotiated_price, final_price,
         commission_pool, currency, booked_at, closed_at, created_at,
         listings ( title, city, locality ),
         deal_participants ( role, agent_id )`,
        { count: "exact" },
      );

    if (query.status) request = request.eq("status", query.status as never);

    const { data, count } = await request
      .order("created_at", { ascending: false })
      .range(from, from + query.pageSize - 1);

    return {
      data: data ?? [],
      meta: { total: count ?? 0, page: query.page, pageSize: query.pageSize },
    };
  },
);
