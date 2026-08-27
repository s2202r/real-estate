"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toggleFeatureFlag } from "@/lib/actions/admin";

export function FeatureFlagToggle({
  flagKey,
  enabled,
  locked,
}: {
  flagKey: string;
  enabled: boolean;
  locked: boolean;
}) {
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (locked) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Locked
      </span>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Switch
        checked={checked}
        disabled={pending}
        aria-label={`Toggle ${flagKey}`}
        onCheckedChange={(next) => {
          setChecked(next);
          setError(null);
          startTransition(async () => {
            const result = await toggleFeatureFlag(flagKey, next);
            if (!result.ok) {
              setChecked(!next);
              setError(result.message);
            }
          });
        }}
      />
      {error && <p className="max-w-48 text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}
