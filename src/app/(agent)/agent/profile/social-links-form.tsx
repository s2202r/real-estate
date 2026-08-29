"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAgentSocialLinks } from "@/lib/actions/agent-profile";
import { PLATFORM_LABELS, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/domain/social";
import { appConfig } from "@/config/app";
import type { ActionResult } from "@/lib/actions/leads";

const PLACEHOLDERS: Record<SocialPlatform, string> = {
  website: "https://your-agency.in",
  instagram: "https://instagram.com/your-handle",
  youtube: "https://youtube.com/@your-channel",
  linkedin: "https://linkedin.com/in/your-name",
  facebook: "https://facebook.com/your-page",
};

/**
 * Where an agent adds their own links.
 *
 * The copy is deliberate about what these are worth: they help a customer see
 * an agent's work, and they are not verification. An agent who reads this
 * should not expect a badge for filling it in.
 */
export function SocialLinksForm({
  current,
}: {
  current: Readonly<Partial<Record<SocialPlatform, string>>>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateAgentSocialLinks,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customers see these on your public profile, labelled as your own links. They are not
        checked by {appConfig.name} and do not affect your verification badges — those are granted
        after review.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((platform) => (
          <div key={platform} className="space-y-1.5">
            <Label htmlFor={platform}>{PLATFORM_LABELS[platform]}</Label>
            <Input
              id={platform}
              name={platform}
              type="url"
              inputMode="url"
              defaultValue={current[platform] ?? ""}
              placeholder={PLACEHOLDERS[platform]}
              aria-invalid={Boolean(state?.fieldErrors?.[platform])}
            />
            {state?.fieldErrors?.[platform] && (
              <p className="text-xs text-destructive">{state.fieldErrors[platform][0]}</p>
            )}
          </div>
        ))}
      </div>

      {state && (
        <p
          className={
            state.ok
              ? "rounded-md bg-success-muted p-3 text-sm text-success"
              : "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          }
          role="status"
        >
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        Save links
      </Button>
    </form>
  );
}
