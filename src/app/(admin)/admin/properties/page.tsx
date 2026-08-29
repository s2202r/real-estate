import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DuplicateDecision } from "./duplicate-decision";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { listingPath } from "@/lib/domain/references";
import { formatMoney, fromMajor } from "@/lib/domain/money";

export const metadata = { title: "Properties and duplicates" };

interface SignalShape {
  key: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
}

/**
 * Duplicate adjudication queue.
 *
 * The platform NEVER auto-merges passports. Merging two genuinely distinct
 * units destroys price and visit history and can misattribute a commission — a
 * far worse outcome than leaving a duplicate in place. So the engine produces a
 * confidence and the evidence behind it, and a human decides.
 *
 * That decision needs the two properties, not two reference codes. Each side
 * now carries its address, unit identity and listings, and every listing opens
 * its own page — so an operator can compare the actual properties from here
 * instead of copying a code into a search box and losing their place in the
 * queue.
 */
export default async function AdminPropertiesPage() {
  await requireCapability("duplicate.review");
  const candidates = await getCandidates();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Possible duplicate property passports, ranked by confidence. Confirming a duplicate LINKS
        the records for follow-up; it does not merge or delete either one.
      </p>

      {candidates.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="No duplicate candidates"
          description="New listings are checked against existing passports on creation."
        />
      ) : (
        candidates.map((candidate) => {
          const signals = extractSignals(candidate.signals);

          return (
            <Card key={candidate.id}>
              <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_18rem]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={Number(candidate.confidence) >= 85 ? "destructive" : "warning"}
                    >
                      {Math.round(Number(candidate.confidence))}% confidence
                    </Badge>
                    <Badge variant="outline" size="sm">
                      {candidate.status}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <PassportCard label="This property" passport={candidate.property} />
                    <PassportCard
                      label="Possible duplicate of"
                      passport={candidate.candidate}
                      compareWith={candidate.property}
                    />
                  </div>

                  {signals.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {signals.map((signal) => (
                        <li
                          key={signal.key}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="font-medium">{signal.label}: </span>
                            <span className="text-muted-foreground">{signal.detail}</span>
                          </span>
                          <span className="tabular shrink-0 text-xs text-muted-foreground">
                            {signal.score}/100
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <DuplicateDecision candidateId={candidate.id} />
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

/**
 * One side of a candidate pair.
 *
 * `compareWith` marks the facts that DIFFER from the other side. Sameness is
 * what the confidence score already argues; the differences are what an
 * operator is actually looking for, and they are easy to miss between two
 * near-identical blocks of text.
 */
function PassportCard({
  label,
  passport,
  compareWith,
}: {
  label: string;
  passport: PassportRow | null;
  compareWith?: PassportRow | null;
}) {
  if (!passport) {
    return (
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">Record no longer exists.</p>
      </div>
    );
  }

  const address = one(passport.property_addresses);
  const project = one(passport.projects);
  const other = compareWith ?? null;

  const unit = [
    passport.tower && `Tower ${passport.tower}`,
    passport.unit_number && `Unit ${passport.unit_number}`,
    passport.floor !== null && `Floor ${passport.floor}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const otherUnit = other
    ? [
        other.tower && `Tower ${other.tower}`,
        other.unit_number && `Unit ${other.unit_number}`,
        other.floor !== null && `Floor ${other.floor}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const configuration = describeConfiguration(passport);
  const place = [address?.locality, address?.city].filter(Boolean).join(", ");
  const otherPlace = other
    ? [one(other.property_addresses)?.locality, one(other.property_addresses)?.city]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 font-mono text-sm">{passport.reference_code}</p>

      <dl className="mt-2 space-y-1 text-xs">
        <Fact
          value={configuration}
          differs={Boolean(other) && configuration !== describeConfiguration(other!)}
        />
        {project?.name && <Fact value={project.name} />}
        <Fact value={unit || "Unit not recorded"} differs={Boolean(otherUnit) && unit !== otherUnit} />
        <Fact value={address?.address_line1 ?? null} />
        <Fact value={place || null} differs={Boolean(otherPlace) && place !== otherPlace} />
        <Fact value={address?.pincode ? `PIN ${address.pincode}` : null} />
      </dl>

      {passport.listings.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No listings on this passport.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 border-t pt-2">
          {passport.listings.map((listing) => (
            <li key={listing.id}>
              <Link
                href={listingPath({
                  locality: listing.locality,
                  slug: listing.slug,
                  reference: listing.reference_code,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium group-hover:underline">
                    {listing.title}
                  </span>
                  <span className="tabular block truncate font-mono text-[11px] text-muted-foreground">
                    {listing.reference_code} · {formatMoney(fromMajor(listing.price, "INR"))}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <StatusBadge kind="listing" status={listing.status} />
                  <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fact({ value, differs }: { value: string | null; differs?: boolean }) {
  if (!value) return null;
  return (
    <dd className={differs ? "font-medium text-warning" : "text-muted-foreground"}>
      {value}
      {differs && <span className="ml-1 text-[10px] uppercase tracking-wide">differs</span>}
    </dd>
  );
}

function describeConfiguration(passport: PassportRow): string {
  const parts = [
    passport.bedrooms ? `${passport.bedrooms} BHK` : null,
    humanise(passport.property_type),
    passport.built_up_area ? `${Number(passport.built_up_area)} sq ft` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function humanise(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

/**
 * PostgREST returns a to-one embed as an object, but the generated types can
 * widen it to an array. Normalise rather than cast, so a shape change shows up
 * as an empty card instead of a crash on a page an operator is mid-decision on.
 */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface ListingRow {
  id: string;
  reference_code: string;
  slug: string;
  locality: string;
  status: string;
  title: string;
  price: string;
}

interface PassportRow {
  id: string;
  reference_code: string;
  property_type: string;
  bedrooms: number | null;
  built_up_area: string | null;
  tower: string | null;
  unit_number: string | null;
  floor: number | null;
  projects: { name: string } | { name: string }[] | null;
  property_addresses:
    | { address_line1: string | null; locality: string; city: string; pincode: string | null }
    | { address_line1: string | null; locality: string; city: string; pincode: string | null }[]
    | null;
  listings: ListingRow[];
}

interface CandidateRow {
  id: string;
  confidence: string;
  status: string;
  signals: unknown;
  property: PassportRow | null;
  candidate: PassportRow | null;
}

const PASSPORT_FIELDS = `id, reference_code, property_type, bedrooms, built_up_area,
   tower, unit_number, floor,
   projects ( name ),
   property_addresses ( address_line1, locality, city, pincode ),
   listings ( id, reference_code, slug, locality, status, title, price )`;

async function getCandidates(): Promise<CandidateRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_duplicate_candidates")
    .select(
      `id, confidence, status, signals,
       property:property_passports!property_duplicate_candidates_property_id_fkey ( ${PASSPORT_FIELDS} ),
       candidate:property_passports!property_duplicate_candidates_candidate_id_fkey ( ${PASSPORT_FIELDS} )`,
    )
    .eq("status", "PENDING")
    .order("confidence", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as CandidateRow[];
}

function extractSignals(raw: unknown): SignalShape[] {
  if (raw && typeof raw === "object" && "signals" in raw) {
    const signals = (raw as { signals?: unknown }).signals;
    if (Array.isArray(signals)) return signals as SignalShape[];
  }
  return [];
}
