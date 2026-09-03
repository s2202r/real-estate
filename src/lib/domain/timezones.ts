/**
 * Timezones an NRI buyer is likely to be in.
 *
 * A full IANA list is around six hundred entries and is a worse control than a
 * short one: somebody in Dubai should find their zone in one glance, not scroll
 * past Antarctica. These are the corridors that account for nearly all Indian
 * property bought from abroad, plus India itself.
 *
 * `isKnownTimeZone` deliberately validates against `Intl` rather than against
 * this list, so a zone typed or stored outside the picker is accepted when the
 * renderer can genuinely format it. The list narrows what is OFFERED; Intl
 * decides what is VALID. Rejecting a real zone because it is not in a curated
 * array would be the wrong failure.
 */

export interface TimeZoneOption {
  readonly id: string;
  readonly label: string;
  readonly region: string;
}

export const NRI_TIME_ZONES: readonly TimeZoneOption[] = [
  { id: "Asia/Kolkata", label: "India (IST)", region: "India" },

  { id: "Asia/Dubai", label: "Dubai, Abu Dhabi (GST)", region: "Gulf" },
  { id: "Asia/Riyadh", label: "Riyadh (AST)", region: "Gulf" },
  { id: "Asia/Qatar", label: "Doha", region: "Gulf" },
  { id: "Asia/Kuwait", label: "Kuwait City", region: "Gulf" },
  { id: "Asia/Bahrain", label: "Manama", region: "Gulf" },
  { id: "Asia/Muscat", label: "Muscat", region: "Gulf" },

  { id: "Asia/Singapore", label: "Singapore", region: "Asia Pacific" },
  { id: "Asia/Hong_Kong", label: "Hong Kong", region: "Asia Pacific" },
  { id: "Asia/Tokyo", label: "Tokyo", region: "Asia Pacific" },
  { id: "Australia/Sydney", label: "Sydney, Melbourne", region: "Asia Pacific" },
  { id: "Australia/Perth", label: "Perth", region: "Asia Pacific" },
  { id: "Pacific/Auckland", label: "Auckland", region: "Asia Pacific" },

  { id: "Europe/London", label: "London (GMT/BST)", region: "Europe" },
  { id: "Europe/Dublin", label: "Dublin", region: "Europe" },
  { id: "Europe/Zurich", label: "Zurich", region: "Europe" },
  { id: "Europe/Berlin", label: "Frankfurt, Berlin", region: "Europe" },
  { id: "Europe/Amsterdam", label: "Amsterdam", region: "Europe" },

  { id: "America/New_York", label: "New York, Toronto (ET)", region: "Americas" },
  { id: "America/Chicago", label: "Chicago, Dallas (CT)", region: "Americas" },
  { id: "America/Denver", label: "Denver (MT)", region: "Americas" },
  { id: "America/Los_Angeles", label: "San Francisco, Seattle (PT)", region: "Americas" },
  { id: "America/Vancouver", label: "Vancouver", region: "Americas" },

  { id: "Africa/Nairobi", label: "Nairobi", region: "Africa" },
  { id: "Africa/Johannesburg", label: "Johannesburg", region: "Africa" },
  { id: "Africa/Lagos", label: "Lagos", region: "Africa" },
] as const;

/** The regions, in the order the picker should group them. */
export const TIME_ZONE_REGIONS = [
  "India",
  "Gulf",
  "Asia Pacific",
  "Europe",
  "Americas",
  "Africa",
] as const;

/**
 * Whether the runtime can format dates in this zone.
 *
 * Asks the FORMATTER, not `Intl.supportedValuesOf("timeZone")`. That list
 * holds only canonical zone ids, and IANA aliases are absent from it: on Node
 * 22 it contains "Asia/Calcutta" and not "Asia/Kolkata", so a membership check
 * rejects India's own zone while `DateTimeFormat` renders it without
 * complaint. Half the zones anyone would actually type are aliases.
 *
 * The formatter throws a RangeError on a zone it cannot use, which is exactly
 * the question worth answering: can a date be rendered for this person.
 *
 * BARE ABBREVIATIONS ARE REJECTED even though ICU accepts them, because what
 * it accepts them AS is not what anyone means. "EST" resolves to
 * America/Panama — a zone with no daylight saving — so a customer in New York
 * who stored "EST" would be shown every summer visit an hour out. "IST" is
 * India, Ireland and Israel depending on who is speaking. An identifier that
 * only sometimes means what it says is not one to keep in a database, so only
 * Area/Location ids (and UTC) pass.
 */
export function isKnownTimeZone(zone: string | null | undefined): boolean {
  const value = zone?.trim();
  if (!value) return false;
  if (value !== "UTC" && !value.includes("/")) return false;

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** The zone to use, falling back to the platform's when the stored one is unusable. */
export function resolveTimeZone(stored: string | null | undefined, fallback: string): string {
  return isKnownTimeZone(stored) ? stored! : fallback;
}

/**
 * The same instant on two clocks, for a visit at a property in one country
 * booked by somebody in another.
 *
 * Returns null when the two zones show the same wall clock, because there is
 * nothing to disambiguate and a second identical time on screen is noise.
 */
export function describeInBothZones(
  instant: Date,
  propertyZone: string,
  viewerZone: string,
  locale = "en-IN",
): { property: string; viewer: string } | null {
  if (!isKnownTimeZone(propertyZone) || !isKnownTimeZone(viewerZone)) return null;

  const format = (zone: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(instant);

  const property = format(propertyZone);
  const viewer = format(viewerZone);

  return property === viewer ? null : { property, viewer };
}

/** Offset between two zones at an instant, in minutes. Positive: viewer ahead. */
export function offsetMinutesBetween(instant: Date, from: string, to: string): number {
  return zoneOffset(instant, to) - zoneOffset(instant, from);
}

function zoneOffset(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );

  return (asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000;
}
