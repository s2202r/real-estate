/**
 * Social links and short-form video.
 *
 * Pure: no I/O, so every rule here is testable, and the same functions run in
 * the agent's form (to reject a bad link as they type) and on the server (to
 * reject it again when they submit).
 *
 * Two jobs:
 *
 *  1. Validate an agent's self-declared profile links. A field labelled
 *     "Instagram" that accepts any URL is a way to launder an arbitrary link
 *     through a trusted-looking label, so each platform only accepts its own
 *     hosts.
 *
 *  2. Turn a watch/share URL for a Reel or a Short into the embed URL its
 *     provider actually serves in an iframe.
 */

export const SOCIAL_PLATFORMS = [
  "website",
  "instagram",
  "youtube",
  "linkedin",
  "facebook",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Hosts each platform's links must sit on. `website` accepts any host. */
const PLATFORM_HOSTS: Record<Exclude<SocialPlatform, "website">, readonly string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  linkedin: ["linkedin.com", "www.linkedin.com", "in.linkedin.com"],
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "m.facebook.com"],
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  website: "Website",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  facebook: "Facebook",
};

/**
 * Validate and tidy a profile link.
 *
 * Returns null for anything empty or unusable, so a caller can store null
 * rather than an empty string. https only: an http link in a profile is a
 * downgrade the visitor did not ask for.
 */
export function normaliseSocialUrl(
  platform: SocialPlatform,
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return null;

  // A bare handle or hostname is what people paste most often.
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^@/, "")}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    // Upgrade rather than reject: the host is what matters, and every one of
    // these platforms serves https.
    url.protocol = "https:";
  }

  if (platform !== "website") {
    const host = url.hostname.toLowerCase();
    if (!PLATFORM_HOSTS[platform].includes(host)) return null;
  }

  // Tracking parameters follow these links around; none of them belong in a
  // profile the platform republishes.
  url.search = "";
  url.hash = "";

  const cleaned = url.toString().replace(/\/$/, "");
  return cleaned.length <= 300 ? cleaned : null;
}

/** The id in a YouTube URL, whether it is a watch link, a share link or a Short. */
export function youTubeId(url: string): string | null {
  const match = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{6,})/.exec(url);
  return match?.[1] ?? null;
}

/** The shortcode in an Instagram reel or post URL. */
export function instagramCode(url: string): string | null {
  const match = /instagram\.com\/(?:reels?|p|tv)\/([A-Za-z0-9_-]{5,})/.exec(url);
  return match?.[1] ?? null;
}

export type EmbeddableKind = "YOUTUBE" | "YOUTUBE_SHORT" | "INSTAGRAM_REEL";

export interface VideoEmbed {
  readonly kind: EmbeddableKind;
  readonly src: string;
  /** Short-form video is filmed vertically; a 16:9 frame letterboxes it badly. */
  readonly vertical: boolean;
}

/**
 * Turn a pasted video URL into something that can be framed.
 *
 * Returns null when the URL is not a supported video, so the caller can offer
 * a link instead of rendering a frame the browser will refuse.
 */
export function toVideoEmbed(raw: string | null | undefined): VideoEmbed | null {
  const value = raw?.trim();
  if (!value) return null;

  const code = instagramCode(value);
  if (code) {
    // Instagram serves reels in an iframe at /reel/<code>/embed.
    return {
      kind: "INSTAGRAM_REEL",
      src: `https://www.instagram.com/reel/${code}/embed`,
      vertical: true,
    };
  }

  const id = youTubeId(value);
  if (id) {
    const isShort = /\/shorts\//.test(value);
    return {
      // youtube-nocookie keeps the tracking cookie off the page until play.
      kind: isShort ? "YOUTUBE_SHORT" : "YOUTUBE",
      src: `https://www.youtube-nocookie.com/embed/${id}`,
      vertical: isShort,
    };
  }

  return null;
}
