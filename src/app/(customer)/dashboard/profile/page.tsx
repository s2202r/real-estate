import { Eye, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/session";
import { listContactAccessForCustomer } from "@/lib/services/contact-access";
import { maskEmail, maskPhone } from "@/lib/security/masking";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const metadata = { title: "Profile and privacy" };

/**
 * Profile and privacy.
 *
 * The access log is the important half of this page: a customer can see exactly
 * which agents viewed their contact details and when. That transparency is what
 * makes controlled disclosure credible rather than a promise.
 */
export default async function ProfilePage() {
  const user = await requireUser("/dashboard/profile");
  const profile = await getProfile(user.id);
  const accessLog = user.customerId ? await listContactAccessForCustomer(user.customerId) : [];

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
          <CardDescription>
            Shown to agents only after you engage with them, and never in bulk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Name</dt>
              <dd className="mt-1 font-medium">{user.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Mobile</dt>
              <dd className="mt-1 font-medium">
                {profile?.phone ? `${profile.phone_country ?? ""}${profile.phone}` : "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">City</dt>
              <dd className="mt-1 font-medium">{user.city ?? "Not set"}</dd>
            </div>
          </dl>

          <Separator className="my-5" />

          <div className="flex flex-wrap gap-2">
            {profile?.email_verified_at && (
              <Badge variant="success" size="sm">
                <ShieldCheck aria-hidden />
                Email verified
              </Badge>
            )}
            {profile?.phone_verified_at && (
              <Badge variant="success" size="sm">
                <ShieldCheck aria-hidden />
                Mobile verified
              </Badge>
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            How agents currently see you before you engage: {maskName(user.fullName)} ·{" "}
            {maskPhone(profile?.phone ?? null)} · {maskEmail(user.email)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="size-4" aria-hidden />
            Who has seen your contact details
          </CardTitle>
          <CardDescription>
            Every time an agent unlocks your phone number or email, it is recorded here. Nothing is
            hidden from you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accessLog.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No agent has accessed your contact details"
              description="Agents can only unlock your details after you engage with them about a property."
            />
          ) : (
            <ul className="space-y-2">
              {accessLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">Contact details accessed</p>
                    {entry.reason && (
                      <p className="truncate text-xs text-muted-foreground">{entry.reason}</p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={entry.created_at}>
                    {new Date(entry.created_at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] ?? "Customer";
  return `${parts[0]} ${parts[parts.length - 1]?.[0] ?? ""}.`;
}

async function getProfile(userId: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("phone, phone_country, email_verified_at, phone_verified_at")
    .eq("id", userId)
    .maybeSingle();
  return data;
}
