"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A progress bar for page navigation.
 *
 * The problem it solves is not slowness, it is SILENCE. A server-rendered page
 * takes a moment to arrive, and in that moment nothing on screen changes — so
 * people conclude the click missed and click again, and again. The bar is the
 * acknowledgement: something happened, it is happening now.
 *
 * WHY AN EXTERNAL STORE. The pending state does not belong to React — it is
 * started by a DOM click listener and ended by the router. Keeping it in a
 * module store read through `useSyncExternalStore` means no `setState` inside
 * an effect, which the React compiler rightly objects to, and it means the
 * click handler can start the bar in the same tick as the click rather than a
 * render later.
 *
 * It deliberately does not try to be accurate. Real progress is unknowable, so
 * the bar eases towards 90% and only completes when the route actually
 * changes. A bar that reached 100% and then waited would be a lie.
 */

type Listener = () => void;

const store = {
  pending: false,
  listeners: new Set<Listener>(),

  subscribe(listener: Listener) {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },

  snapshot() {
    return store.pending;
  },

  set(pending: boolean) {
    if (store.pending === pending) return;
    store.pending = pending;
    for (const listener of store.listeners) listener();
  },
};

/** Server render has no navigation in flight, ever. */
const serverSnapshot = () => false;

/**
 * The route the app is currently showing, as `pathname?query`.
 *
 * Kept outside React because the popstate listener needs it synchronously, at
 * a moment when the browser has already changed `window.location` but React
 * has not re-rendered. Comparing the two is how a hash move is told apart from
 * a real navigation.
 */
let committedRoute = "";

function routeKey(pathname: string, search: string): string {
  return `${pathname}?${search.replace(/^\?/, "")}`;
}

export function RouteProgress() {
  const pending = useSyncExternalStore(store.subscribe, store.snapshot, serverSnapshot);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Start on a click that will actually navigate.
   *
   * Captured at the document, so it covers every link on the site including
   * ones rendered by components that know nothing about this. The exclusions
   * are the cases where the browser does something other than an in-app
   * navigation, and showing a bar for those would be a lie that never clears.
   */
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      // A modifier means a new tab or a download: this page is not going
      // anywhere.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.hasAttribute("download") || anchor.target === "_blank") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // Same page, different anchor: no navigation, just a scroll.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      store.set(true);
    }

    /**
     * Back and forward are navigations too, and can be just as slow.
     *
     * But popstate ALSO fires for a same-page fragment move — clicking a
     * table-of-contents link on the legal pages, for instance. That changes no
     * route, so nothing would ever clear the bar and it would sit there until
     * the safety timeout. By popstate the URL has already changed, so the
     * comparison is against the route React last committed.
     */
    function onPopState() {
      if (routeKey(window.location.pathname, window.location.search) === committedRoute) return;
      store.set(true);
    }

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  /**
   * Finish when the route has actually changed.
   *
   * `usePathname` and `useSearchParams` update once the new page is committed,
   * which is exactly the moment the bar should complete — not when the request
   * was sent.
   */
  useEffect(() => {
    committedRoute = routeKey(pathname, searchParams.toString());
    store.set(false);
  }, [pathname, searchParams]);

  /**
   * And finish anyway if nothing happens.
   *
   * A navigation can be abandoned — a redirect back to the same URL, a link to
   * a file the browser downloads instead, a route that throws. A bar left
   * spinning forever is worse than no bar, because it teaches people to ignore
   * it.
   */
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => store.set(false), 15_000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  /**
   * A progress cursor over the whole page. Cheap, unmissable, and it says
   * "wait" in a way people already understand from every desktop application.
   */
  useEffect(() => {
    document.documentElement.classList.toggle("route-pending", pending);
    return () => document.documentElement.classList.remove("route-pending");
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-busy="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-primary/15"
    >
      <div className="route-progress-bar h-full bg-primary" />
    </div>
  );
}
