/**
 * Hosts allowed to be embedded in an iframe.
 *
 * ONE list, used twice: the Content Security Policy's `frame-src` is built
 * from it, and the gallery checks against it before rendering an iframe. That
 * matters — when the two disagree, the UI renders a frame the browser then
 * refuses, and the visitor gets Chrome's "This content is blocked. Contact the
 * site owner to fix the issue." with no way to reach the tour.
 *
 * Agents supply these URLs, so the list is also a security boundary: an
 * arbitrary URL in an iframe is somebody else's page rendered under this
 * origin's name. Anything not on the list opens in a new tab instead, which is
 * unambiguous about whose site the visitor is on.
 *
 * `EMBED_ALLOWED_HOSTS` adds to it (comma-separated), so a deployment can
 * support a tour provider this list has not heard of without a code change.
 * It is read at build time, because the CSP header is built then.
 */

/** Providers a real-estate tour is plausibly hosted on. */
export const DEFAULT_EMBED_HOSTS = [
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.instagram.com", // reel embeds
  "my.matterport.com",
  "kuula.co",
  "www.google.com", // Maps embeds
] as const;

export function embedHosts(): string[] {
  const extra = (process.env.EMBED_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set([...DEFAULT_EMBED_HOSTS, ...extra])];
}

/** The `frame-src` value, so the policy cannot drift from the check below. */
export function frameSrcValue(): string {
  return ["'self'", ...embedHosts().map((host) => `https://${host}`)].join(" ");
}

/**
 * Can this URL be shown in an iframe?
 *
 * Requires https and a host on the list. A malformed URL is not embeddable
 * rather than an error — an agent typing a bad URL should not break the page.
 */
export function isEmbeddable(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return embedHosts().includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
