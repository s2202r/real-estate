import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitListingButton } from "./submit-button";
import { requireAgent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoneyCompact, fromMajor } from "@/lib/domain/money";
import { listingPath } from "@/lib/domain/references";

export const metadata = { title: "My listings" };

export default async function AgentListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAgent();
  const params = await searchParams;
  const created = typeof params.created === "string" ? params.created : null;
  const listings = await getListings(user.agentId);

  return (
    <div className="space-y-5">
      {created && (
        <Card className="border-success/40">
          <CardContent className="p-4 text-sm">
            Listing <span className="tabular font-medium">{created}</span> saved. Submit it for
            review when you are ready — it becomes publicly visible only after the platform
            approves it.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {listings.length} {listings.length === 1 ? "listing" : "listings"} across all statuses.
        </p>
        <Button asChild>
          <Link href="/agent/properties/new">
            <Plus aria-hidden />
            New listing
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No listings yet"
          description="Add your first property. It gets a permanent property passport, and once verified other agents can request access and bring you their customers."
          action={
            <Button asChild>
              <Link href="/agent/properties/new">
                <Plus aria-hidden />
                Create a listing
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Enquiries</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{listing.title}</p>
                      <p className="tabular truncate text-xs text-muted-foreground">
                        {listing.reference_code} · {listing.locality}, {listing.city}
                      </p>
                      {listing.status === "REJECTED" && listing.rejection_reason && (
                        <p className="mt-1 text-xs text-destructive">{listing.rejection_reason}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge kind="listing" status={listing.status} />
                      {listing.is_exclusive && (
                        <Badge variant="warning" size="sm">
                          Exclusive
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {formatMoneyCompact(fromMajor(listing.price, "INR"))}
                  </TableCell>
                  <TableCell className="tabular">{listing.view_count}</TableCell>
                  <TableCell className="tabular">{listing.enquiry_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {listing.status === "VERIFIED" && (
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={listingPath({
                              locality: listing.locality,
                              slug: listing.slug,
                              reference: listing.reference_code,
                            })}
                          >
                            View
                          </Link>
                        </Button>
                      )}
                      {["DRAFT", "REJECTED", "EXPIRED"].includes(listing.status) && (
                        <SubmitListingButton listingId={listing.id} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

interface ListingRow {
  id: string;
  reference_code: string;
  slug: string;
  title: string;
  status: string;
  price: string;
  city: string;
  locality: string;
  view_count: number;
  enquiry_count: number;
  is_exclusive: boolean;
  rejection_reason: string | null;
}

async function getListings(agentId: string): Promise<ListingRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "id, reference_code, slug, title, status, price, city, locality, view_count, enquiry_count, is_exclusive, rejection_reason",
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ListingRow[];
}
