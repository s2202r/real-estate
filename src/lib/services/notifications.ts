import "server-only";

import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import {
  getNotificationProvider,
  isChannelAvailable,
  renderTemplate,
  type NotificationChannel,
} from "@/lib/providers/notifications";
import { appConfig } from "@/config/app";

/**
 * Notification dispatcher.
 *
 * Business logic calls `notify()` with a domain EVENT. This module resolves the
 * recipient's preferences and consent, renders the stored template, writes the
 * in-app row and hands off to the configured adapters.
 *
 * Nothing in the service layer knows that Resend, MSG91 or Meta exist.
 */

export type NotificationEvent =
  | "lead.received"
  | "listing.approved"
  | "listing.rejected"
  | "visit.booked"
  | "visit.opportunity"
  | "visit.accepted"
  | "visit.reminder"
  | "visit.completed"
  | "deal.updated"
  | "commission.generated"
  | "commission.approved"
  | "payment.completed"
  | "share.requested"
  | "share.approved"
  | "requirement.match"
  | "agent.verified"
  | "dispute.updated"
  | "investor.opportunity"
  | "exclusive.expiring";

export interface NotifyInput {
  readonly userId: string;
  readonly event: NotificationEvent;
  readonly variables?: Record<string, string | number>;
  readonly actionUrl?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  /** Overrides the template's channels; still filtered by preference/consent. */
  readonly channels?: readonly NotificationChannel[];
}

export interface NotifyOutcome {
  readonly delivered: readonly NotificationChannel[];
  readonly skipped: readonly { channel: NotificationChannel; reason: string }[];
}

export async function notify(input: NotifyInput): Promise<NotifyOutcome> {
  const delivered: NotificationChannel[] = [];
  const skipped: { channel: NotificationChannel; reason: string }[] = [];

  if (!isAdminClientAvailable()) {
    return { delivered, skipped: [{ channel: "IN_APP", reason: "Database unavailable." }] };
  }

  const supabase = createAdminClient();

  const [templateResult, preferencesResult, profileResult] = await Promise.all([
    supabase.from("notification_templates").select("*").eq("key", input.event).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("user_id", input.userId).maybeSingle(),
    supabase.from("profiles").select("email, phone, full_name").eq("id", input.userId).maybeSingle(),
  ]);

  const template = templateResult.data;
  if (!template) {
    return { delivered, skipped: [{ channel: "IN_APP", reason: `No template for ${input.event}.` }] };
  }

  const variables = { appName: appConfig.name, ...input.variables };
  const subject = template.subject_template
    ? renderTemplate(template.subject_template, variables)
    : template.name;
  const body = renderTemplate(template.body_template, variables);

  const preferences = preferencesResult.data;
  if (preferences?.muted_events?.includes(input.event)) {
    return { delivered, skipped: [{ channel: "IN_APP", reason: "Event muted by the user." }] };
  }

  const requestedChannels = input.channels ?? (template.channels as NotificationChannel[]);

  for (const channel of requestedChannels) {
    if (!channelAllowedByPreference(channel, preferences)) {
      skipped.push({ channel, reason: "Disabled in the recipient's notification preferences." });
      continue;
    }

    if (channel === "IN_APP") {
      await supabase.from("notifications").insert({
        user_id: input.userId,
        template_key: template.key,
        channel: "IN_APP",
        event_type: input.event,
        title: subject,
        body,
        action_url: input.actionUrl ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        status: "SENT",
        sent_at: new Date().toISOString(),
      });
      delivered.push("IN_APP");
      continue;
    }

    if (!isChannelAvailable(channel)) {
      skipped.push({ channel, reason: "Channel is not enabled or not configured." });
      await recordAttempt(channel, "SKIPPED", "Channel not available.");
      continue;
    }

    const provider = getNotificationProvider(channel);
    if (!provider) {
      skipped.push({ channel, reason: "No provider registered." });
      continue;
    }

    const result = await provider.send({
      to: {
        userId: input.userId,
        email: profileResult.data?.email ?? null,
        phone: profileResult.data?.phone ?? null,
      },
      subject,
      body,
      templateKey: template.key,
      variables,
      actionUrl: input.actionUrl,
    });

    if (result.delivered) {
      delivered.push(channel);
      await recordAttempt(channel, "SENT", null, result.providerMessageId, result.provider);
    } else {
      skipped.push({ channel, reason: result.skippedReason ?? result.error ?? "Delivery failed." });
      await recordAttempt(
        channel,
        result.skippedReason ? "SKIPPED" : "FAILED",
        result.skippedReason ?? result.error ?? null,
        undefined,
        result.provider,
      );
    }
  }

  async function recordAttempt(
    channel: NotificationChannel,
    status: "SENT" | "FAILED" | "SKIPPED",
    failureReason: string | null = null,
    providerMessageId?: string,
    provider?: string,
  ): Promise<void> {
    await supabase.from("notifications").insert({
      user_id: input.userId,
      template_key: template!.key,
      channel,
      event_type: input.event,
      title: subject,
      body,
      action_url: input.actionUrl ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      status,
      failure_reason: failureReason,
      provider: provider ?? null,
      provider_message_id: providerMessageId ?? null,
      sent_at: status === "SENT" ? new Date().toISOString() : null,
    });
  }

  return { delivered, skipped };
}

interface PreferenceRow {
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;
}

function channelAllowedByPreference(
  channel: NotificationChannel,
  preferences: PreferenceRow | null,
): boolean {
  // No preference row yet: fall back to the conservative default of in-app and
  // email only. SMS and WhatsApp require explicit opt-in.
  if (!preferences) return channel === "IN_APP" || channel === "EMAIL";

  switch (channel) {
    case "IN_APP":
      return preferences.in_app_enabled;
    case "EMAIL":
      return preferences.email_enabled;
    case "SMS":
      return preferences.sms_enabled;
    case "WHATSAPP":
      return preferences.whatsapp_enabled;
    case "PUSH":
      return preferences.push_enabled;
    default:
      return false;
  }
}

/** Notify several users of the same event — e.g. offering a visit to agents. */
export async function notifyMany(
  userIds: readonly string[],
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...input, userId })));
}
