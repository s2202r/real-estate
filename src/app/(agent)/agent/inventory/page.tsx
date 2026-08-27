import Link from "next/link";
import { Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ShareRequestButton, ShareResponseButtons } from "./share-actions";
import { requireAgentPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoneyCompact, fromMajor } from "@/lib/domain/money";
import { listingPath } from "@/lib/domain/references";

export const metadata = { title: "Network inventory" };

/**
 * Agent-to-agent inventory sharing (§14).
 *
 * This is the network effect made operational: an agent with a customer but no
 * matching property can request access to another agent's listing, on recorded
 * terms, instead of losing the customer or quietly poaching the inventory.
 */
export default async function NetworkInventoryPage() {
  const user = await requireAgentPage();
  const [incoming, outgoing, available] = await Promise.all([
    getIncomingRequests(user.agentId),
    getOutgoingRequests(user.agentId),
    getShareableInventory(user.agentId),
  ]);

  return (
    <Tabs defaultValue={incoming.length > 0 ? "incoming" : "browse"}>
      <TabsList>
        <TabsTrigger value="incoming">Requests to me ({incoming.length})</TabsTrigger>
        <TabsTrigger value="outgoing">My requests ({outgoing.length})</TabsTrigger>
        <TabsTrigger value="browse">Browse network</TabsTrigger>
      </TabsList>

      <TabsContent value="incoming">
        {incoming.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No access requests"
            description="When another agent wants to share one of your listings with their customer, the request appears here."
          />
        ) : (
          <div className="space-y-3">
            {incoming.map((request) => (
              <Card key={request.id}>
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {request.listings?.title ?? "Listing"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Requested by {request.agents?.agency_name ?? "a network agent"}
                    </p>
                    {request.request_message && (
                      <p className="mt-2 rounded-md bg-muted p-2 text-sm">
                        {request.request_message}
                      </p>
                    )}
                  </div>
                  <ShareResponseButtons shareId={request.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="outgoing">
        {outgoing.length === 0 ? (
          <EmptyState
            icon={Network}
            title="You have not requested any inventory"
            description="Browse the network to find properties that match a customer you are working with."
          />
        ) : (
          <div className="space-y-3">
            {outgoing.map((request) => (
              <Card key={request.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{request.listings?.title ?? "Listing"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {request.agents?.agency_name ?? "Owning agent"}
                      {request.agreed_share_percent
                        ? ` · agreed share ${Number(request.agreed_share_percent)}%`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.status === "APPROVED"
                        ? "success"
                        : request.status === "REJECTED"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {request.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="browse">
        {available.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No shareable inventory right now"
            description="Verified listings that other agents have opened to the network appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((listing) => (
              <Card key={listing.id}>
                <CardContent className="p-5">
                  <p className="tabular text-sm font-semibold">
                    {formatMoneyCompact(fromMajor(listing.price, "INR"))}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium">{listing.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {listing.locality}, {listing.city}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {listing.agents?.agency_name ?? "Network agent"}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Button asChild size="sm" variant="outline">
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
                    <ShareRequestButton listingId={listing.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

interface ShareRow {
  id: string;
  status: string;
  request_message: string | null;
  agreed_share_percent: string | null;
  listings: { title: string } | null;
  agents: { agency_name: string | null } | null;
}

async function getIncomingRequests(agentId: string): Promise<ShareRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_shares")
    .select(
      "id, status, request_message, agreed_share_percent, listings ( title ), agents!listing_shares_requester_agent_id_fkey ( agency_name )",
    )
    .eq("owner_agent_id", agentId)
    .eq("status", "REQUESTED")
    .order("requested_at", { ascending: false });
  return (data ?? []) as unknown as ShareRow[];
}

async function getOutgoingRequests(agentId: string): Promise<ShareRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_shares")
    .select(
      "id, status, request_message, agreed_share_percent, listings ( title ), agents!listing_shares_owner_agent_id_fkey ( agency_name )",
    )
    .eq("requester_agent_id", agentId)
    .order("requested_at", { ascending: false });
  return (data ?? []) as unknown as ShareRow[];
}

interface InventoryRow {
  id: string;
  reference_code: string;
  slug: string;
  title: string;
  price: string;
  city: string;
  locality: string;
  agents: { agency_name: string | null } | null;
}

async function getShareableInventory(agentId: string): Promise<InventoryRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("id, reference_code, slug, title, price, city, locality, agents ( agency_name )")
    .eq("status", "VERIFIED")
    .eq("is_shareable", true)
    .neq("agent_id", agentId)
    .order("published_at", { ascending: false })
    .limit(24);
  return (data ?? []) as unknown as InventoryRow[];
}
