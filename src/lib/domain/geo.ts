/**
 * Geospatial helpers.
 *
 * Pure trigonometry: no map provider, no network. The map PROVIDER is an
 * abstraction in lib/providers; distance maths belongs here so that visit
 * geofencing stays testable and free of vendor coupling.
 */

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function isValidCoordinates(value: Partial<Coordinates> | null | undefined): value is Coordinates {
  return (
    value != null &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  return distanceMeters(a, b) / 1000;
}

/**
 * Whether a reported position falls inside the geofence around a property.
 *
 * `accuracyMeters` is honoured because a phone reporting ±50 m should not fail
 * a 200 m fence on a technicality, and should not pass a 20 m fence on luck.
 */
export function isWithinGeofence(
  reported: Coordinates,
  target: Coordinates,
  radiusMeters: number,
  accuracyMeters = 0,
): { within: boolean; distanceMeters: number } {
  const distance = distanceMeters(reported, target);
  return {
    within: distance - Math.max(0, accuracyMeters) <= radiusMeters,
    distanceMeters: Math.round(distance * 100) / 100,
  };
}

/** Bounding box for a radius search — lets Postgres use a plain b-tree index. */
export function boundingBox(
  center: Coordinates,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 110.574;
  const cosLat = Math.cos(toRadians(center.latitude));
  // Near the poles the longitude delta explodes; clamp to the whole range.
  const lngDelta = Math.abs(cosLat) < 1e-6 ? 180 : radiusKm / (111.32 * Math.abs(cosLat));

  return {
    minLat: Math.max(-90, center.latitude - latDelta),
    maxLat: Math.min(90, center.latitude + latDelta),
    minLng: Math.max(-180, center.longitude - lngDelta),
    maxLng: Math.min(180, center.longitude + lngDelta),
  };
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
