import { AlertTriangle, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FeatureFlagToggle } from "./flag-toggle";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/config/env";
import { featureStatus, features, type FeatureKey } from "@/config/features";
import { appConfig } from "@/config/app";

export const metadata = { title: "Settings" };

/**
 * Platform settings.
 *
 * Feature flags have TWO layers: the environment is a ceiling, and the database
 * can only narrow it. A module disabled for the deployment cannot be switched
 * on from here — that gate lives in configuration, not in an admin's judgement
 * at 6pm on a Friday.
 *
 * A flag also has a third property, which this page used to hide: whether
 * anything is implemented behind it. Five were declared ahead of the work they
 * name, and showing those as "Blocked by environment" reads as a finished
 * feature being withheld by a variable. They now say what they are.
 */
export default async function AdminSettingsPage() {
  await requireCapability("settings.manage");
  const [flags, settings] = await Promise.all([getFlags(), getSettings()]);

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4" aria-hidden />
            Feature flags
          </CardTitle>
          <CardDescription>
            The environment sets the ceiling. A module disabled for this deployment cannot be
            enabled here — and a flag with nothing built behind it says so rather than pretending
            to be one variable away.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {flags.map((flag) => {
            const environmentAllows = features[flag.key as FeatureKey] ?? false;
            const status = featureStatus(flag.key);
            const unbuilt = status === "unbuilt";
            const alwaysOn = status === "always-on";

            return (
              <div
                key={flag.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{flag.label}</p>
                    <code className="tabular rounded bg-muted px-1.5 py-0.5 text-xs">
                      {flag.key}
                    </code>
                    {unbuilt ? (
                      <Badge variant="muted" size="sm">
                        Not built yet
                      </Badge>
                    ) : alwaysOn ? (
                      <Badge variant="info" size="sm">
                        Always on
                      </Badge>
                    ) : (
                      !environmentAllows && (
                        <Badge variant="destructive" size="sm">
                          Blocked by environment
                        </Badge>
                      )
                    )}
                  </div>
                  {flag.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{flag.description}</p>
                  )}
                  {unbuilt && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Nothing reads this flag. Turning it on would change nothing on the site — the
                      feature has still to be built.
                    </p>
                  )}
                  {alwaysOn && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Built and always available. The flag is left over and gates nothing.
                    </p>
                  )}
                </div>
                <FeatureFlagToggle
                  flagKey={flag.key}
                  enabled={flag.enabled && environmentAllows && !unbuilt}
                  locked={!environmentAllows || unbuilt || alwaysOn}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-warning/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-warning-foreground" aria-hidden />
            Legal and compliance
          </CardTitle>
          <CardDescription>
            Items requiring sign-off before this platform operates in production.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            The investor / exclusive-inventory module is <strong>enabled</strong>, and the legal
            review it was waiting on (LEGAL_REVIEW.md L1) is still open. A structure in which
            capital is placed against a property and an exit spread is captured can be
            characterised as an unregistered collective investment scheme, an agreement to sell
            attracting stamp duty, or a benami arrangement. It is implemented as configurable
            contractual marketing and distribution rights.
          </p>
          <p className="text-muted-foreground">
            What the flag does not affect: no exclusive-inventory agreement can reach ACTIVE
            without a recorded human legal review. That is a database CHECK constraint, not a
            convention, and it holds whether the module is on or off.
          </p>
          <Separator />
          <p className="text-muted-foreground">
            The grievance officer required under the Consumer Protection (E-Commerce) Rules 2020
            and the IT Rules 2021 must be appointed and published before launch. See the setting
            below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational settings</CardTitle>
          <CardDescription>
            Tuned per market. Every value has a safe default so the platform boots without them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {settings.map((setting) => (
              <div key={setting.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <dt className="text-sm font-medium">{setting.label}</dt>
                  {setting.description && (
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  )}
                  <code className="tabular text-[0.6875rem] text-muted-foreground">
                    {setting.key}
                  </code>
                </div>
                <dd className="tabular shrink-0 text-sm font-medium">
                  {JSON.stringify(setting.value)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deployment</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Product name</dt>
              <dd className="font-medium">{appConfig.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Default currency</dt>
              <dd className="font-medium">{appConfig.currency}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Default country</dt>
              <dd className="font-medium">{appConfig.country}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Timezone</dt>
              <dd className="font-medium">{appConfig.timezone}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

interface FlagRow {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
}

async function getFlags(): Promise<FlagRow[]> {
  if (!isSupabaseConfigured()) {
    return Object.entries(features).map(([key, enabled]) => ({
      key,
      label: key,
      description: null,
      enabled,
    }));
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("key, label, description, enabled")
    .order("key", { ascending: true });
  return (data ?? []) as FlagRow[];
}

interface SettingRow {
  key: string;
  label: string;
  description: string | null;
  value: unknown;
}

async function getSettings(): Promise<SettingRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_settings")
    .select("key, label, description, value")
    .order("category", { ascending: true });
  return (data ?? []) as SettingRow[];
}
