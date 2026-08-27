import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { isValidReference } from "@/lib/domain/references";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/properties/:id
 *
 * Accepts either a listing UUID or a permanent property passport reference
 * (PROP-NCR-0000001) — the passport code is the identifier partners should
 * store, because it outlives any individual listing.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Database is not configured." } },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const isPassport = isValidReference(id, "property");

  const query = supabase
    .from("listings")
    .select(
      `id, reference_code, slug, title, description, listing_type, property_type, price, currency,
       bedrooms, bathrooms, built_up_area, carpet_area, city, locality, state, pincode,
       possession_status, furnishing, facing, published_at, verification_score,
       property_passports!inner ( reference_code, verification_score, last_verified_at )`,
    )
    .eq("status", "VERIFIED");

  const { data } = isPassport
    ? await query.eq("property_passports.reference_code", id.toUpperCase()).limit(1)
    : await query.eq("id", id).limit(1);

  const listing = data?.[0];

  if (!listing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Property not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: listing });
}
