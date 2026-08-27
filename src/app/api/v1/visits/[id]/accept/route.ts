import { NextResponse, type NextRequest } from "next/server";
import { acceptVisit } from "@/lib/actions/visits";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/visits/:id/accept
 *
 * Delegates to the same server action the dashboard uses, so the API and the
 * UI cannot diverge on who may accept a visit or what happens when they do.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await acceptVisit(id);

  return NextResponse.json(
    result.ok
      ? { data: { accepted: true, message: result.message } }
      : { error: { code: "cannot_accept", message: result.message } },
    { status: result.ok ? 200 : 409 },
  );
}
