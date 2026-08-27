import { NextResponse, type NextRequest } from "next/server";
import { submitListingForReview } from "@/lib/actions/listings";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/listings/:id/submit
 *
 * Submits a draft for moderation. There is deliberately no publish endpoint:
 * only an administrator can move a listing to VERIFIED, and a database trigger
 * enforces that independently of this API.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await submitListingForReview(id);

  return NextResponse.json(
    result.ok
      ? { data: { submitted: true, message: result.message } }
      : { error: { code: "cannot_submit", message: result.message } },
    { status: result.ok ? 200 : 409 },
  );
}
