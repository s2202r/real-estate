import { z } from "zod";
import { withApi, ApiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/visits
 *
 * Visits the caller is party to. RLS decides which those are: a customer sees
 * their own, an agent sees visits assigned or offered to them.
 */
const QuerySchema = z.object({
  status: z.string().max(30).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApi(
  {
    auth: true,
    querySchema: QuerySchema,
    rateLimit: { scope: "api:visits", limit: 60, windowSeconds: 60 },
  },
  async ({ query }) => {
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, "not_configured", "Database is not configured.");
    }

    const supabase = await createClient();
    const from = (query.page - 1) * query.pageSize;

    let request = supabase
      .from("visits")
      .select(
        `id, reference_code, visit_type, status, requested_date, requested_time,
         is_qualified, duration_minutes, outcome, listings ( title, city, locality )`,
        { count: "exact" },
      );

    if (query.status) request = request.eq("status", query.status as never);
    if (query.from) request = request.gte("requested_date", query.from);

    const { data, count } = await request
      .order("requested_date", { ascending: false })
      .range(from, from + query.pageSize - 1);

    return {
      data: data ?? [],
      meta: { total: count ?? 0, page: query.page, pageSize: query.pageSize },
    };
  },
);
