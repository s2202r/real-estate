import { z } from "zod";
import { withApi, ApiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { maskEmail, maskPhone, maskName } from "@/lib/security/masking";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/leads
 *
 * Leads the caller is party to.
 *
 * Customer contact details are masked in the RESPONSE regardless of the
 * `is_contact_unlocked` flag: unmasking is a separate, audited action, and an
 * API that returned plaintext numbers in a list would route around that
 * control entirely.
 */
const QuerySchema = z.object({
  stage: z.string().max(30).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApi(
  {
    auth: true,
    querySchema: QuerySchema,
    rateLimit: { scope: "api:leads", limit: 60, windowSeconds: 60 },
  },
  async ({ query }) => {
    if (!isSupabaseConfigured()) {
      throw new ApiError(503, "not_configured", "Database is not configured.");
    }

    const supabase = await createClient();
    const from = (query.page - 1) * query.pageSize;

    let request = supabase
      .from("leads")
      .select(
        `id, reference_code, stage, source, message, budget, currency, score,
         created_at, last_activity_at, next_follow_up_at, is_contact_unlocked,
         listings ( title, city, locality ),
         customers ( profiles ( full_name, phone, email ) )`,
        { count: "exact" },
      );

    if (query.stage) request = request.eq("stage", query.stage as never);

    const { data, count } = await request
      .order("last_activity_at", { ascending: false })
      .range(from, from + query.pageSize - 1);

    const leads = (data ?? []).map((lead) => {
      const customer = lead.customers as { profiles?: { full_name?: string; phone?: string | null; email?: string | null } } | null;
      const profile = customer?.profiles;

      return {
        ...lead,
        customers: undefined,
        customer: {
          name: maskName(profile?.full_name ?? null),
          phone: maskPhone(profile?.phone ?? null),
          email: maskEmail(profile?.email ?? null),
          isMasked: true,
        },
      };
    });

    return {
      data: leads,
      meta: {
        total: count ?? 0,
        page: query.page,
        pageSize: query.pageSize,
        note: "Contact details are masked. Unmasking is an audited action in the agent workspace.",
      },
    };
  },
);
