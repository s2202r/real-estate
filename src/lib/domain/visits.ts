/**
 * Visit scheduling rules.
 *
 * Pure functions: no I/O, no clock of their own — `now` is always passed in, so
 * every rule here is deterministic and testable, and the same code can run in
 * the browser (to disable slots) and on the server (to reject them).
 *
 * The rule this file exists for: a site visit needs LEAD TIME. An agent has to
 * see the request, accept it, and physically travel; a slot forty minutes from
 * now is a promise the network cannot keep, and a customer who turns up to an
 * empty flat does not come back.
 */

/**
 * Minutes between a local wall-clock time in an IANA zone and UTC.
 *
 * Derived from `Intl` rather than hard-coded to +05:30, so a deployment in a
 * zone that observes DST gets the right answer on both sides of the change.
 */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
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
  // What the wall clock in that zone reads, expressed as if it were UTC.
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

/**
 * The instant a `YYYY-MM-DD` + `HH:mm` pair refers to in the given zone.
 *
 * Returns null when either part is malformed, so callers can report a field
 * error rather than reasoning about an Invalid Date.
 */
export function localDateTimeToInstant(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;

  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time.split(":").map(Number) as [number, number];

  // First guess: treat the wall clock as UTC, then correct by the zone's offset
  // at that moment. One correction pass is enough for every real zone, because
  // the offset is stable across the small shift it introduces.
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const offset = zoneOffsetMinutes(new Date(naive), timeZone);
  const corrected = new Date(naive - offset * 60_000);

  // Around a DST boundary the first correction can land in the other offset;
  // re-check once and use the offset that actually applies at the result.
  const secondOffset = zoneOffsetMinutes(corrected, timeZone);
  return secondOffset === offset ? corrected : new Date(naive - secondOffset * 60_000);
}

/** The earliest instant a visit may be booked for. */
export function earliestVisitInstant(now: Date, leadTimeHours: number): Date {
  return new Date(now.getTime() + leadTimeHours * 3_600_000);
}

/**
 * The earliest date (`YYYY-MM-DD`, in the platform zone) a visit can fall on.
 *
 * Used for the `min` attribute on the date input, so the picker cannot offer a
 * day that the rule would reject outright.
 */
export function earliestVisitDate(now: Date, leadTimeHours: number, timeZone: string): string {
  const earliest = earliestVisitInstant(now, leadTimeHours);
  // en-CA formats as YYYY-MM-DD, which is what a date input expects.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(earliest);
}

/**
 * The earliest time (`HH:mm`) selectable on a given date, or null when the
 * whole day is open. Lets the form narrow the time input on the first
 * available day instead of failing on submit.
 */
export function earliestVisitTimeOn(
  date: string,
  now: Date,
  leadTimeHours: number,
  timeZone: string,
): string | null {
  if (date !== earliestVisitDate(now, leadTimeHours, timeZone)) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(earliestVisitInstant(now, leadTimeHours));
}

export interface VisitSlotCheck {
  readonly ok: boolean;
  /** Present only when `ok` is false. */
  readonly reason?: string;
}

/**
 * Is this slot far enough ahead?
 *
 * The single rule the server enforces and the form mirrors. A client can only
 * ever be a convenience here — this same check runs in the action.
 */
export function checkVisitSlot(
  date: string,
  time: string,
  now: Date,
  leadTimeHours: number,
  timeZone: string,
): VisitSlotCheck {
  const requested = localDateTimeToInstant(date, time, timeZone);
  if (!requested) return { ok: false, reason: "Choose a valid date and time." };

  if (requested.getTime() < earliestVisitInstant(now, leadTimeHours).getTime()) {
    return {
      ok: false,
      reason: `Site visits need at least ${leadTimeHours} hours' notice so an agent can confirm and travel. Choose a later slot.`,
    };
  }

  return { ok: true };
}
