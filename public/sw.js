/**
 * GetMeSpace service worker.
 *
 * Hand-written rather than generated, because the caching rules here are a
 * PRIVACY decision as much as a performance one and they need to be readable.
 *
 * WHAT IS CACHED
 *   - The app shell: the offline page and the icons. Precached on install.
 *   - Immutable build output under /_next/static/, which is content-hashed and
 *     can never go stale. Cache-first.
 *
 * WHAT IS NEVER CACHED — and why
 *   - HTML. Every page on this site is either personalised (a dashboard, a
 *     lead, a customer's contact details) or changes often (search results,
 *     listing status). A cached page could show one visitor another's data
 *     after a device is handed over, or show a listing that has since been
 *     suspended. Navigations therefore go to the network, and fall back to the
 *     offline page only when the network is genuinely unavailable.
 *   - Anything under /api/ or /auth/. Responses there are per-session by
 *     definition, and tokens must never touch disk.
 *   - Cross-origin requests. Listing photography comes from an image CDN with
 *     its own cache headers; storing opaque responses here would consume the
 *     origin's quota for no benefit.
 *   - Any request that is not a GET.
 */

const VERSION = "v1";
const SHELL_CACHE = `gms-shell-${VERSION}`;
const STATIC_CACHE = `gms-static-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 cannot fail the whole install and leave the
      // worker permanently un-installed.
      await Promise.all(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {})),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("gms-") && key !== SHELL_CACHE && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );
      // Safe to take over open pages immediately: nothing but hashed, immutable
      // assets is served from cache, so an old page cannot be handed new HTML.
      await self.clients.claim();
    })(),
  );
});

/** Requests this worker deliberately stays out of. */
function isExcluded(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/image") ||
    url.searchParams.has("_rsc")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isExcluded(url)) return;

  // Navigations: network, with the offline page as the fallback. Never cached.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ??
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  // Build output is content-hashed: if the URL matches, the bytes match.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;

        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  // Icons and the manifest: serve fast, refresh in the background.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit);
        return hit ?? network;
      })(),
    );
  }
});

/**
 * Clear everything on sign-out.
 *
 * The page posts this when a session ends, so a shared device does not keep
 * one person's cached build assets warm under the next person's session. HTML
 * is never cached, so there is no personal data to purge — this is belt and
 * braces.
 */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_CACHES") return;
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("gms-")).map((key) => caches.delete(key)));
    })(),
  );
});
