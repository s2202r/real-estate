import { z } from "zod";
import { withApi, ApiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/listings
 *
 * The AGENT-facing view of listings, including drafts and rejections. RLS
 * scopes it to the caller's own inventory plus anything explicitly shared with
 * them, so this is not a second route to the public catalogue.
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
    rateLimit: { scope: "api:listings", limit: 60, windowSeconds: 60 },
  },
  async ({ query, user }) => {
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, "not_configured", "Database is not configured.");
    }
    if (!user?.agentId) {
      throw new ApiError(403, "forbidden", "An agent profile is required.");
    }

    const supabase = await createClient();
    const from = (query.page - 1) * query.pageSize;

    let request = supabase
      .from("listings")
      .select(
        `id, reference_code, slug, title, status, listing_type, price, currency, city, locality,
         bedrooms, built_up_area, view_count, enquiry_count, verification_score,
         rejection_reason, published_at, created_at,
         property_passports ( reference_code )`,
        { count: "exact" },
      )
      .eq("agent_id", user.agentId);

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
