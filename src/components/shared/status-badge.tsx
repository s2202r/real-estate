import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Enums } from "@/types/database";

/**
 * Status badges.
 *
 * One place decides how every lifecycle status looks, so "VERIFIED" is the same
 * green in the admin queue, the agent dashboard and the public card. The colour
 * mapping is meaning-driven: green is live/settled, amber is waiting on someone,
 * red is refused, grey is inert.
 */

type Variant = NonNullable<BadgeProps["variant"]>;

function humanise(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

const LISTING_VARIANTS: Record<Enums["listing_status"], Variant> = {
  DRAFT: "muted",
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
  VERIFIED: "success",
  REJECTED: "destructive",
  SUSPENDED: "destructive",
  EXPIRED: "muted",
  SOLD: "info",
  RENTED: "info",
};

const LEAD_VARIANTS: Record<Enums["lead_stage"], Variant> = {
  NEW: "info",
  CONTACTED: "info",
  QUALIFIED: "default",
  PROPERTY_SHARED: "default",
  VISIT_REQUESTED: "warning",
  VISIT_SCHEDULED: "warning",
  VISIT_COMPLETED: "default",
  INTERESTED: "success",
  NEGOTIATION: "success",
  BOOKING: "success",
  CLOSED_WON: "success",
  CLOSED_LOST: "muted",
  FOLLOW_UP: "warning",
};

const VISIT_VARIANTS: Record<Enums["visit_status"], Variant> = {
  REQUESTED: "warning",
  OFFERED: "warning",
  ASSIGNED: "info",
  CONFIRMED: "info",
  IN_PROGRESS: "default",
  COMPLETED: "default",
  QUALIFIED: "success",
  CANCELLED: "muted",
  NO_SHOW: "destructive",
  EXPIRED: "muted",
  REJECTED: "destructive",
};

const DEAL_VARIANTS: Record<Enums["deal_status"], Variant> = {
  INITIATED: "info",
  NEGOTIATION: "warning",
  AGREED: "default",
  BOOKED: "default",
  AGREEMENT_SIGNED: "default",
  REGISTRATION_PENDING: "warning",
  CLOSED_WON: "success",
  CLOSED_LOST: "muted",
  CANCELLED: "muted",
  DISPUTED: "destructive",
};

const COMMISSION_VARIANTS: Record<Enums["commission_status"], Variant> = {
  PENDING: "muted",
  CALCULATED: "info",
  APPROVED: "default",
  PAYMENT_PROCESSING: "warning",
  PAID: "success",
  DISPUTED: "destructive",
  CANCELLED: "muted",
};

const VERIFICATION_VARIANTS: Record<Enums["verification_status"], Variant> = {
  NOT_SUBMITTED: "muted",
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  EXPIRED: "muted",
};

const DISPUTE_VARIANTS: Record<Enums["dispute_status"], Variant> = {
  OPEN: "warning",
  UNDER_REVIEW: "info",
  RESOLVED: "success",
  REJECTED: "muted",
  ESCALATED: "destructive",
};

export type StatusKind =
  | "listing" | "lead" | "visit" | "deal" | "commission" | "verification" | "dispute";

const VARIANT_MAPS: Record<StatusKind, Record<string, Variant>> = {
  listing: LISTING_VARIANTS,
  lead: LEAD_VARIANTS,
  visit: VISIT_VARIANTS,
  deal: DEAL_VARIANTS,
  commission: COMMISSION_VARIANTS,
  verification: VERIFICATION_VARIANTS,
  dispute: DISPUTE_VARIANTS,
};

export function StatusBadge({
  kind,
  status,
  size = "sm",
  className,
}: {
  kind: StatusKind;
  status: string;
  size?: BadgeProps["size"];
  className?: string;
}) {
  const variant = VARIANT_MAPS[kind][status] ?? "muted";
  return (
    <Badge variant={variant} size={size} className={className}>
      {humanise(status)}
    </Badge>
  );
}
