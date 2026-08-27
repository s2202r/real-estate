import { z } from "zod";
import { withApi, ApiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/commissions
 *
 * The caller's own commission ledger. RLS restricts rows to the authenticated
 * user's entries, so this endpoint cannot be made to disclose another agent's
 * earnings by manipulating parameters — there are no parameters that select a
 * subject.
 */
const QuerySchema = z.object({
  status: z
    .enum(["PENDING", "CALCULATED", "APPROVED", "PAYMENT_PROCESSING", "PAID", "DISPUTED", "CANCELLED"])
    .optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApi(
  {
    auth: true,
    querySchema: QuerySchema,
    rateLimit: { scope: "api:commissions", limit: 60, windowSeconds: 60 },
  },
  async ({ query }) => {
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, "not_configured", "Database is not configured.");
    }

    const supabase = await createClient();
    const from = (query.page - 1) * query.pageSize;

    let request = supabase
      .from("commission_ledger")
      .select(
        "id, reference_code, role, entry_type, amount, currency, status, created_at, approved_at, paid_at, deals ( reference_code )",
        { count: "exact" },
      );

    if (query.status) request = request.eq("status", query.status);

    const { data, count } = await request
      .order("created_at", { ascending: false })
      .range(from, from + query.pageSize - 1);

    return {
      data: data ?? [],
      meta: { total: count ?? 0, page: query.page, pageSize: query.pageSize },
    };
  },
);
