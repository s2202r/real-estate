"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { appConfig } from "@/config/app";

/**
 * "Add to home screen", offered once.
 *
 * The browser decides whether an install is possible and fires
 * `beforeinstallprompt` when it is; there is no way to ask for one otherwise,
 * and nothing renders until that event arrives. So this bar cannot appear on a
 * browser that cannot install the app, or on a device where it is already
 * installed.
 *
 * A dismissal is remembered, because a prompt that returns on every visit is
 * an advertisement, not an offer.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "gms:install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Storage can be blocked entirely; treat that as "not dismissed".
    }
    if (dismissed) return;

    const onPrompt = (event: Event) => {
      // Take control of when it is shown, rather than letting the browser
      // interrupt whatever the visitor is doing.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const remember = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not being able to remember is not a reason to fail the dismissal.
    }
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // Either way the event is spent; the browser fires a fresh one if it still
    // wants to offer an install later.
    setDeferred(null);
    remember();
  };

  const dismiss = () => {
    setDeferred(null);
    remember();
  };

  if (!deferred) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-xl border bg-card p-3 shadow-e3 sm:inset-x-auto sm:right-5"
      role="dialog"
      aria-label={`Install ${appConfig.name}`}
    >
      <div className="flex items-center gap-3">
        <LogoMark size={36} className="shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install {appConfig.name}</p>
          <p className="text-xs text-muted-foreground">
            Full screen, on your home screen. No app store.
          </p>
        </div>
        <Button size="sm" onClick={install}>
          <Download aria-hidden />
          Install
        </Button>
        <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Not now">
          <X />
        </Button>
      </div>
    </div>
  );
}
