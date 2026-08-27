import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { DuplicateDecision } from "./duplicate-decision";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

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
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">This property</p>
                      <p className="tabular mt-1 font-mono text-sm">
                        {candidate.property?.reference_code ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Possible duplicate of</p>
                      <p className="tabular mt-1 font-mono text-sm">
                        {candidate.candidate?.reference_code ?? "—"}
                      </p>
                    </div>
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

interface CandidateRow {
  id: string;
  confidence: string;
  status: string;
  signals: unknown;
  property: { reference_code: string } | null;
  candidate: { reference_code: string } | null;
}

async function getCandidates(): Promise<CandidateRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_duplicate_candidates")
    .select(
      `id, confidence, status, signals,
       property:property_passports!property_duplicate_candidates_property_id_fkey ( reference_code ),
       candidate:property_passports!property_duplicate_candidates_candidate_id_fkey ( reference_code )`,
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
