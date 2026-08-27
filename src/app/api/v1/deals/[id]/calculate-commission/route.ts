import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { calculateDealCommission } from "@/lib/services/commission";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/deals/:id/calculate-commission
 *
 * Runs the deterministic engine and persists the result.
 *
 * `?preview=true` computes WITHOUT persisting, which is how an operator can
 * see what a policy change would produce before committing to it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Authentication is required." } },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  if (!can(user, "commission.calculate")) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "This endpoint requires the commission.calculate capability." } },
      { status: 403, headers: { "x-request-id": requestId } },
    );
  }

  const { id } = await params;
  const preview = request.nextUrl.searchParams.get("preview") === "true";

  try {
    const outcome = await calculateDealCommission({
      dealId: id,
      actorId: user.id,
      persist: !preview,
    });

    return NextResponse.json(
      {
        data: {
          dealReference: outcome.result.dealReference,
          commissionPool: outcome.result.commissionPool,
          currency: outcome.result.currency,
          distributions: outcome.result.distributions,
          explanation: outcome.result.explanation,
          warnings: outcome.result.warnings,
          engineVersion: outcome.result.engineVersion,
          persisted: outcome.persisted,
          calculationId: outcome.calculationId,
        },
      },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status) || 400
        : 400;

    return NextResponse.json(
      {
        error: {
          code: "calculation_failed",
          message: error instanceof Error ? error.message : "Commission calculation failed.",
        },
      },
      { status, headers: { "x-request-id": requestId } },
    );
  }
}
