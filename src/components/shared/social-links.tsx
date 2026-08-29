import { ExternalLink, Facebook, Globe, Instagram, Linkedin, Youtube } from "lucide-react";
import { PLATFORM_LABELS, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/domain/social";
import { appConfig } from "@/config/app";
import { cn } from "@/lib/utils";

/**
 * An agent's own links.
 *
 * The wording here is the point. Verification badges are granted by the
 * platform after review and can never be self-claimed (§13); these links are
 * typed in by the agent. Presenting them in the same visual language as a
 * badge would let anyone manufacture the appearance of trust by pasting a URL.
 *
 * So they sit apart, are labelled as the agent's own, and open in a new tab —
 * the visitor should be in no doubt they have left this site and are looking
 * at something the agent controls.
 */
const ICONS: Record<SocialPlatform, typeof Globe> = {
  website: Globe,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  facebook: Facebook,
};

export function SocialLinks({
  links,
  className,
}: {
  links: Readonly<Partial<Record<SocialPlatform, string>>>;
  className?: string;
}) {
  const present = SOCIAL_PLATFORMS.filter((platform) => links[platform]);
  if (present.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">
        Links this agent added themselves.{" "}
        <span className="font-medium text-foreground">Not verified by {appConfig.name}</span> — the
        badges above are the ones granted after review.
      </p>

      <ul className="flex flex-wrap gap-2">
        {present.map((platform) => {
          const Icon = ICONS[platform];
          return (
            <li key={platform}>
              <a
                href={links[platform]}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-accent"
              >
                <Icon className="size-3.5" aria-hidden />
                {PLATFORM_LABELS[platform]}
                <ExternalLink className="size-3 opacity-50" aria-hidden />
                <span className="sr-only">(opens on {PLATFORM_LABELS[platform]})</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
