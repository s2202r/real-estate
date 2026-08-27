import Link from "next/link";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser("/dashboard/messages");
  const notifications = await getNotifications();

  return (
    <div className="max-w-3xl">
      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Updates about your enquiries, visits and deals appear here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification.id} className={notification.read_at ? undefined : "border-primary/40"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{notification.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                  </div>
                  {!notification.read_at && (
                    <Badge variant="default" size="sm">
                      New
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <time className="text-xs text-muted-foreground" dateTime={notification.created_at}>
                    {new Date(notification.created_at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  {notification.action_url && (
                    <Link
                      href={notification.action_url}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

async function getNotifications(): Promise<NotificationRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, action_url, read_at, created_at")
    .eq("channel", "IN_APP")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as NotificationRow[];
}
