import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { maskEmail, maskPhone } from "@/lib/security/masking";

export const metadata = { title: "Users" };

/**
 * User directory.
 *
 * Contact details are MASKED even here. An operations admin browsing the
 * directory has no need for a customer's phone number; the ones who do (support
 * handling a specific ticket) reach it through that ticket, where the access is
 * recorded against the case.
 */
export default async function AdminUsersPage() {
  await requireCapability("user.manage");
  const users = await getUsers();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {users.length} accounts. Contact details are masked in this directory by design.
      </p>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(user.user_roles ?? []).map((role) => (
                        <Badge key={role.role} variant="muted" size="sm">
                          {role.role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {maskEmail(user.email)}
                  </TableCell>
                  <TableCell className="tabular text-xs text-muted-foreground">
                    {maskPhone(user.phone)}
                  </TableCell>
                  <TableCell className="text-xs">{user.city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" ? "success" : "muted"} size="sm">
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
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

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  created_at: string;
  user_roles: { role: string }[] | null;
}

async function getUsers(): Promise<UserRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, city, status, created_at, user_roles ( role )")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as UserRow[];
}
