import { appConfig } from "@/config/app";
import { localDateTimeToInstant } from "@/lib/domain/visits";
import { describeInBothZones } from "@/lib/domain/timezones";

/**
 * When a visit is.
 *
 * A visit happens AT THE PROPERTY, so the appointment is a wall-clock time in
 * the property's own zone and stays that way — nothing here reschedules
 * anything. What it fixes is the ambiguity: "Saturday at 11:00" shown to
 * somebody in Dubai is a trap, because their 11:00 is not the one meant, and
 * they will either miss the call or think the agent did.
 *
 * The second line appears only when the two clocks genuinely differ, so an
 * Indian buyer sees exactly what they saw before.
 */
export function VisitTime({
  date,
  time,
  viewerTimeZone,
  className,
}: {
  /** `YYYY-MM-DD`, in the property's zone. */
  date: string;
  /** `HH:mm[:ss]`, in the property's zone. */
  time: string;
  /** The zone to show the second line in. Omit for the platform's own. */
  viewerTimeZone?: string;
  className?: string;
}) {
  const hhmm = time.slice(0, 5);
  const propertyZone = appConfig.timezone;

  const local = new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const instant = localDateTimeToInstant(date, hhmm, propertyZone);
  const both =
    instant && viewerTimeZone
      ? describeInBothZones(instant, propertyZone, viewerTimeZone)
      : null;

  return (
    <span className={className}>
      <span className="tabular">
        {local} at {hhmm}
      </span>
      {both && (
        <span className="mt-0.5 block text-xs">
          {/* Named explicitly on both lines. "Your time" alone leaves the
              first line's zone to be guessed at. */}
          <span className="tabular">{both.viewer}</span> your time ·{" "}
          <span className="tabular">{both.property}</span> at the property
        </span>
      )}
    </span>
  );
}
