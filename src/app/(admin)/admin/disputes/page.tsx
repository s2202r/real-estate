import { AlertTriangle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DisputeDecision, ReviewDecision } from "./decisions";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoney, fromMajor } from "@/lib/domain/money";

export const metadata = { title: "Disputes and reviews" };

export default async function AdminDisputesPage() {
  await requireCapability("dispute.manage");
  const [disputes, reviews] = await Promise.all([getDisputes(), getPendingReviews()]);

  return (
    <Tabs defaultValue="disputes">
      <TabsList>
        <TabsTrigger value="disputes">Disputes ({disputes.length})</TabsTrigger>
        <TabsTrigger value="reviews">Reviews awaiting moderation ({reviews.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="disputes">
        {disputes.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No open disputes"
            description="Agents can dispute lead ownership, visit attribution or a commission split."
          />
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <Card key={dispute.id}>
                <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_20rem]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind="dispute" status={dispute.status} />
                      <Badge variant="outline" size="sm">
                        {humanise(dispute.category)}
                      </Badge>
                      <Badge
                        variant={dispute.priority === "CRITICAL" ? "destructive" : "muted"}
                        size="sm"
                      >
                        {dispute.priority}
                      </Badge>
                      <span className="tabular text-xs text-muted-foreground">
                        {dispute.reference_code}
                      </span>
                    </div>

                    <p className="mt-2 font-medium">{dispute.title}</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                      {dispute.description}
                    </p>

                    <dl className="mt-3 flex flex-wrap gap-6 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Entity</dt>
                        <dd>{dispute.entity_type}</dd>
                      </div>
                      {dispute.claimed_amount && (
                        <div>
                          <dt className="text-xs text-muted-foreground">Claimed</dt>
                          <dd className="tabular font-medium">
                            {formatMoney(fromMajor(dispute.claimed_amount, "INR"))}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-xs text-muted-foreground">Raised</dt>
                        <dd className="tabular">
                          {new Date(dispute.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                      Attribution evidence for this entity is append-only: visit check-ins, lead
                      events and deal events cannot have been altered after the fact.
                    </p>
                  </div>

                  <DisputeDecision disputeId={dispute.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="reviews">
        {reviews.length === 0 ? (
          <EmptyState icon={Star} title="No reviews awaiting moderation" />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_16rem]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex" aria-label={`${review.rating} out of 5`}>
                        {Array.from({ length: 5 }, (_, index) => (
                          <Star
                            key={index}
                            className={
                              index < review.rating
                                ? "size-4 fill-warning text-warning"
                                : "size-4 text-muted-foreground/30"
                            }
                            aria-hidden
                          />
                        ))}
                      </span>
                      {review.is_verified_interaction && (
                        <Badge variant="success" size="sm">
                          Verified interaction
                        </Badge>
                      )}
                    </div>
                    {review.title && <p className="mt-2 font-medium">{review.title}</p>}
                    {review.body && (
                      <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      About {review.agents?.agency_name ?? "an agent"}
                    </p>
                  </div>

                  <ReviewDecision reviewId={review.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

interface DisputeRow {
  id: string;
  reference_code: string;
  category: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  entity_type: string;
  claimed_amount: string | null;
  created_at: string;
}

async function getDisputes(): Promise<DisputeRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("disputes")
    .select(
      "id, reference_code, category, status, priority, title, description, entity_type, claimed_amount, created_at",
    )
    .in("status", ["OPEN", "UNDER_REVIEW", "ESCALATED"])
    .order("created_at", { ascending: true })
    .limit(50);
  return (data ?? []) as DisputeRow[];
}

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified_interaction: boolean;
  agents: { agency_name: string | null } | null;
}

async function getPendingReviews(): Promise<ReviewRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, title, body, is_verified_interaction, agents ( agency_name )")
    .eq("moderation_status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(50);
  return (data ?? []) as unknown as ReviewRow[];
}

function humanise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
