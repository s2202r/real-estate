import { BadgeCheck, ShieldCheck, Star, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

/**
 * Verification badges.
 *
 * These are the platform's central trust claim, so the component deliberately
 * has no "custom label" escape hatch: a badge can only render one of the four
 * values the platform itself grants. An agent cannot invent "Premium Verified".
 * Each badge carries a tooltip explaining exactly what was checked, because a
 * trust signal nobody understands is decoration.
 */

type AgentBadge = Enums["agent_badge"];

const BADGE_CONFIG: Record<
  AgentBadge,
  { label: string; icon: LucideIcon; variant: "success" | "info" | "default" | "warning"; description: string }
> = {
  IDENTITY_VERIFIED: {
    label: "Identity Verified",
    icon: BadgeCheck,
    variant: "info",
    description:
      "Mobile number, email and a government identity document have been checked by the platform.",
  },
  RERA_VERIFIED: {
    label: "RERA Verified",
    icon: ShieldCheck,
    variant: "success",
    description:
      "A valid RERA agent registration was submitted and verified against the issuing state authority record.",
  },
  TRUSTED_AGENT: {
    label: "Trusted Agent",
    icon: Star,
    variant: "default",
    description:
      "Earned from completed transactions, customer ratings, response rate and visit reliability. It cannot be purchased or self-claimed.",
  },
  TOP_PERFORMER: {
    label: "Top Performer",
    icon: Trophy,
    variant: "warning",
    description:
      "Top of the network on closed transactions and customer ratings over the last 12 months.",
  },
};

export function VerificationBadge({
  badge,
  size = "default",
  showLabel = true,
  className,
}: {
  badge: AgentBadge;
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const config = BADGE_CONFIG[badge];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={config.variant} size={size} className={cn("cursor-help", className)}>
          <Icon aria-hidden />
          {showLabel && config.label}
          {!showLabel && <span className="sr-only">{config.label}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{config.label}</p>
        <p className="mt-1 text-background/80">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function VerificationBadgeList({
  badges,
  max = 3,
  size = "sm",
  className,
}: {
  badges: readonly AgentBadge[];
  max?: number;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  if (badges.length === 0) return null;
  const visible = badges.slice(0, max);
  const overflow = badges.length - visible.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map((badge) => (
        <VerificationBadge key={badge} badge={badge} size={size} />
      ))}
      {overflow > 0 && (
        <Badge variant="muted" size={size}>
          +{overflow}
        </Badge>
      )}
    </div>
  );
}

/** The listing-level "verified" chip shown on property cards. */
export function VerifiedListingBadge({ score }: { score?: number | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="success" className="cursor-help backdrop-blur">
          <BadgeCheck aria-hidden />
          Verified
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">Verified listing</p>
        <p className="mt-1 text-background/80">
          Reviewed and approved by the platform before publication
          {typeof score === "number" ? `. Completeness score ${Math.round(score)}/100.` : "."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
