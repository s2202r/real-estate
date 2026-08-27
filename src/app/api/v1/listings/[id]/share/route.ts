import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestInventoryAccess } from "@/lib/actions/listings";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: z.string().trim().max(500).optional(),
});

/**
 * POST /api/v1/listings/:id/share
 *
 * Requests access to another agent's inventory. Approval is the OWNING agent's
 * decision — this endpoint can only ever create a request, never grant one.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    // An empty body is acceptable here; the message is optional.
  }

  const parsed = BodySchema.safeParse(payload ?? {});
  const result = await requestInventoryAccess(
    id,
    parsed.success ? parsed.data.message : undefined,
  );

  return NextResponse.json(
    result.ok
      ? { data: { requested: true, message: result.message } }
      : { error: { code: "cannot_request", message: result.message } },
    { status: result.ok ? 200 : 409 },
  );
}
