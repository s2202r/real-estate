import "server-only";

import { getServerEnv } from "@/config/env";
import { features } from "@/config/features";

/**
 * Notification providers.
 *
 * Business logic NEVER calls a provider. It dispatches a domain EVENT
 * ("visit.booked") to the dispatcher, which resolves the user's channel
 * preferences and consent, renders the template, and hands off to whichever
 * adapter is configured. Swapping Resend for SES, or MSG91 for Twilio, is a
 * configuration change — no service-layer code moves.
 *
 * SMS and WhatsApp ship as typed stubs behind feature flags because both
 * require regulatory groundwork in India before they may legally send:
 * TRAI DLT registration and WhatsApp Business template approval respectively
 * (docs/LEGAL_REVIEW.md L10).
 */

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";

export interface NotificationMessage {
  readonly to: { userId: string; email?: string | null; phone?: string | null };
  readonly subject?: string;
  readonly body: string;
  /**
   * Optional HTML alternative, for the few messages worth designing — a
   * six-digit code is unreadable as a run of plain text and has to be set apart
   * from the sentence around it. `body` is still sent as the text part, so a
   * client that refuses HTML gets something usable rather than nothing.
   */
  readonly html?: string;
  readonly templateKey?: string;
  readonly variables?: Record<string, string | number>;
  readonly actionUrl?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface DeliveryResult {
  readonly channel: NotificationChannel;
  readonly delivered: boolean;
  readonly providerMessageId?: string;
  readonly provider: string;
  readonly skippedReason?: string;
  readonly error?: string;
}

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  readonly name: string;
  /** False when the provider is not configured; the dispatcher then skips it. */
  isConfigured(): boolean;
  send(message: NotificationMessage): Promise<DeliveryResult>;
}

/* ------------------------------------------------------------------------ *
 * Email
 * ------------------------------------------------------------------------ */

class ConsoleEmailProvider implements NotificationProvider {
  readonly channel = "EMAIL" as const;
  readonly name = "console";

  isConfigured(): boolean {
    return true;
  }

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    // Development default: log rather than send, so a local environment never
    // emails a real person by accident.
    console.warn(
      `[email:console] to=${message.to.email ?? message.to.userId} subject=${message.subject ?? "(none)"}`,
    );
    return { channel: "EMAIL", delivered: true, provider: this.name };
  }
}

class ResendEmailProvider implements NotificationProvider {
  readonly channel = "EMAIL" as const;
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.from);
  }

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    if (!message.to.email) {
      return {
        channel: "EMAIL",
        delivered: false,
        provider: this.name,
        skippedReason: "No email address on file.",
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to.email],
          subject: message.subject ?? "Notification",
          text: message.body,
          ...(message.html ? { html: message.html } : {}),
        }),
      });

      if (!response.ok) {
        return {
          channel: "EMAIL",
          delivered: false,
          provider: this.name,
          error: `Provider responded ${response.status}`,
        };
      }

      const payload = (await response.json()) as { id?: string };
      return {
        channel: "EMAIL",
        delivered: true,
        provider: this.name,
        providerMessageId: payload.id,
      };
    } catch (error) {
      return {
        channel: "EMAIL",
        delivered: false,
        provider: this.name,
        error: error instanceof Error ? error.message : "Unknown transport error",
      };
    }
  }
}

/* ------------------------------------------------------------------------ *
 * Stub channels — interfaces exist so business logic can be written against
 * them today; the transport is added once the compliance work is done.
 * ------------------------------------------------------------------------ */

class UnconfiguredProvider implements NotificationProvider {
  constructor(
    readonly channel: NotificationChannel,
    readonly name: string,
    private readonly reason: string,
  ) {}

  isConfigured(): boolean {
    return false;
  }

  async send(): Promise<DeliveryResult> {
    return {
      channel: this.channel,
      delivered: false,
      provider: this.name,
      skippedReason: this.reason,
    };
  }
}

/* ------------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------------ */

function buildProviders(): Map<NotificationChannel, NotificationProvider> {
  const env = getServerEnv();
  const providers = new Map<NotificationChannel, NotificationProvider>();

  // In-app notifications are written directly to Postgres by the dispatcher,
  // so there is no external provider for that channel.

  providers.set(
    "EMAIL",
    env.EMAIL_PROVIDER === "resend"
      ? new ResendEmailProvider(env.EMAIL_PROVIDER_API_KEY ?? "", env.EMAIL_FROM ?? "")
      : new ConsoleEmailProvider(),
  );

  providers.set(
    "SMS",
    new UnconfiguredProvider(
      "SMS",
      env.SMS_PROVIDER,
      features.ENABLE_SMS
        ? "SMS provider is not implemented. TRAI DLT header and template registration is required first."
        : "SMS is disabled (ENABLE_SMS=false).",
    ),
  );

  providers.set(
    "WHATSAPP",
    new UnconfiguredProvider(
      "WHATSAPP",
      env.WHATSAPP_PROVIDER,
      features.ENABLE_WHATSAPP
        ? "WhatsApp provider is not implemented. Approved Business templates and opt-in are required first."
        : "WhatsApp is disabled (ENABLE_WHATSAPP=false).",
    ),
  );

  providers.set(
    "PUSH",
    new UnconfiguredProvider(
      "PUSH",
      env.PUSH_PROVIDER,
      features.ENABLE_PUSH ? "Push provider is not implemented." : "Push is disabled (ENABLE_PUSH=false).",
    ),
  );

  return providers;
}

let registry: Map<NotificationChannel, NotificationProvider> | null = null;

export function getNotificationProvider(
  channel: NotificationChannel,
): NotificationProvider | null {
  registry ??= buildProviders();
  return registry.get(channel) ?? null;
}

/** True when the channel is both enabled by flag and actually configured. */
export function isChannelAvailable(channel: NotificationChannel): boolean {
  if (channel === "IN_APP") return true;
  if (channel === "SMS" && !features.ENABLE_SMS) return false;
  if (channel === "WHATSAPP" && !features.ENABLE_WHATSAPP) return false;
  if (channel === "PUSH" && !features.ENABLE_PUSH) return false;
  return getNotificationProvider(channel)?.isConfigured() ?? false;
}

/** Substitute {{variable}} placeholders in a template body. */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number> = {},
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in variables ? String(variables[key]) : match,
  );
}
