import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { RequirementForm } from "./requirement-form";
import { requireCustomerPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoneyCompact, fromMajor } from "@/lib/domain/money";

export const metadata = { title: "My requirements" };

export default async function RequirementsPage() {
  const user = await requireCustomerPage();
  const requirements = await getRequirements(user.customerId);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">Your requirements</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Publishing what you are looking for lets agents bring you matching inventory — including
          properties that are not advertised yet. Your contact details are never included.
        </p>

        <div className="mt-5 space-y-4">
          {requirements.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No requirements posted"
              description="Post one and verified agents working your city can respond with matching properties."
            />
          ) : (
            requirements.map((requirement) => (
              <Card key={requirement.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {requirement.title ??
                        `${requirement.listing_type === "SALE" ? "Buy" : "Rent"} in ${requirement.city}`}
                    </p>
                    <div className="flex items-center gap-2">
                      {requirement.is_discoverable ? (
                        <Badge variant="success" size="sm">
                          Visible to agents
                        </Badge>
                      ) : (
                        <Badge variant="muted" size="sm">
                          Private
                        </Badge>
                      )}
                      <Badge variant="outline" size="sm">
                        {requirement.status}
                      </Badge>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Budget</dt>
                      <dd className="tabular font-medium">
                        {formatMoneyCompact(fromMajor(requirement.budget_max, "INR"))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Bedrooms</dt>
                      <dd className="font-medium">
                        {requirement.bedrooms_min ? `${requirement.bedrooms_min}+ BHK` : "Any"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Area</dt>
                      <dd className="font-medium">
                        {requirement.min_area ? `${Number(requirement.min_area)}+ sq ft` : "Any"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Matches</dt>
                      <dd className="tabular font-medium">{requirement.match_count}</dd>
                    </div>
                  </dl>

                  {requirement.localities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {requirement.localities.map((locality) => (
                        <Badge key={locality} variant="muted" size="sm">
                          {locality}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="tabular mt-3 text-xs text-muted-foreground">
                    {requirement.reference_code}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <RequirementForm />
      </div>
    </div>
  );
}

interface RequirementRow {
  id: string;
  reference_code: string;
  title: string | null;
  listing_type: string;
  city: string;
  localities: string[];
  budget_max: string;
  bedrooms_min: number | null;
  min_area: string | null;
  match_count: number;
  status: string;
  is_discoverable: boolean;
}

async function getRequirements(customerId: string): Promise<RequirementRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_requirements")
    .select(
      "id, reference_code, title, listing_type, city, localities, budget_max, bedrooms_min, min_area, match_count, status, is_discoverable",
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as RequirementRow[];
}
