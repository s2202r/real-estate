import { requireAgentPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { ListingForm } from "./listing-form";

export const metadata = { title: "New listing" };

export default async function NewListingPage() {
  await requireAgentPage();
  const amenities = await getAmenities();

  return <ListingForm amenities={amenities} />;
}

async function getAmenities() {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("amenities")
    .select("key, label, category")
    .order("sort_order", { ascending: true });
  return data ?? [];
}
