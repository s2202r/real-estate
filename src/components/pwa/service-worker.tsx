"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Production only. In development the worker would cache build output that
 * changes on every save, and the resulting "why is my change not showing"
 * costs more time than it saves.
 *
 * Registration failure is swallowed on purpose: a service worker is an
 * enhancement, and a browser that refuses it (private mode, an unsupported
 * engine, a policy) must still get a working site.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Nothing to do: the site works without it.
      });
    };

    // After load, so registration never competes with the first paint for
    // bandwidth on a slow connection.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
