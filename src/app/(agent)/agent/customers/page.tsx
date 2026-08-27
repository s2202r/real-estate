import { UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { requireAgentPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { formatMoneyCompact, fromMajor } from "@/lib/domain/money";

export const metadata = { title: "Contacts" };

/**
 * Agent CRM contacts.
 *
 * These are the agent's OWN records, including off-platform contacts. They are
 * private to the agent by RLS — no other agent, and no other agency, can read
 * them.
 */
export default async function AgentContactsPage() {
  const user = await requireAgentPage();
  const [contacts, tasks] = await Promise.all([
    getContacts(user.agentId),
    getOpenTasks(user.agentId),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <h2 className="mb-3 text-lg font-semibold">Contacts</h2>
        {contacts.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No contacts yet"
            description="Contacts you add here are private to you. Customers who enquire through the platform appear under Leads."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="p-4">
                  <p className="truncate font-medium">{contact.full_name}</p>
                  {contact.locality && (
                    <p className="text-xs text-muted-foreground">
                      {contact.locality}
                      {contact.city ? `, ${contact.city}` : ""}
                    </p>
                  )}
                  {(contact.budget_min || contact.budget_max) && (
                    <p className="tabular mt-2 text-sm">
                      {contact.budget_min
                        ? formatMoneyCompact(fromMajor(contact.budget_min, "INR"))
                        : "—"}{" "}
                      –{" "}
                      {contact.budget_max
                        ? formatMoneyCompact(fromMajor(contact.budget_max, "INR"))
                        : "—"}
                    </p>
                  )}
                  {contact.requirement_summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {contact.requirement_summary}
                    </p>
                  )}
                  {contact.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant="muted" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Follow-ups due</h2>
        {tasks.length === 0 ? (
          <EmptyState icon={UserRound} title="Nothing due" description="Follow-up tasks appear here." />
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <Badge variant={new Date(task.due_at) < new Date() ? "destructive" : "muted"} size="sm">
                      {new Date(task.due_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ContactRow {
  id: string;
  full_name: string;
  city: string | null;
  locality: string | null;
  tags: string[];
  requirement_summary: string | null;
  budget_min: string | null;
  budget_max: string | null;
}

async function getContacts(agentId: string): Promise<ContactRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_contacts")
    .select("id, full_name, city, locality, tags, requirement_summary, budget_min, budget_max")
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false })
    .limit(60);
  return (data ?? []) as ContactRow[];
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_at: string;
}

async function getOpenTasks(agentId: string): Promise<TaskRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_tasks")
    .select("id, title, description, due_at")
    .eq("agent_id", agentId)
    .in("status", ["OPEN", "IN_PROGRESS", "OVERDUE"])
    .order("due_at", { ascending: true })
    .limit(20);
  return (data ?? []) as TaskRow[];
}
