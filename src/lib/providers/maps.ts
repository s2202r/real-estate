import "server-only";

import { clientEnv, getServerEnv } from "@/config/env";
import type { Coordinates } from "@/lib/domain/geo";

/**
 * Map provider abstraction.
 *
 * The application asks for geocoding, place lookup and static map URLs; it
 * never imports a vendor SDK. Keys come from the environment and are split:
 * a referrer-restricted BROWSER key and an IP-restricted SERVER key, so a
 * leaked client key cannot be used to run up server-side quota.
 */

export interface GeocodeResult {
  readonly formattedAddress: string;
  readonly coordinates: Coordinates;
  readonly placeId?: string;
  readonly locality?: string;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly country?: string;
}

export interface NearbyPlaceResult {
  readonly name: string;
  readonly placeId?: string;
  readonly type: string;
  readonly coordinates: Coordinates;
  readonly distanceKm: number;
}

export interface MapProvider {
  readonly name: string;
  isConfigured(): boolean;
  geocode(address: string): Promise<GeocodeResult | null>;
  reverseGeocode(coordinates: Coordinates): Promise<GeocodeResult | null>;
  findNearby(
    coordinates: Coordinates,
    type: string,
    radiusMeters: number,
  ): Promise<NearbyPlaceResult[]>;
  staticMapUrl(coordinates: Coordinates, options?: { zoom?: number; width?: number; height?: number }): string | null;
  directionsUrl(coordinates: Coordinates, label?: string): string;
}

/**
 * The no-op provider. Used when no key is configured.
 *
 * It still returns a WORKING directions URL, because a plain Google Maps deep
 * link needs no API key — so "open in maps" keeps working on a deployment with
 * no maps budget at all.
 */
class NoopMapProvider implements MapProvider {
  readonly name = "none";

  isConfigured(): boolean {
    return false;
  }

  async geocode(): Promise<GeocodeResult | null> {
    return null;
  }

  async reverseGeocode(): Promise<GeocodeResult | null> {
    return null;
  }

  async findNearby(): Promise<NearbyPlaceResult[]> {
    return [];
  }

  staticMapUrl(): string | null {
    return null;
  }

  directionsUrl(coordinates: Coordinates, label?: string): string {
    const query = `${coordinates.latitude},${coordinates.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${
      label ? `&query_place_id=${encodeURIComponent(label)}` : ""
    }`;
  }
}

interface GoogleGeocodeComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

class GoogleMapProvider implements MapProvider {
  readonly name = "google";

  constructor(
    private readonly serverKey: string,
    private readonly browserKey: string,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.serverKey);
  }

  async geocode(address: string): Promise<GeocodeResult | null> {
    if (!this.isConfigured()) return null;

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("region", "in");
    url.searchParams.set("key", this.serverKey);

    try {
      const response = await fetch(url, { next: { revalidate: 86_400 } });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        status: string;
        results?: {
          formatted_address: string;
          place_id: string;
          geometry: { location: { lat: number; lng: number } };
          address_components: GoogleGeocodeComponent[];
        }[];
      };

      const first = data.results?.[0];
      if (data.status !== "OK" || !first) return null;

      return {
        formattedAddress: first.formatted_address,
        coordinates: { latitude: first.geometry.location.lat, longitude: first.geometry.location.lng },
        placeId: first.place_id,
        locality: component(first.address_components, "sublocality_level_1", "sublocality", "neighborhood"),
        city: component(first.address_components, "locality", "administrative_area_level_3"),
        state: component(first.address_components, "administrative_area_level_1"),
        pincode: component(first.address_components, "postal_code"),
        country: component(first.address_components, "country"),
      };
    } catch {
      // A map outage must never break listing creation; the agent can enter
      // coordinates manually.
      return null;
    }
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodeResult | null> {
    if (!this.isConfigured()) return null;
    return this.geocode(`${coordinates.latitude},${coordinates.longitude}`);
  }

  async findNearby(
    coordinates: Coordinates,
    type: string,
    radiusMeters: number,
  ): Promise<NearbyPlaceResult[]> {
    if (!this.isConfigured()) return [];

    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${coordinates.latitude},${coordinates.longitude}`);
    url.searchParams.set("radius", String(radiusMeters));
    url.searchParams.set("type", type);
    url.searchParams.set("key", this.serverKey);

    try {
      const response = await fetch(url, { next: { revalidate: 604_800 } });
      if (!response.ok) return [];

      const data = (await response.json()) as {
        results?: {
          name: string;
          place_id: string;
          geometry: { location: { lat: number; lng: number } };
        }[];
      };

      const { distanceKm } = await import("@/lib/domain/geo");

      return (data.results ?? []).map((place) => {
        const placeCoordinates = {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        };
        return {
          name: place.name,
          placeId: place.place_id,
          type,
          coordinates: placeCoordinates,
          distanceKm: Math.round(distanceKm(coordinates, placeCoordinates) * 100) / 100,
        };
      });
    } catch {
      return [];
    }
  }

  staticMapUrl(
    coordinates: Coordinates,
    options: { zoom?: number; width?: number; height?: number } = {},
  ): string | null {
    if (!this.browserKey) return null;
    const { zoom = 15, width = 640, height = 360 } = options;
    const center = `${coordinates.latitude},${coordinates.longitude}`;
    return (
      `https://maps.googleapis.com/maps/api/staticmap?center=${center}` +
      `&zoom=${zoom}&size=${width}x${height}&scale=2&maptype=roadmap` +
      `&markers=color:0x0f766e%7C${center}&key=${this.browserKey}`
    );
  }

  directionsUrl(coordinates: Coordinates, label?: string): string {
    const query = label
      ? `${encodeURIComponent(label)}`
      : `${coordinates.latitude},${coordinates.longitude}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  }
}

function component(components: GoogleGeocodeComponent[], ...types: string[]): string | undefined {
  for (const type of types) {
    const found = components.find((c) => c.types.includes(type));
    if (found) return found.long_name;
  }
  return undefined;
}

let cachedProvider: MapProvider | null = null;

export function getMapProvider(): MapProvider {
  if (cachedProvider) return cachedProvider;
  const env = getServerEnv();

  cachedProvider =
    env.MAP_PROVIDER === "google"
      ? new GoogleMapProvider(
          env.GOOGLE_MAPS_API_KEY ?? "",
          clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
        )
      : new NoopMapProvider();

  return cachedProvider;
}

/** Key-free deep link, safe to render in any client component. */
export function mapsDeepLink(coordinates: Coordinates, label?: string): string {
  const query = `${coordinates.latitude},${coordinates.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}${
    label ? `&query=${encodeURIComponent(label)}` : ""
  }`;
}
