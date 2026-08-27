import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkInToVisit } from "@/lib/actions/visits";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  actor: z.enum(["AGENT", "CUSTOMER"]),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().min(0).max(100_000).optional(),
});

/**
 * POST /api/v1/visits/:id/check-in
 *
 * Coordinates are optional: a missing GPS fix is tolerated by the
 * qualification rules (basements exist), whereas a fix that contradicts the
 * property location is not.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_json", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Invalid check-in payload.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const result = await checkInToVisit({ visitId: id, ...parsed.data });

  return NextResponse.json(
    result.ok
      ? { data: { checkedIn: true, message: result.message } }
      : { error: { code: "cannot_check_in", message: result.message } },
    { status: result.ok ? 200 : 409 },
  );
}
